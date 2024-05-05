import { within } from "@jhuggett/terminal/bounds/bounds";
import { LoaderComponent } from "../components/loader/loader";
import { Page } from "./page";
import { konsole } from "..";

export class LoadingPage extends Page<{
  action: (setMessage: (message: string) => void) => Promise<Page<unknown>>;
}> {
  beforeSetup() {
    const container = this.root.createChildElement(
      () => within(this.root, { paddingLeft: 4, paddingTop: 2 }),
      {}
    );

    const loader = new LoaderComponent({
      container,
      text: "Loading",
    });

    container.render();
    loader.start();

    this.props
      .action((text: string) => loader.updateText(text))
      .then((page) => {
        loader.stop();
        loader.updateText("Press ANY key to continue.");
        this.replace(page);
      })
      .catch((error) => {
        loader.stop();
        konsole.log(
          "general",
          "error",
          " while loading: " +
            ((error as any)?.message || "something went wrong")
        );

        loader.updateText("Something went wrong. Press ANY key to continue.");

        this.pop();
      });
  }
}
