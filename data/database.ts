import { Database } from "bun:sqlite";
import { readdirSync } from "fs";
import { join } from "path";
import { methods } from "../database-worker";

// @ts-ignore
import migration_1 from "./db-migrations/1_create_save_table.sql" with { type: "file" };
// @ts-ignore
import migration_2 from "./db-migrations/2_create_game_maps_table.sql" with { type: "file" };
// @ts-ignore
import migration_3 from "./db-migrations/3_create_map_tiles_table.sql" with { type: "file" };
// @ts-ignore
import migration_4 from "./db-migrations/4_create_player_table.sql" with { type: "file" };
// @ts-ignore
import migration_5 from "./db-migrations/5_create_monster_table.sql" with { type: "file" };
// @ts-ignore
import migration_6 from "./db-migrations/6_create_exit_table.sql" with { type: "file" };
// @ts-ignore
import migration_7 from "./db-migrations/7_create_items_table.sql" with { type: "file" };

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
  const migrations = [
    {name: "1_create_save_table", file: migration_1},
    {name: "2_create_game_maps_table", file: migration_2},
    {name: "3_create_map_tiles_table", file: migration_3},
    {name: "4_create_player_table", file: migration_4},
    {name: "5_create_monster_table", file: migration_5},
    {name: "6_create_exit_table", file: migration_6},
    {name: "7_create_items_table", file: migration_7},
  ]

  const orderedMigrations = migrations.sort((a, b) => {
    const aVersion = parseInt(a.name.split("_")[0]);
    const bVersion = parseInt(b.name.split("_")[0]);

    return aVersion - bVersion;
  });

  for (const migration of orderedMigrations) {
    const migrationName = migration.name.split(".")[0];

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
      migration.file
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

export const isResolvedResponse = (
  response: DBWorkerResolvedResponse | DBWorkerRejectedResponse
): response is DBWorkerResolvedResponse => {
  return (
    (response as DBWorkerRejectedResponse).error === undefined &&
    (response as DBWorkerResolvedResponse).id !== undefined
  );
};

export const isRejectedResponse = (
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
