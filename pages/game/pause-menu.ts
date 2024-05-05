import { gray } from "@jhuggett/terminal";
import { Element } from "@jhuggett/terminal/elements/element";
import { konsole } from "../..";
import { GamePage } from "./game";

export class PauseMenu {
  open: boolean = false;
  menuBox?: Element<{}>;

  render?: () => void;

  mount(view: Element<{}>, gamePage: GamePage, onResume: () => void) {
    this.menuBox = view.createChildElement(() => {
      const bounds = {
        start: {
          x: view.bounds.globalStart.x,
          y: view.bounds.globalStart.y,
        },
        end: {
          x: view.bounds.globalEnd.x,
          y: view.bounds.globalEnd.y,
        },
      };

      konsole.log("general", "info", bounds);

      return bounds;
    }, {});

    this.menuBox.renderer = ({ cursor }) => {
      //if (!this.open) return;

      konsole.log("general", "info", "Rendering pause menu");

      cursor.properties.backgroundColor = gray(0, 0.95);
      cursor.fill(" ");

      cursor.moveTo({ x: 2, y: 2 });
      cursor.write("Paused");
    };

    this.menuBox.on("Escape", () => {
      this.open = false;

      this.menuBox?.render();

      onResume();

      return "stop propagation";
    });

    this.menuBox.on("q", () => {
      gamePage.pop();

      return "stop propagation";
    });

    const menu = this.menuBox.createChildElement(() => {
      const menuBox = this.menuBox;

      if (!menuBox) {
        throw new Error("Menu box not found");
      }

      const bounds = {
        start: {
          x: Math.floor(
            menuBox.bounds.globalStart.x + menuBox.bounds.width / 4
          ),
          y: Math.floor(
            menuBox.bounds.globalStart.y + menuBox.bounds.height / 3
          ),
        },
        end: {
          x: Math.floor(menuBox.bounds.globalEnd.x - menuBox.bounds.width / 4),
          y: Math.floor(menuBox.bounds.globalEnd.y - menuBox.bounds.height / 3),
        },
      };

      return bounds;
    }, {});

    menu.renderer = ({ cursor }) => {
      cursor.properties.backgroundColor = gray(0.1, 0.95);
      cursor.fill(" ");

      cursor.moveTo({ x: 2, y: 2 });
      cursor.write("Menu");
    };

    this.render = () => {
      this.menuBox?.render();
      menu.render();
    };
  }

  show() {
    this.open = true;
    this.render?.();
    this.menuBox?.focus();
  }
}
