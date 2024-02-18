import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../../components/select/select";
import { Page } from "../page";
import { Save } from "../../data/models/save";
import { GamePage } from "../game";
import { db } from "../..";

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
        fn: () => {
          const player = save.getPlayer(db);
          const monsters = save.getMonsters(db);
          const gameMap = save.getGameMap(db);
          const tiles = gameMap.getAllTiles(db);

          this.replace(
            new GamePage(this.root, this.shell, {
              save,
              player,
              monsters,
              gameMap,
              tiles,
            })
          );
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
