import Database from "bun:sqlite";
import { DBTable } from "../table";
import { GameMap } from "./game-map";

type ExitProps = {
  id: number;
  from_map_id: number;
  to_map_id: number;
  from_map_tile_id: number;
  to_map_tile_id?: number;
};

export type CreateExitProps = Omit<ExitProps, "id" | "created_at">;

class ExitsTable extends DBTable<CreateExitProps, ExitProps> {
  tableName = "exits";
}

export class Exit {
  static table(db: Database) {
    return new ExitsTable(db);
  }

  constructor(public props: ExitProps) {}

  Exit(db: Database) {
    Exit.table(db).updateRow(this.props.id, this.props);
  }

  static create(db: Database, payload: CreateExitProps) {
    const row = Exit.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created Exit");

    return new Exit(row);
  }

  static find(db: Database, id: number) {
    const row = Exit.table(db).getRow(id);
    return new Exit(row as ExitProps);
  }

  static all(db: Database) {
    const rows = Exit.table(db).allRows();
    return rows.map((row) => new Exit(row as ExitProps));
  }

  save(db: Database) {
    Exit.table(db).updateRow(this.props.id, this.props);
  }

  getToMap(db: Database) {
    const props = GameMap.table(db).getRow(this.props.to_map_id);
    if (props === null) throw new Error("Could not find to map for exit");
    return new GameMap(props);
  }
}
