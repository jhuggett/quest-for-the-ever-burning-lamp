import { BunShell } from "@jhuggett/terminal";
import { MainMenuPage } from "./pages/main-menu/main-menu";
import { Debug } from "./debug";
import { isResolvedResponse, isRejectedResponse } from "./data/database";
import { methods, overridePostMessage, sendJob } from "./database-worker";

export class DB {
  expectingResponses: { id: string; resolve: Function; reject: Function }[] =
    [];

  async do<T extends keyof typeof methods>(
    method: T,
    payload: Parameters<(typeof methods)[T]>[0]
  ) {
    const id = Math.random().toString(36).slice(2);
    // this.worker.postMessage({ method, payload, id });

    const { promise, reject, resolve } =
      Promise.withResolvers<ReturnType<(typeof methods)[T]>>();

    this.expectingResponses.push({ id, resolve, reject });

    sendJob({ method, payload, id });
    return promise;
  }

  constructor() {
    //this.worker = new Worker("database-worker.js");
    // this.worker = new FakeWorker();

    // Worker;

    overridePostMessage((payload: any) => {
      if (isResolvedResponse(payload)) {
        const response = this.expectingResponses.find(
          (r) => r.id === payload.id
        );

        if (!response) {
          return;
        }

        return response.resolve(payload.payload);
      }

      if (isRejectedResponse(payload)) {
        const response = this.expectingResponses.find(
          (r) => r.id === payload.id
        );

        if (!response) {
          return;
        }

        return response.reject(payload.error);
      }
    });

    // this.worker.addEventListener("message", (event) => {
    //   if (typeof event.data !== "object") {
    //     return;
    //   }

    //   if (isResolvedResponse(event.data)) {
    //     const response = this.expectingResponses.find(
    //       (r) => r.id === event.data.id
    //     );

    //     if (!response) {
    //       return;
    //     }

    //     return response.resolve(event.data.payload);
    //   }

    //   if (isRejectedResponse(event.data)) {
    //     const response = this.expectingResponses.find(
    //       (r) => r.id === event.data.id
    //     );

    //     if (!response) {
    //       return;
    //     }

    //     return response.reject(event.data.error);
    //   }
    // });
  }

  async shutdown() {
    await this.do("shutdown", undefined);
  }
}

export const getDBConnection = async () => {
  const db = new DB();

  return db;
};

export const db = await getDBConnection();
export const konsole = new Debug();

// @ts-ignore
//console = konsole;

const shell = new BunShell();

shell.overrideRenderBatchSize(2000);

shell.showCursor(false);
shell.clear();

const root = shell.rootElement;

shell.onWindowResize(() => {
  shell.invalidateCachedSize();
  shell.clear();
  root.recalculateBounds();
  shell.render();
});

export const debugMode = false;

let content = root.createChildElement(() => {
  return {
    start: {
      x: root.bounds.globalStart.x,
      y: root.bounds.globalStart.y,
    },
    end: {
      x: root.bounds.globalEnd.x,
      y: root.bounds.globalEnd.y,
    },
  };
}, {});

if (debugMode) {
  content = root.createChildElement(() => {
    return {
      start: {
        x: root.bounds.globalStart.x,
        y: root.bounds.globalStart.y,
      },
      end: {
        x: Math.floor(root.bounds.globalEnd.x / 2),
        y: root.bounds.globalEnd.y,
      },
    };
  }, {});

  const debugElement = root.createChildElement(() => {
    return {
      start: {
        x: Math.floor(root.bounds.globalEnd.x / 2),
        y: root.bounds.globalStart.y,
      },
      end: {
        x: root.bounds.globalEnd.x,
        y: root.bounds.globalEnd.y,
      },
    };
  }, {});

  konsole.registerElement(debugElement);
}

const mainMenu = new MainMenuPage(content, shell);

try {
  await mainMenu.serve();
} catch (error) {
  console.error(error);
}

shell.showCursor(true);

db.shutdown();
