import { gray } from "@jhuggett/terminal";
import { Element } from "@jhuggett/terminal/elements/element";
import { GamePage } from "./game";
import { SelectComponent } from "../../components/select/select";
import { within } from "@jhuggett/terminal/bounds/bounds";

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
      return bounds;
    }, {});

    this.menuBox.renderer = ({ cursor }) => {
      if (!this.open) return;

      cursor.properties.backgroundColor = gray(0, 0.95);
      cursor.fill(" ");
    };

    this.menuBox.on("Escape", () => {
      this.open = false;

      this.menuBox?.render();

      onResume();

      return "stop propagation";
    });

    const menuAccent = this.menuBox.createChildElement(() => {
      const menuBox = this.menuBox;

      if (!menuBox) {
        throw new Error("Menu box not found");
      }

      const width = 25;
      const height = 7;

      const centerX = Math.floor(
        menuBox.bounds.globalStart.x + menuBox.bounds.width / 2
      );
      const centerY = Math.floor(
        menuBox.bounds.globalStart.y + menuBox.bounds.height / 2
      );

      const bounds = {
        start: {
          x: Math.floor(centerX - width / 2),
          y: Math.floor(centerY - height / 2),
        },
        end: {
          x: Math.floor(centerX + width / 2),
          y: Math.floor(centerY + height / 2),
        },
      };

      return bounds;
    }, {});

    menuAccent.renderer = ({ cursor }) => {
      cursor.properties.backgroundColor = gray(0.1, 0.9);
      cursor.fill(" ");
    };

    const menu = this.menuBox.createChildElement(
      () => within(menuAccent, { padding: 2 }),
      {}
    );

    menu.renderer = ({ cursor }) => {
      cursor.properties.backgroundColor = gray(0.1, 0.95);
      cursor.fill(" ");
    };

    const select = new SelectComponent({
      container: menu,
      options: [
        {
          name: "Resume",
          fn: () => {
            this.open = false;
            this.menuBox?.render();
            onResume();
          },
        },
        {
          name: "Quit",
          fn: () => {
            gamePage.pop();
          },
        },
      ],
      textForOption: (option) => option.name,
      onSelect: (option) => option.fn?.(),
    });

    this.render = () => {
      this.menuBox?.render();
      menu.render();

      select.element.render();
      select.element.focus();
    };
  }

  show() {
    this.open = true;
    this.render?.();
  }
}
