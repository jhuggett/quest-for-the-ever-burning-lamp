import { within } from "@jhuggett/terminal/bounds/bounds";
import { Page } from "./page";
import { Save } from "../data/models/save";
import { blue, gray, red, yellow } from "@jhuggett/terminal";
import { db, konsole } from "..";
import { MapTile, MapTileManager } from "../data/models/map-tile";
import { Monster } from "../data/models/monster";
import { Player } from "../data/models/player";
import { GameMap } from "../data/models/game-map";
import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";

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
              backgroundColor: yellow(tileBrightness),
            });
          } else {
            cursor.write("  ", {
              backgroundColor: gray(tileBrightness),
            });
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
          cursor.write("  ", {
            backgroundColor: blue(tileBrightness),
          });
        }
      }

      cursor.moveTo({
        x: centerOffset.x * 2,
        y: centerOffset.y,
      });

      cursor.write("  ", {
        backgroundColor: red(0.9),
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
        view.render();

        this.shell.render();
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
        interval: Math.floor(Math.random() * 500) + 100,
        callback: () => {
          const playerTile = player.getTile(db);

          monster.moveTowardsPlayer(db, playerTile);
        },
      });
    }

    view.focus();

    const movePlayer = (x: number, y: number) => {
      const tileAbove = mapTileManager.getTile(x, y);

      if (tileAbove?.isTraversable()) {
        player.setTile(tileAbove);
        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);
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
