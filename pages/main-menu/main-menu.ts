import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../../components/select/select";
import { Page } from "../page";
import { NewGamePage } from "./new-game";
import { SettingsPage } from "./settings";
import { db } from "../..";
import { Save } from "../../data/models/save";
import { LoadGamePage } from "./load-game";

export class MainMenuPage extends Page<void> {
  beforeSetup() {
    const title = this.root.createChildElement(
      () => within(this.root, { height: 2 }),
      {}
    );
    title.renderer = ({ cursor }) => {
      cursor.write("Yep, it's a game", {
        foregroundColor: { r: 100, g: 100, b: 255, a: 1 },
        bold: true,
      });
    };

    const container = this.root.createChildElement(
      () => below(title, within(this.root, { height: 20 })),
      {}
    );

    const options = [
      {
        name: "New Game",
        fn: () => {
          this.push(new NewGamePage(this.root, this.shell));
        },
      },
      {
        name: "Settings",
        fn: () => {
          this.push(new SettingsPage(this.root, this.shell));
        },
      },
      {
        name: "Quit",
        fn: () => {
          this.pop();
        },
      },
    ];

    const allSaves = Save.all(db);

    if (allSaves.length > 0) {
      options.unshift({
        name: "Load Game",
        fn: () => {
          this.push(
            new LoadGamePage(this.root, this.shell, { saves: allSaves })
          );
        },
      });
    }

    const select = new SelectComponent({
      container,
      label: "Main Menu:",
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
