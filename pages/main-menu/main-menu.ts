import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../../components/select/select";
import { Page } from "../page";
import { Save } from "../../data/models/save";
import { MapTileManager } from "../../data/models/map-tile";
import { GamePage } from "../game/game";
import { LoadingPage } from "../loading-page";
import { GameMap } from "../../data/models/game-map";
import { Player } from "../../data/models/player";
import { DialogNode, DialogPage } from "../dialog";

const newGameDialog: DialogNode = {
  prompt: `You stand before the entrance to a cavern. It is dark outside. Scrawled on the wall is a message: "Descend into the darkness to find the Ever-Burning Lamp. Upon the 7th level, you will find it. Beware." What do you do?`,
  options: [
    {
      option: "Brave the darkness, enter the cavern ",
      method(page) {
        const loadingPage = new LoadingPage(page.root, page.shell, {
          action: async (setMessage) => {
            setMessage("Into deep darkness you descend.");

            const save = await Save.create({
              name: "main",
            });

            // create map
            const gameMap = await GameMap.create({
              save_id: save.props.id,
              level: 0,
            });

            const { tiles, monsters } = await gameMap.generateLevel(save);

            // create player
            const player = await Player.create({
              save_id: save.props.id,
              tile_id: tiles[0].props.id,
              view_radius: 15,
            });

            const mapTileManager = new MapTileManager(tiles);

            await mapTileManager.setup({ monsters, player });

            return new GamePage(page.root, page.shell, {
              save,
              player,
              gameMap,
              tiles,
              monsters,
              mapTileManager,
            });
          },
        });

        page.replace(loadingPage);
      },
    },
    {
      option: "Flee like a coward",
      method(page) {
        return {
          prompt: "You flee. You have won. Congratulations.",
          options: [
            {
              option: "Continue",
              method(page) {
                page.pop();
              },
            },
          ],
        };
      },
    },
  ],
};

export class MainMenuPage extends Page<void> {
  beforeSetup() {
    const title = this.root.createChildElement(
      () => within(this.root, { height: 2 }),
      {}
    );
    title.renderer = ({ cursor }) => {
      cursor.newLine();
      cursor.write("  Quest for the Ever-Burning Lamp", {
        foregroundColor: { r: 100, g: 100, b: 255, a: 1 },
        bold: true,
      });
    };

    const container = this.root.createChildElement(
      () => below(title, within(this.root, { height: 20, paddingLeft: 2 })),
      {}
    );

    const options = [
      {
        name: "New Game",
        fn: async () => {
          this.push(
            new DialogPage(this.root, this.shell, {
              dialog: newGameDialog,
            })
          );
        },
      },
      {
        name: "Quit",
        fn: () => {
          this.pop();
        },
      },
    ];

    Save.all().then((saves) => {
      if (saves.length > 0) {
        options.unshift({
          name: "Continue",
          fn: async () => {
            const save = saves[0];

            const loadingPage = new LoadingPage(this.root, this.shell, {
              action: async (setMessage) => {
                setMessage("Back into deep darkness you delve.");

                const player = await save.getPlayer();
                const gameMap = await player.getGameMap();
                if (!gameMap) throw new Error("Could not find game map");
                const tiles = await gameMap.getAllTiles();
                const monsters = await gameMap.getMonsters();

                const mapTileManager = new MapTileManager(tiles);

                await mapTileManager.setup({ monsters, player });

                return new GamePage(this.root, this.shell, {
                  save,
                  player,
                  monsters,
                  gameMap,
                  tiles,
                  mapTileManager,
                });
              },
            });

            this.push(loadingPage);
          },
        });

        select.element.render();
        this.shell.render();
      }
    });

    const select = new SelectComponent({
      container,
      options,
      textForOption: (option) => option.name,
      onSelect: (option) => option.fn?.(),
    });

    select.element.focus();

    this.root.on("Escape", () => {
      this.pop();
    });

    title.render();
    container.render();
    select.element.render();
  }
}
