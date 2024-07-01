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
import { Item } from "../../data/models/item";
import { LoadingPage } from "../loading-page";
import { Element } from "@jhuggett/terminal/elements/element";
import { PauseMenu } from "./pause-menu";
import { DialogNode, DialogPage } from "../dialog";

/*

Starts with
You stand before the entrance to a cavern. It is dark outside.
Scrawled on the wall is a message: "Descend into the darkness to find the Ever-Burning Lamp. Upon the 7th level, you will find it. Beware."
What do you do?

> Brave the darkness, enter the cavern | this starts the game like normal
> Flee like a coward | this is the only actual win condition

Then when in the cavern:
Within the cavern you stand, your lantern flickering. The darkness is oppressive. Red eyes gleam in the darkness.
You hear the shuffling of feet. Deserted lamps dot the ground (show oil icon), Perhaps the still hold oil. 

> Continue

There is no turning back now. Find the stairs down to the next level (show stairs icon).

> Continue

___ 

Each decent, a shady figure appears. Offers you a deal, lead you directly to the next level. 
Toss of a coin, you win you get to the next level, you lose it takes your lamp. 

> Heads
> Tails
> Refuse the offer and continue on your own

On the seventh level, you find the Ever-Burning Lamp. But the figure is there, waiting. You cannot win.
*/

// const nextLevelDialog: DialogNode = {
//   prompt:
//     "Each decent, a shady figure appears. Offers you a deal, lead you directly to the next level. Toss of a coin, you win you get to the next level, you lose it takes your lamp.",
// };

export const gameOver = async () => {
  const save = (await Save.all())?.[0];

  if (save) {
    await save.delete();
  }
};

const lostLampMessage = () => {
  return [
    randomlyGet([
      "You loose, it grins.",
      "You loose, it cackles.",
      "You loose, it whispers.",
      "You loose, it laughs.",
      "You loose, it mocks.",
      "You loose, it sneers.",
    ]),
    "It grabs your lamp as it sputters out.",
    randomlyGet([
      "You are alone in the dark.",
      "You are lost in the dark.",
      "You are trapped in the dark.",
      "You are doomed in the dark.",
      "You are forsaken in the dark.",
      "You are damned in the dark.",
    ]),
    randomlyGet([
      "You see red eyes gleaming in the dark.",
      "You hear the shuffling of feet.",
      "You feel the cold breath on your neck.",
      "You smell the stench of decay.",
      "You taste the bitterness of fear.",
    ]),
    "You are never seen again. Your quest ends here.",
  ].join(" ");
};

const surroundedMessage = () => {
  return [
    randomlyGet([
      "You are surrounded.",
      "You are cornered.",
      "You are trapped.",
      "You are encircled.",
    ]),
    randomlyGet([
      "Hands reach out for you.",
      "Nails scratch at you.",
      "Teeth gnash at you.",
      "Eyes glare at you.",
    ]),
    "You are never seen again. Your quest ends here.",
  ].join(" ");
};

const seventhLevelGameOverMessage = () => {
  return [
    `The figure stands before you. "Hark, brave adventurer, you have made it to the seventh level. Great challenges you have overcome; you've escaped peril and have passed through darkness. Alas, this quest is but an invitation to dine, and this level my own dining hall. Find comfort in knowing you too will shuffle these halls forever. Goodnight dear adventurer." It grins a toothy grin. You are never seen again. Your quest ends here.`,
  ].join(" ");
};

const nextLevelDialog: (nextLevel: (page: Page<any>) => void) => DialogNode = (
  nextLevel: (page: Page<any>) => void
) => ({
  prompt: `A shady figure appears. "Win a coin toss and I will take you to the next level, lose and I take your lamp. Have we a deal?"`,
  options: [
    {
      option: "Refuse the offer and continue on your own",
      method(page) {
        nextLevel(page);
      },
    },
    {
      option: "Choose Heads",
      method(page) {
        return {
          prompt: "The coin lands on Tails. " + lostLampMessage(),
          options: [
            {
              option: "Continue",
              async method(page) {
                await gameOver();
                page.pop();
              },
            },
          ],
        };
      },
    },
    {
      option: "Choose Tails",
      method(page) {
        return {
          prompt: "The coin lands on heads. " + lostLampMessage(),
          options: [
            {
              option: "Continue",
              async method(page) {
                await gameOver();
                page.pop();
              },
            },
          ],
        };
      },
    },
  ],
});

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

    // 6
    if (gamePage.props.gameMap.props.level === 6) {
      this.gameLoop.stop();
      gameOver();

      const gameOverDialog = new DialogPage(gamePage.root, gamePage.shell, {
        dialog: {
          prompt: seventhLevelGameOverMessage(),
          options: [
            {
              method(page) {
                page.pop();
              },
              option: "Continue",
            },
          ],
        },
      });

      gamePage.replace(gameOverDialog);

      return;
    }

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
              cursor.write("▙▁", {
                // Exit
                backgroundColor: new Color(10, 10, 5).darkenTo(tileBrightness),
                foregroundColor: new Color(100, 100, 90),
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
                      foregroundColor: new Color(184, 115, 51).darkenTo(
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

        // check if player is surrounded
        const playerTile = player.cachedTile;

        const untraversableTiles = playerTile
          ?.adjacentTiles()
          .filter((tile) => !tile.isTraversable());
        if (
          untraversableTiles &&
          untraversableTiles.length === playerTile?.adjacentTiles().length
        ) {
          this.gameLoop.stop();
          gameOver();

          const gameOverDialog = new DialogPage(gamePage.root, gamePage.shell, {
            dialog: {
              prompt: surroundedMessage(),
              options: [
                {
                  method(page) {
                    page.pop();
                  },
                  option: "Continue",
                },
              ],
            },
          });

          gamePage.replace(gameOverDialog);

          gameOverDialog.render?.();

          return;
        }

        //statsView.render();
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

          gamePage.replace(
            new DialogPage(gamePage.root, gamePage.shell, {
              dialog: nextLevelDialog((page) => {
                const loadingPage = new LoadingPage(
                  gamePage.root,
                  gamePage.shell,
                  {
                    action: async (setMessage) => {
                      setMessage(
                        "You descend ever deeper into the darkness (loading...)"
                      );

                      konsole.log("general", "info", "Generating next level");
                      const gameMap = await potentialTileExit.getToMap();

                      konsole.log(
                        "general",
                        "info",
                        "Generating next level tiles"
                      );
                      const { monsters, tiles } = await gameMap.generateLevel(
                        save
                      );

                      // choose entrance
                      const entranceTile = randomlyGet(
                        tiles.filter((tile) => !tile.props.is_wall)
                      );
                      potentialTileExit.props.to_map_tile_id =
                        entranceTile.props.id;
                      konsole.log("general", "info", "Saving exit");
                      await potentialTileExit.save();

                      // place player
                      player.setTile(entranceTile);
                      konsole.log("general", "info", "Saving player");
                      await player.save();

                      const mapTileManager = new MapTileManager(tiles);
                      konsole.log(
                        "general",
                        "info",
                        "Setting up map tile manager"
                      );
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
                  }
                );

                page.replace(loadingPage);
              }),
            })
          );

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

    // view.on("+", () => {
    //   player.props.view_radius = 50; // Math.min(50, player.props.view_radius + 0.5);
    //   player.save();
    // });

    // view.on("p", () => {
    //   if (this.gameLoop.isRunning) {
    //     this.gameLoop.stop();
    //   } else {
    //     this.gameLoop.start();
    //   }
    // });

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

export function randomlyGet<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}
