import Database from "bun:sqlite";
import { DBTable } from "../table";
import { GameMap } from "./game-map";

export type ExitProps = {
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
  static table = new ExitsTable();

  props: ExitProps;
  constructor(props: ExitProps) {
    this.props = {
      id: props.id,
      from_map_id: props.from_map_id,
      to_map_id: props.to_map_id,
      from_map_tile_id: props.from_map_tile_id,
      to_map_tile_id: props.to_map_tile_id,
    };
  }

  Exit() {
    Exit.table.updateRow(this.props.id, this.props);
  }

  static async create(payload: CreateExitProps) {
    const row = await Exit.table.createRow(payload);

    if (row === null) throw new Error("Could not find created Exit");

    return new Exit(row);
  }

  static async find(id: number) {
    const row = await Exit.table.getRow(id);
    return new Exit(row as ExitProps);
  }

  static async all() {
    const rows = await Exit.table.allRows();
    return rows.map((row) => new Exit(row as ExitProps));
  }

  save() {
    return Exit.table.updateRow(this.props.id, this.props);
  }

  async getToMap() {
    const props = await GameMap.table.getRow(this.props.to_map_id);
    if (props === null) throw new Error("Could not find to map for exit");
    return new GameMap(props);
  }
}
