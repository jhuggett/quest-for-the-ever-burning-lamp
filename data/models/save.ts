import Database from "bun:sqlite";
import { DBTable } from "../table";
import { GameMap } from "./game-map";
import { Player } from "./player";

type SaveProps = {
  id: number;
  name: string;
  created_at: string;
};

export type CreateSaveProps = Omit<SaveProps, "id" | "created_at">;

class SavesTable extends DBTable<CreateSaveProps, SaveProps> {
  tableName = "saves";
}

export class Save {
  static table(db: Database) {
    return new SavesTable(db);
  }

  constructor(public props: SaveProps) {}

  save(db: Database) {
    Save.table(db).updateRow(this.props.id, this.props);
  }

  static create(db: Database, payload: CreateSaveProps) {
    const row = Save.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created save");

    return new Save(row);
  }

  static find(db: Database, id: number) {
    const row = Save.table(db).getRow(id);
    return new Save(row as SaveProps);
  }

  static all(db: Database) {
    const rows = Save.table(db).allRows();
    return rows.map((row) => new Save(row as SaveProps));
  }

  getGameMap(db: Database) {
    return GameMap.where(db, { save_id: this.props.id })[0];
  }

  getPlayer(db: Database) {
    return Player.where(db, { save_id: this.props.id })[0];
  }
}
