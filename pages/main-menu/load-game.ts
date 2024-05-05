import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../../components/select/select";
import { Page } from "../page";
import { Save } from "../../data/models/save";
import { GamePage } from "../game/game";
import { db } from "../..";
import { MapTileManager } from "../../data/models/map-tile";
import { LoadingPage } from "../loading-page";

export class LoadGamePage extends Page<{ saves: Save[] }> {
  beforeSetup() {
    const title = this.root.createChildElement(
      () => within(this.root, { height: 2 }),
      {}
    );
    title.renderer = ({ cursor }) => {
      cursor.write("Load Game", {
        foregroundColor: { r: 100, g: 100, b: 255, a: 1 },
        bold: true,
      });
    };

    const container = this.root.createChildElement(
      () => below(title, within(this.root, { height: 20 })),
      {}
    );

    const select = new SelectComponent({
      container,
      label: "Select a save:",
      options: this.props.saves.map((save) => ({
        name: save.props.name,
        fn: async () => {
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

          this.replace(loadingPage);
        },
      })),
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
