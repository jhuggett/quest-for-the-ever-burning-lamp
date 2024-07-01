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

    const menu = this.menuBox.createChildElement(
      () => within(this.menuBox!, { paddingLeft: 2 }),
      {}
    );

    menu.renderer = ({ cursor }) => {};

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
