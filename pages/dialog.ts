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

    const container = this.root.createChildElement(
      () =>
        within(this.root, {
          height: 20,
          paddingLeft: 2,
          paddingTop: 1,
          paddingRight: 2,
        }),
      {}
    );

    const prompt = container.createChildElement(
      () =>
        within(container, {
          height: linesNeededForText(
            this.currentDialogNode?.prompt || "",
            container.bounds.width
          ),
        }),
      {}
    );
    prompt.renderer = ({ cursor }) => {
      cursor.write(this.currentDialogNode?.prompt || "missing prompt", {
        foregroundColor: { r: 155, g: 125, b: 150, a: 1 },
        bold: true,
      });
    };

    const selectContainer = container.createChildElement(
      () => below(prompt, within(container)),
      {}
    );

    const select = new SelectComponent({
      container: selectContainer,
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
      container.recalculateBounds();
      prompt.recalculateBounds();

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
