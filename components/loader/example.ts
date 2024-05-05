import { BunShell, blue } from "@jhuggett/terminal";
import { within } from "@jhuggett/terminal/bounds/bounds";
import { LoaderComponent } from "./loader";
import { konsole } from "../..";

const shell = new BunShell();
shell.showCursor(false);
shell.clear();

const root = shell.rootElement;

shell.onWindowResize(() => {
  shell.invalidateCachedSize();
  shell.clear();
  root.recalculateBounds();
  shell.render();
});

shell.enableMouseTracking();

let stop = false;
root.on("Escape", () => {
  stop = true;
});

root.focus();

try {
  const container = root.createChildElement(
    () => within(root, { height: 1 }),
    {}
  );

  const loader = new LoaderComponent({
    container,
    text: "Loading",
  });

  while (!stop) {
    loader.updateText(`Loading ${Math.round(Math.random() * 100)}%`);
    shell.render();
    await shell.userInteraction();
  }

  loader.destroy();
} catch (error) {
  konsole.log(
    "general",
    "error",
    (error as any)?.message || "something went wrong"
  );
}

shell.disableMouseTracking();
