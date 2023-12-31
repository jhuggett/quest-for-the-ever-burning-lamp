import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../../components/select/select";
import { Page } from "../page";

export class SettingsPage extends Page<void> {
  beforeSetup() {
    const title = this.root.createChildElement(
      () => within(this.root, { height: 2 }),
      {}
    );
    title.renderer = ({ cursor }) => {
      cursor.write("Settings", {
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
      options: [
        { name: "TODO A", fn: () => {} },
        { name: "TODO B", fn: () => {} },
        { name: "TODO C", fn: () => {} },
      ],
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
