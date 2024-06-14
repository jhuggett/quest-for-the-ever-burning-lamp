import { within } from "@jhuggett/terminal/bounds/bounds";
import { Element } from "@jhuggett/terminal/elements/element";

export type Props<T> = {
  options: T[];
  container: Element<any>;
  label?: string;
  textForOption: (option: T) => string;
  filterer?: (search: string, options: T[]) => T[];
  onSelect: (option: T) => void;
};

export class SelectComponent<T> {
  element: Element<{}>;

  search: string = "";
  filteredOptions: T[] = [];
  selectedIndex = 0;

  filterer = (search: string, options: T[]) =>
    options.filter((option) =>
      this.props
        .textForOption(option)
        .toLowerCase()
        .includes(search.toLowerCase().trim())
    );

  filter() {
    this.filteredOptions = this.filterer(this.search, this.props.options);
    this.selectedIndex = 0;
  }

  constructor(public props: Props<T>) {
    const { container, label, textForOption, options, filterer } = props;

    this.filterer = filterer || this.filterer;

    this.filteredOptions = options;

    this.element = container.createChildElement(() => within(container), {});

    this.element.renderer = ({ cursor, properties }) => {
      const optionHeight = cursor.bounds.height - 3;

      const itemsOutOfView = Math.round(
        this.filteredOptions.length -
          optionHeight -
          Math.max(this.selectedIndex - optionHeight / 2, 0)
      );

      if (label) cursor.write(label);
      cursor.write(` ${this.search}`);
      cursor.newLine();

      for (const option of this.filteredOptions.slice(
        Math.floor(Math.max(0, this.selectedIndex - optionHeight / 2)),
        Math.floor(
          Math.max(this.selectedIndex + optionHeight / 2, optionHeight)
        )
      )) {
        if (this.filteredOptions.indexOf(option) === this.selectedIndex) {
          cursor.write("-> ");
          cursor.write(textForOption(option), {
            bold: true,
          });
        } else {
          cursor.write("   ");
          cursor.write(textForOption(option));
        }

        cursor.newLine();
      }
      if (this.selectedIndex < this.filteredOptions.length - optionHeight / 2) {
        cursor.write(`   ${itemsOutOfView} more...`);
      }
    };

    this.element.on("Arrow Up", () => {
      if (this.selectedIndex === 0) {
        this.selectedIndex = this.filteredOptions.length - 1;
      } else {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      }
      this.element.render();
    });

    this.element.on("Arrow Down", () => {
      if (this.selectedIndex === this.filteredOptions.length - 1) {
        this.selectedIndex = 0;
      } else {
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.filteredOptions.length - 1
        );
      }

      this.element.render();
    });

    this.element.on("Delete", () => {
      this.search = this.search.slice(0, -1);
      this.filter();
      this.element.render();
    });

    this.element.on("Any character", (key) => {
      this.search += key;
      this.filter();
      this.element.render();
    });

    this.element.on("Space", () => {
      this.search += " ";
      this.filter();
      this.element.render();
    });

    this.element.on("Enter", () => {
      this.props.onSelect(this.filteredOptions[this.selectedIndex]);
    });
  }

  destroy() {
    this.element.destroy();
    this.element.clear();
  }

  resetOptions(options: T[]) {
    if (options) {
      this.props.options = options;
    }
    this.filter();
    this.element.render();
  }
}
