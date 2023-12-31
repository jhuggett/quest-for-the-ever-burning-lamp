import { BunShell } from "@jhuggett/terminal";
import { getDBConnection } from "./data/database";
import { MainMenuPage } from "./pages/main-menu/main-menu";

export const db = await getDBConnection();

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

const mainMenu = new MainMenuPage(root, shell);

await mainMenu.serve();

shell.showCursor(true);

db.close();
