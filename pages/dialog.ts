import { within, below } from "@jhuggett/terminal/bounds/bounds";
import { SelectComponent } from "../components/select/select";
import { Page } from "./page";

export type DialogNode = {
  prompt: string;
  options: {
    option: string;
    method: (page: DialogPage) => DialogNode | void;
  }[];
};

export type DialogPageProps = {
  dialog: DialogNode;
};

const linesNeededForText = (text: string, width: number) => {
  return Math.ceil(text.length / width);
};

export class DialogPage extends Page<DialogPageProps> {
  currentDialogNode?: DialogNode;

  render?: () => void;

  beforeSetup() {
    this.currentDialogNode = this.props.dialog;

    const prompt = this.root.createChildElement(
      () =>
        within(this.root, {
          height: linesNeededForText(
            this.currentDialogNode?.prompt || "",
            this.root.bounds.width
          ),
        }),
      {}
    );
    prompt.renderer = ({ cursor }) => {
      cursor.write(this.currentDialogNode?.prompt || "missing prompt", {
        foregroundColor: { r: 100, g: 100, b: 255, a: 1 },
        bold: true,
      });
    };

    const container = this.root.createChildElement(
      () => below(prompt, within(this.root, { height: 20, paddingLeft: 2 })),
      {}
    );

    const select = new SelectComponent({
      container,
      options: this.currentDialogNode?.options.map((option) => ({
        name: option.option,
        fn: () => {
          const nextNode = option.method(this);
          if (nextNode) {
            this.currentDialogNode = nextNode;
            this.render?.();
          }
        },
      })),
      textForOption: (option) => option.name,
      onSelect: (option) => option.fn?.(),
    });

    select.element.focus();

    this.root.on("Escape", () => {
      this.pop();
    });

    this.render = () => {
      prompt.render();
      container.render();
      select.element.render();

      if (!this.currentDialogNode) return;
      select.resetOptions(
        this.currentDialogNode?.options?.map((option) => ({
          name: option.option,
          fn: () => {
            const nextNode = option.method(this);
            if (nextNode) {
              this.currentDialogNode = nextNode;
              this.render?.();
            }
          },
        }))
      );
    };

    this.render();
  }
}
