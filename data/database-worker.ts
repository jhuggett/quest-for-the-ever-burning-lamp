import Database from "bun:sqlite";
import {
  DBWorkerRequest,
  createMigrationsTable,
  isDBWorkerRequest,
  migrate,
} from "./database";

declare var self: Worker;

let jobs: DBWorkerRequest<keyof typeof methods>[] = [];
let isProcessing = false;
let isReady = false;

const onMessage = (event: MessageEvent) => {
  if (isDBWorkerRequest(event.data)) {
    jobs.push(event.data);
    processJobs();
  }
};

self.addEventListener("message", onMessage);

const processJobs = () => {
  if (isProcessing || !isReady) {
    return;
  }
  isProcessing = true;

  while (jobs.length) {
    const job = jobs.shift();

    if (!job) {
      continue;
    }

    try {
      self.postMessage({
        id: job.id,
        payload: methods[job.method](job.payload as any),
      });
    } catch (error) {
      self.postMessage({
        id: job.id,
        error,
      });
    }
  }

  isProcessing = false;
};

export const methods = {
  lastRowId: () => {
    const rowid = db.query("SELECT last_insert_rowid()").values()?.[0]?.[0];

    if (typeof rowid !== "number") {
      throw new Error("Could not get last inserted rowid");
    }

    return rowid as number;
  },
  getRow: ({ id, tableName }: { tableName: string; id: number }) => {
    const row = db
      .query(`SELECT * FROM ${tableName} WHERE id = $id`)
      .get({ $id: id });

    if (row === null) return null;

    return row;
  },
  createRow: ({ tableName, props }: { tableName: string; props: object }) => {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const columnsString = columns.join(", ");
    const columnsStringWith$ = columns.map((column) => `$${column}`).join(", ");

    db.query(
      `INSERT INTO ${tableName} (${columnsString}) VALUES (${columnsStringWith$})`
    ).run(
      Object.fromEntries(columns.map((column, i) => [`$${column}`, values[i]]))
    );

    const rowid = methods.lastRowId();

    return methods.getRow({ id: rowid, tableName });
  },
  allRows: ({ tableName }: { tableName: string }) => {
    return db.query(`SELECT * FROM ${tableName}`).all();
  },
  where: ({ props, tableName }: { tableName: string; props: object }) => {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const conditions = columns
      .map((column) => `${column} = $${column}`)
      .join(" AND ");

    const query = db.query(`SELECT * FROM ${tableName} WHERE ${conditions}`);
    const results = query.all(
      Object.fromEntries(
        columns.map((column, i) => [`$${column}`, values[i]])
      ) as any
    );

    return results;
  },
  updateRow: ({
    id,
    props,
    tableName,
  }: {
    props: object;
    tableName: string;
    id: number;
  }) => {
    const columns = Object.keys(props);
    const values = Object.values(props);

    const conditions = columns
      .map((column) => `${column} = $${column}`)
      .join(", ");

    const query = db.query(
      `UPDATE ${tableName} SET ${conditions} WHERE id = $id`
    );
    query.run(
      Object.fromEntries(
        columns.map((column, i) => [`$${column}`, values[i]])
      ) as any
    );

    return methods.getRow({
      id,
      tableName,
    });
  },
  deleteRow: ({ id, tableName }: { id: number; tableName: string }) => {
    db.query(`DELETE FROM ${tableName} WHERE id = $id`).run({ $id: id });
  },
  shutdown: () => {
    db.close();
    self.removeEventListener("message", onMessage);
  },
  rawQuery: ({ query }: { query: string }) => {
    return db.query(query).all();
  },
};

const DB_PATH = "db.sqlite";

const db = new Database(DB_PATH);

db.run(`PRAGMA foreign_keys = ON;`);

createMigrationsTable(db);

await migrate(db);

isReady = true;

processJobs();
