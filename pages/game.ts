import { within } from "@jhuggett/terminal/bounds/bounds";
import { Page } from "./page";
import { Save } from "../data/models/save";
import { black, blue, gray, red, yellow, RGB } from "@jhuggett/terminal";
import { db, konsole } from "..";
import { MapTile, MapTileManager } from "../data/models/map-tile";
import { Monster } from "../data/models/monster";
import { Player } from "../data/models/player";
import { GameMap } from "../data/models/game-map";
import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";
import { OutOfBoundsError } from "@jhuggett/terminal/cursors/cursor";
import { Exit } from "../data/models/exit";
import { randomlyGet } from "./main-menu/new-game";

class Color implements RGB {
  constructor(
    public r: number,
    public g: number,
    public b: number,
    public a: number = 1
  ) {}

  darkenTo(amount: number) {
    return new Color(this.r * amount, this.g * amount, this.b * amount, this.a);
  }
}

export type GamePageProps = {
  save: Save;
  monsters: Monster[];
  player: Player;
  tiles: MapTile[];
  gameMap: GameMap;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Loop = {
  interval: number;
  callback: () => void;
};

class GameLoop {
  private paused = false;

  get isPaused() {
    return this.paused;
  }

  get isRunning() {
    return !this.paused;
  }

  private loops: Loop[] = [];

  addLoop(loop: Loop) {
    this.loops.push(loop);
  }

  start() {
    this.paused = false;

    for (const loop of this.loops) {
      this.loop(loop);
    }

    this.onPausedChange.emit(this.paused);
  }

  stop() {
    this.paused = true;
    this.onPausedChange.emit(this.paused);
  }

  async loop(loop: Loop) {
    while (!this.paused) {
      loop.callback();
      await sleep(loop.interval);
    }
  }

  onPausedChange: SubscribableEvent<boolean> = new SubscribableEvent();
}

export class GamePage extends Page<GamePageProps> {
  beforeSetup(): void {
    const view = this.root.createChildElement(() => within(this.root), {});

    const { save, monsters, player, tiles } = this.props;

    const mapTileManager = new MapTileManager(tiles);

    for (const monster of monsters) {
      // to maintain the same tile references
      const tile = monster.getTile(db);
      const monsterTile = mapTileManager.getTile(tile.props.x, tile.props.y);
      if (monsterTile) monster.setTile(monsterTile);
    }

    const playerTile = player.getTile(db);
    const playerMapTile = mapTileManager.getTile(
      playerTile.props.x,
      playerTile.props.y
    );
    if (playerMapTile) player.setTile(playerMapTile);

    view.renderer = ({ cursor }) => {
      cursor.fill(" ");

      const visibleTiles = player.visibleTiles(db, mapTileManager);

      const playerTile = player.getTile(db);

      const centerOffset = {
        x: Math.floor(view.bounds.width / 4),
        y: Math.floor(view.bounds.height / 2),
      };

      const center = {
        x: playerTile.props.x - centerOffset.x,
        y: playerTile.props.y - centerOffset.y,
      };

      for (const tile of visibleTiles) {
        const distanceToPlayer = playerTile.distanceTo(tile);
        if (distanceToPlayer > player.props.view_radius) continue;

        const x = tile.props.x * 2 - center.x * 2;
        const y = tile.props.y - center.y;

        if (
          x >= 0 &&
          x < view.bounds.width &&
          y >= 0 &&
          y < view.bounds.height
        ) {
          const distanceToPlayer = Math.sqrt(
            Math.pow(playerTile.props.x - tile.props.x, 2) +
              Math.pow(playerTile.props.y - tile.props.y, 2) +
              1 // 1 being the height of the player
          );

          const tileBrightness = Math.min(
            player.props.view_radius / Math.pow(distanceToPlayer, 2),
            1
          );

          cursor.moveTo({ x, y });
          if (tile.props.is_wall) {
            cursor.write("  ", {
              backgroundColor: new Color(120, 110, 100).darkenTo(
                tileBrightness
              ),
            });
          } else {
            if (tile.attachedExit(db)) {
              cursor.write("  ", {
                backgroundColor: new Color(250, 0, 0).darkenTo(tileBrightness),
              });
            } else {
              cursor.write("  ", {
                backgroundColor: new Color(220, 210, 200).darkenTo(
                  tileBrightness
                ),
              });
            }
          }
        }
      }

      for (const monster of monsters) {
        const monsterTile = monster.getTile(db);

        const x = monsterTile.props.x * 2 - center.x * 2;
        const y = monsterTile.props.y - center.y;

        if (
          x >= 0 &&
          x < view.bounds.width &&
          y >= 0 &&
          y < view.bounds.height
        ) {
          const distanceToPlayer = Math.sqrt(
            Math.pow(playerTile.props.x - monsterTile.props.x, 2) +
              Math.pow(playerTile.props.y - monsterTile.props.y, 2) +
              1 // 1 being the height of the player
          );

          const tileBrightness = Math.min(
            player.props.view_radius / Math.pow(distanceToPlayer, 2),
            1
          );

          cursor.moveTo({ x, y });
          cursor.write("••", {
            backgroundColor: new Color(20, 30, 10).darkenTo(tileBrightness),
            foregroundColor: new Color(200, 20, 10),
          });
        }
      }

      cursor.moveTo({
        x: centerOffset.x * 2,
        y: centerOffset.y,
      });

      cursor.write("••", {
        foregroundColor: new Color(0, 200, 10),
        backgroundColor: new Color(80, 60, 50),
      });
    };

    view.render();

    const gameLoop = new GameLoop();

    const statsView = view.createChildElement(
      () =>
        within(view, {
          height: 5,
          paddingTop: 1,
          paddingLeft: 2,
          paddingRight: 2,
        }),
      {}
    );

    statsView.renderer = ({ cursor }) => {
      cursor.properties.backgroundColor = { r: 20, g: 30, b: 30, a: 0.9 };
      cursor.fill(" ");
      cursor.moveTo({ x: 2, y: 1 });

      cursor.properties.bold = true;

      cursor.write(`${gameLoop.isRunning ? "Running" : "Paused"}`);

      cursor.write(" | ");

      cursor.write(`View Radius: ${player.props.view_radius.toFixed(2)}`);
    };

    statsView.render();

    gameLoop.onPausedChange.subscribe((paused) => {
      statsView.render();
    });

    gameLoop.addLoop({
      interval: 50,
      callback: () => {
        try {
          view.render();

          this.shell.render();
        } catch (e) {
          if (e instanceof OutOfBoundsError) {
            // ignore
            // we should sort this out though
          } else {
            throw e;
          }
        }
      },
    });

    gameLoop.addLoop({
      interval: 250,
      callback: () => {
        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        statsView.render();
      },
    });

    for (const monster of monsters) {
      gameLoop.addLoop({
        interval: Math.floor(Math.random() * 500) + 500,
        callback: () => {
          const playerTile = player.getTile(db);

          monster.moveTowardsPlayer(db, playerTile);
        },
      });
    }

    view.focus();

    const movePlayer = (x: number, y: number) => {
      const potentialTile = mapTileManager.getTile(x, y);

      if (potentialTile?.isTraversable()) {
        player.setTile(potentialTile);
        const potentialTileExit = potentialTile.attachedExit(db);
        if (potentialTileExit) {
          gameLoop.stop();

          // create map
          const gameMap = potentialTileExit.getToMap(db);
          const nextMap = GameMap.create(db, { save_id: save.props.id });

          // generate tiles
          gameMap.generateTiles(db);
          const tiles = gameMap.getAllTiles(db);

          // choose entrance
          const entranceTile = randomlyGet(
            tiles.filter((tile) => !tile.props.is_wall)
          );
          potentialTileExit.props.to_map_tile_id = entranceTile.props.id;
          potentialTileExit.save(db);

          // place player
          player.setTile(entranceTile);
          player.save(db);

          // create exit
          const exitTile = randomlyGet(
            tiles.filter((tile) => !tile.props.is_wall)
          );
          Exit.create(db, {
            from_map_id: gameMap.props.id,
            to_map_id: nextMap.props.id,
            from_map_tile_id: exitTile.props.id,
          });

          // create monsters
          for (let i = 0; i < 10; i++) {
            const tile = randomlyGet(
              tiles.filter((tile) => !tile.props.is_wall)
            );
            Monster.create(db, {
              save_id: save.props.id,
              tile_id: tile.props.id,
            });
          }

          const monsters = gameMap.getMonsters(db);

          this.replace(
            new GamePage(this.root, this.shell, {
              save,
              player,
              gameMap,
              tiles,
              monsters,
            })
          );
        }
      }
    };

    view.on("Arrow Up", () => {
      const playerTile = player.getTile(db);
      movePlayer(playerTile.props.x, playerTile.props.y - 1);
    });

    view.on("Arrow Down", () => {
      const playerTile = player.getTile(db);
      movePlayer(playerTile.props.x, playerTile.props.y + 1);
    });

    view.on("Arrow Left", () => {
      const playerTile = player.getTile(db);
      movePlayer(playerTile.props.x - 1, playerTile.props.y);
    });

    view.on("Arrow Right", () => {
      const playerTile = player.getTile(db);
      movePlayer(playerTile.props.x + 1, playerTile.props.y);
    });

    this.root.on("Escape", () => {
      gameLoop.stop();
      this.pop();
    });

    view.on("+", () => {
      player.props.view_radius = 50; // Math.min(50, player.props.view_radius + 0.5);
      player.save(db);
    });

    view.on("Space", () => {
      if (gameLoop.isRunning) {
        gameLoop.stop();
      } else {
        gameLoop.start();
      }
    });

    gameLoop.start();
  }
}
