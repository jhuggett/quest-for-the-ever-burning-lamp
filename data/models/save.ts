import { DBTable } from "../table";
import { GameMap } from "./game-map";
import { Player } from "./player";
import { Monster } from "./monster";

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
  static table = new SavesTable();

  constructor(public props: SaveProps) {}

  save() {
    return Save.table.updateRow(this.props.id, this.props);
  }

  static async create(payload: CreateSaveProps) {
    const row = await Save.table.createRow(payload);

    if (row === null) throw new Error("Could not find created save");

    return new Save(row);
  }

  static async find(id: number) {
    const row = await Save.table.getRow(id);
    return new Save(row as SaveProps);
  }

  static async all() {
    const rows = await Save.table.allRows();
    return rows.map((row) => new Save(row as SaveProps));
  }

  async getGameMap() {
    return (await GameMap.where({ save_id: this.props.id }))[0];
  }

  async getPlayer() {
    return (await Player.where({ save_id: this.props.id }))[0];
  }

  getMonsters() {
    return Monster.where({ save_id: this.props.id });
  }
}
