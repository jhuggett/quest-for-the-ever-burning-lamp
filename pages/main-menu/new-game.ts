import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { db } from "../..";
import { TextInputComponent } from "../../components/text-input/text-input";
import { Save } from "../../data/models/save";
import { Page } from "../page";
import { GamePage } from "../game";
import { GameMap } from "../../data/models/game-map";
import { Player } from "../../data/models/player";

export class NewGamePage extends Page<void> {
  beforeSetup() {
    const title = this.root.createChildElement(
      () => within(this.root, { height: 2 }),
      {}
    );
    title.renderer = ({ cursor }) => {
      cursor.write("New Game", {
        foregroundColor: { r: 100, g: 100, b: 255, a: 1 },
        bold: true,
      });
    };

    const container = this.root.createChildElement(
      () => below(title, within(this.root, { height: 2 })),
      {}
    );

    const saveName = new TextInputComponent({
      container,
      label: "Save Name:",
      onSubmit: async (value) => {
        const save = Save.create(db, {
          name: value,
        });

        const gameMap = GameMap.create(db, { save_id: save.props.id });

        const tiles = gameMap.getAllTiles(db);

        const player = Player.create(db, {
          save_id: save.props.id,
          tile_id: tiles[0].props.id,
          view_radius: 10,
        });

        this.replace(new GamePage(this.root, this.shell, { save }));
      },
    });

    this.root.on("Escape", () => {
      this.pop();
    });

    saveName.inputElement.focus();

    title.render();
    container.render();
    saveName.inputElement.render();
    saveName.errorElement.render();
  }
}
