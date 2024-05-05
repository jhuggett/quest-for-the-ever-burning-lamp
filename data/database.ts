import { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path";
import { methods } from "./database-worker";

export const createMigrationsTable = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const migrate = async (db: Database) => {
  const migrations = readdirSync(join(import.meta.dir, "db-migrations"));

  const orderedMigrations = migrations.sort((a, b) => {
    const aVersion = parseInt(a.split("_")[0]);
    const bVersion = parseInt(b.split("_")[0]);

    return aVersion - bVersion;
  });

  for (const migration of orderedMigrations) {
    const migrationName = migration.split(".")[0];

    const migrationExistsQuery = db.query(
      "SELECT * FROM migrations WHERE name = $migrationName"
    );

    const migrationExists = migrationExistsQuery.get({
      $migrationName: migrationName,
    });

    migrationExistsQuery.finalize();

    if (migrationExists) {
      continue;
    }

    const migrationFile = Bun.file(
      join(import.meta.dir, "db-migrations", migration)
    );

    db.run(await migrationFile.text());

    db.prepare("INSERT INTO migrations (name) VALUES ($migrationName)").run({
      $migrationName: migrationName,
    });
  }
};

type DBWorkerResolvedResponse = {
  id: string;
  payload: any;
};

type DBWorkerRejectedResponse = {
  id: string;
  error: any;
};

const isResolvedResponse = (
  response: DBWorkerResolvedResponse | DBWorkerRejectedResponse
): response is DBWorkerResolvedResponse => {
  return (
    (response as DBWorkerRejectedResponse).error === undefined &&
    (response as DBWorkerResolvedResponse).id !== undefined
  );
};

const isRejectedResponse = (
  response: DBWorkerResolvedResponse | DBWorkerRejectedResponse
): response is DBWorkerRejectedResponse => {
  return (response as DBWorkerRejectedResponse).error !== undefined;
};

export type DBWorkerRequest<T extends keyof typeof methods> = {
  method: T;
  payload: Parameters<(typeof methods)[T]>[0];
  id: string;
};

export const isDBWorkerRequest = (
  request: any
): request is DBWorkerRequest<keyof typeof methods> => {
  return (
    typeof request === "object" &&
    typeof request.method === "string" &&
    typeof request.id === "string"
  );
};

export class DB {
  worker: Worker;

  expectingResponses: { id: string; resolve: Function; reject: Function }[] =
    [];

  async do<T extends keyof typeof methods>(
    method: T,
    payload: Parameters<(typeof methods)[T]>[0]
  ) {
    const id = Math.random().toString(36).slice(2);
    this.worker.postMessage({ method, payload, id });

    const { promise, reject, resolve } =
      Promise.withResolvers<ReturnType<(typeof methods)[T]>>();

    this.expectingResponses.push({ id, resolve, reject });

    return promise;
  }

  constructor() {
    this.worker = new Worker(new URL("./database-worker.ts", import.meta.url));

    this.worker.addEventListener("message", (event) => {
      if (typeof event.data !== "object") {
        return;
      }

      if (isResolvedResponse(event.data)) {
        const response = this.expectingResponses.find(
          (r) => r.id === event.data.id
        );

        if (!response) {
          return;
        }

        return response.resolve(event.data.payload);
      }

      if (isRejectedResponse(event.data)) {
        const response = this.expectingResponses.find(
          (r) => r.id === event.data.id
        );

        if (!response) {
          return;
        }

        return response.reject(event.data.error);
      }
    });
  }

  async shutdown() {
    await this.do("shutdown", undefined);
  }
}

export const getDBConnection = async () => {
  const db = new DB();

  return db;
};
