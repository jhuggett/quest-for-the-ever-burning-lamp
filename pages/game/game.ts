import { within } from "@jhuggett/terminal/bounds/bounds";
import { Page } from "../page";
import { Save } from "../../data/models/save";
import { RGB } from "@jhuggett/terminal";
import { konsole } from "../..";
import { MapTile, MapTileManager } from "../../data/models/map-tile";
import { Monster } from "../../data/models/monster";
import { Player } from "../../data/models/player";
import { GameMap } from "../../data/models/game-map";
import { SubscribableEvent } from "@jhuggett/terminal/subscribable-event";
import { OutOfBoundsError } from "@jhuggett/terminal/cursors/cursor";
import { randomlyGet } from "../main-menu/new-game";
import { Item } from "../../data/models/item";
import { LoadingPage } from "../loading-page";
import { Element } from "@jhuggett/terminal/elements/element";
import { PauseMenu } from "./pause-menu";

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
  mapTileManager: MapTileManager;
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

class Game {
  gameLoop = new GameLoop();

  view: Element<{}> | null = null;

  mount(view: Element<{}>, gamePage: GamePage, pause: () => void) {
    const { save, monsters, player, tiles, mapTileManager } = gamePage.props;

    this.view = view;

    view.renderer = ({ cursor }) => {
      cursor.fill(" ");

      const visibleTiles = player.visibleTiles(mapTileManager);
      const playerTile = player.cachedTile;

      if (!playerTile) return;

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
            if (tile.cachedAttachedExit) {
              cursor.write("  ", {
                backgroundColor: new Color(250, 0, 0).darkenTo(tileBrightness),
              });
            } else {
              if (tile.cachedItems && tile.cachedItems.length > 0) {
                const item = tile.cachedItems[0];
                switch (item.props.item_type) {
                  case "breadcrumb":
                    cursor.write(item.variant > 0.5 ? ". " : " .", {
                      foregroundColor: new Color(120, 110, 130).darkenTo(
                        tileBrightness
                      ),
                      backgroundColor: new Color(220, 210, 200).darkenTo(
                        tileBrightness
                      ),
                    });
                    break;
                  case "oil": // ▗▖ ▐▍
                    cursor.write("▗▖", {
                      foregroundColor: new Color(200, 110, 130).darkenTo(
                        tileBrightness
                      ),
                      backgroundColor: new Color(220, 210, 200).darkenTo(
                        tileBrightness
                      ),
                    });
                    break;
                }
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
      }

      for (const monster of monsters) {
        const monsterTile = monster.cachedTile;

        if (!monsterTile) continue;

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

      cursor.write(`${this.gameLoop.isRunning ? "Running" : "Paused"}`);

      cursor.write(" | ");

      cursor.write(`View Radius: ${player.props.view_radius.toFixed(2)}`);

      cursor.write(" | ");

      cursor.write(`Save: ${save.props.name}`);

      cursor.write(" | ");

      cursor.write(`Level: ${gamePage.props.gameMap.props.level}`);

      cursor.write(" | ");

      cursor.write(`Monsters: ${monsters.length}`);

      cursor.write(" | ");

      cursor.write(`Tiles: ${tiles.length}`);
    };

    statsView.render();

    this.gameLoop.onPausedChange.subscribe((paused) => {
      statsView.render();
    });

    this.gameLoop.addLoop({
      interval: 50,
      callback: () => {
        try {
          view.render();

          gamePage.shell.render();
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

    this.gameLoop.addLoop({
      interval: 250,
      callback: () => {
        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        statsView.render();
      },
    });

    for (const monster of monsters) {
      this.gameLoop.addLoop({
        interval: Math.floor(Math.random() * 500) + 500,
        callback: () => {
          const playerTile = player.cachedTile;

          if (!playerTile) return;

          monster.moveTowardsPlayer(playerTile);
        },
      });
    }

    view.focus();

    const movePlayer = async (x: number, y: number) => {
      const potentialTile = mapTileManager.getTile(x, y);

      if (potentialTile?.isTraversable()) {
        player.setTile(potentialTile);

        if (potentialTile.cachedItems && potentialTile.cachedItems.length > 0) {
          const item = potentialTile.cachedItems[0];
          if (item.props.item_type === "oil") {
            await item.delete();
            await potentialTile.refetchItems();
            player.props.view_radius += 2;
          }
        }

        const potentialTileExit = potentialTile.cachedAttachedExit;
        if (potentialTileExit) {
          this.gameLoop.stop();

          const loadingPage = new LoadingPage(gamePage.root, gamePage.shell, {
            action: async (setMessage) => {
              setMessage("You descend ever deeper into the darkness.");

              konsole.log("general", "info", "Generating next level");
              const gameMap = await potentialTileExit.getToMap();

              konsole.log("general", "info", "Generating next level tiles");
              const { monsters, tiles } = await gameMap.generateLevel(save);

              // choose entrance
              const entranceTile = randomlyGet(
                tiles.filter((tile) => !tile.isTraversable())
              );
              potentialTileExit.props.to_map_tile_id = entranceTile.props.id;
              konsole.log("general", "info", "Saving exit");
              await potentialTileExit.save();

              // place player
              player.setTile(entranceTile);
              konsole.log("general", "info", "Saving player");
              await player.save();

              const mapTileManager = new MapTileManager(tiles);
              konsole.log("general", "info", "Setting up map tile manager");
              await mapTileManager.setup({ monsters, player });

              konsole.log("general", "info", "Returning game page");
              return new GamePage(gamePage.root, gamePage.shell, {
                save,
                player,
                gameMap,
                tiles,
                monsters,
                mapTileManager,
              });
            },
          });

          gamePage.replace(loadingPage);

          return;
        }

        if (potentialTile.cachedItems && potentialTile.cachedItems.length > 0) {
          return;
        }

        await Item.create({
          item_type: "breadcrumb",
          tile_id: potentialTile.props.id,
        });

        await potentialTile.refetchItems();
      }
    };

    view.on("Arrow Up", () => {
      const playerTile = player.cachedTile;
      if (!playerTile) return;
      movePlayer(playerTile.props.x, playerTile.props.y - 1);
    });

    view.on("Arrow Down", () => {
      const playerTile = player.cachedTile;
      if (!playerTile) return;
      movePlayer(playerTile.props.x, playerTile.props.y + 1);
    });

    view.on("Arrow Left", () => {
      const playerTile = player.cachedTile;
      if (!playerTile) return;
      movePlayer(playerTile.props.x - 1, playerTile.props.y);
    });

    view.on("Arrow Right", () => {
      const playerTile = player.cachedTile;
      if (!playerTile) return;
      movePlayer(playerTile.props.x + 1, playerTile.props.y);
    });

    gamePage.root.on("Escape", () => {
      // this.gameLoop.stop();
      // gamePage.pop();

      pause();
    });

    view.on("+", () => {
      player.props.view_radius = 50; // Math.min(50, player.props.view_radius + 0.5);
      player.save();
    });

    view.on("p", () => {
      if (this.gameLoop.isRunning) {
        this.gameLoop.stop();
      } else {
        this.gameLoop.start();
      }
    });

    this.gameLoop.start();
  }

  focus() {
    this.view?.focus();
  }
}

export class GamePage extends Page<GamePageProps> {
  beforeSetup(): void {
    const view = this.root.createChildElement(() => within(this.root), {});

    const game = new Game();

    game.mount(view, this, () => {
      konsole.log("general", "info", "Pausing game");
      game.gameLoop.stop();
      pauseMenu.show();
    });

    const pauseMenu = new PauseMenu();

    pauseMenu.mount(view, this, () => {
      konsole.log("general", "info", "Resuming game");

      pauseMenu.menuBox?.clearThisAndEverythingAbove();

      game.gameLoop.start();
      game.focus();
    });
  }
}
