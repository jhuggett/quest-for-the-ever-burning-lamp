import Database from "bun:sqlite";
import { DBTable } from "../table";

type MapTileProps = {
  id: number;
  game_map_id: number;
  is_wall: boolean;
  x: number;
  y: number;
};

export type CreateMapTileProps = Omit<MapTileProps, "id">;

class MapTilesTable extends DBTable<CreateMapTileProps, MapTileProps> {
  tableName = "map_tiles";
}

export class MapTile {
  static table(db: Database) {
    return new MapTilesTable(db);
  }

  constructor(public props: MapTileProps) {}

  static create(db: Database, payload: CreateMapTileProps) {
    const row = MapTile.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created MapTile");

    return new MapTile(row);
  }

  static find(db: Database, id: number) {
    const row = MapTile.table(db).getRow(id);
    return new MapTile(row as MapTileProps);
  }

  static all(db: Database) {
    const rows = MapTile.table(db).allRows();
    return rows.map((row) => new MapTile(row as MapTileProps));
  }

  static where(db: Database, props: Partial<MapTileProps>) {
    const rows = MapTile.table(db).where(props);
    return rows.map((row) => new MapTile(row as MapTileProps));
  }

  distanceTo(otherTile: MapTile) {
    const distance = Math.sqrt(
      (this.props.x - otherTile.props.x) ** 2 +
        (this.props.y - otherTile.props.y) ** 2
    );
    return distance;
  }
}
