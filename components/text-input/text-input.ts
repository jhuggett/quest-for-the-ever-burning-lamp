import { red, white } from "@jhuggett/terminal";
import { below, within } from "@jhuggett/terminal/bounds/bounds";
import { Element } from "@jhuggett/terminal/elements/element";
import {
  SubscribableEvent,
  SubscriptionManager,
} from "@jhuggett/terminal/subscribable-event";

export type Props = {
  defaultValue?: string;
  placeholder?: string;
  container: Element<any>;
  label: string;
  disallowedCharacters?: string[];
  validator?: (value: string) => Promise<string | undefined>;
  onSubmit?(value: string): void;
};

export class TextInputComponent {
  inputElement: Element<{ value: string }>;
  errorElement: Element<{ errorMessage: string }>;

  cursorPosition = 0;

  value = "";
  onValueChange = new SubscribableEvent<string>();
  setValue(value: string) {
    this.value = value;
    this.onValueChange.emit(value);
    this.inputElement.reactivelyUpdateProperties(() => ({
      value,
    }));
    this.updateCursorPosition();
  }

  subscriptions = new SubscriptionManager();

  updateCursorPosition() {
    this.props.container.shell.showCursor(true);
    this.props.container.shell.setDecorativeCursorLocation(
      this.inputElement.bounds.toGlobal({
        x: this.props.label.length + this.cursorPosition,
        y: 0,
      })
    );
  }

  async submit() {
    if ((await this.validate()) !== "valid") return;
    this.props.onSubmit?.(this.value);
  }

  async validate(): Promise<"valid" | string> {
    if (this.props.validator) {
      const errorMessage = await this.props.validator(this.value);
      this.errorElement.reactivelyUpdateProperties(() => ({
        errorMessage: errorMessage ?? "",
      }));
      if (errorMessage) return errorMessage;
    }
    return "valid";
  }

  constructor(public props: Props) {
    this.value = props.defaultValue ?? "";
    this.cursorPosition = props.defaultValue?.length ?? 0;

    this.inputElement = props.container.createChildElement(
      () => within(props.container, { height: 1 }),
      {
        value: this.value,
      }
    );

    this.inputElement.renderer = ({ cursor, properties }) => {
      cursor.write(this.props.label, {
        foregroundColor: white(0.75),
      });
      if (properties.value) {
        cursor.write(properties.value, {
          foregroundColor: white(),
        });
      } else if (this.props.placeholder) {
        cursor.write(this.props.placeholder, {
          foregroundColor: white(0.5),
          italic: true,
        });
      }
    };

    this.inputElement.render();

    this.errorElement = props.container.createChildElement(
      () => below(this.inputElement, within(props.container, { height: 1 })),
      {
        errorMessage: "",
      }
    );

    this.errorElement.renderer = ({ cursor, properties }) => {
      cursor.write(properties.errorMessage, { foregroundColor: red(0.6) });
    };

    this.errorElement.render();

    this.subscriptions.addMultiple([
      this.inputElement.onFocus.subscribe(() => {
        this.updateCursorPosition();
      }),
      this.inputElement.onBlur.subscribe(() => {
        this.props.container.shell.showCursor(false);
      }),
    ]);

    this.inputElement.on("Any character", (character) => {
      if (this.props.disallowedCharacters?.includes(character)) return;
      this.cursorPosition++;
      this.setValue(
        this.value.slice(0, this.cursorPosition) +
          character +
          this.value.slice(this.cursorPosition)
      );
    });

    this.inputElement.on("Delete", () => {
      if (this.cursorPosition > 0) {
        this.cursorPosition--;
        this.setValue(
          this.value.slice(0, this.cursorPosition) +
            this.value.slice(this.cursorPosition + 1)
        );
      }
    });

    this.inputElement.on("Enter", () => {
      this.submit();
    });

    this.inputElement.on("Space", () => {
      if (this.props.disallowedCharacters?.includes(" ")) return;
      this.cursorPosition++;
      this.setValue(
        this.value.slice(0, this.cursorPosition) +
          " " +
          this.value.slice(this.cursorPosition)
      );
    });

    this.inputElement.on("Arrow Left", () => {
      if (this.cursorPosition > 0) {
        this.cursorPosition--;
        this.updateCursorPosition();
      }
    });

    this.inputElement.on("Arrow Right", () => {
      if (this.cursorPosition < this.value.length) {
        this.cursorPosition++;
        this.updateCursorPosition();
      }
    });

    this.inputElement.on("Mouse down", ({ x, y }) => {
      if (!this.inputElement.isFocused) {
        this.inputElement.focus();
      }
      if (x - props.label.length < 0) return;
      if (x - props.label.length > this.value.length) return;
      this.cursorPosition = x - props.label.length;
      this.updateCursorPosition();
    });
  }

  destroy() {
    this.subscriptions.unsubscribeAll();
    this.inputElement.destroy();
    this.errorElement.destroy();
    this.inputElement.clear();
    this.errorElement.clear();
  }
}
