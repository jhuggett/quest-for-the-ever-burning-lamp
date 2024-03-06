import Database from "bun:sqlite";
import { DBTable } from "../table";
import { MapTile, MapTileManager } from "./map-tile";
import { astar } from "../../astar";
import { konsole } from "../..";

export type MonsterProps = {
  id: number;

  save_id: number;
  tile_id: number;
};

export type CreateMonsterProps = Omit<MonsterProps, "id" | "created_at">;

class MonstersTable extends DBTable<CreateMonsterProps, MonsterProps> {
  tableName = "monsters";
}

export class Monster {
  static table(db: Database) {
    return new MonstersTable(db);
  }

  constructor(public props: MonsterProps) {}

  save(db: Database) {
    Monster.table(db).updateRow(this.props.id, this.props);
  }

  static create(db: Database, payload: CreateMonsterProps) {
    const row = Monster.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created Monster");

    return new Monster(row);
  }

  static find(db: Database, id: number) {
    const row = Monster.table(db).getRow(id);
    return new Monster(row as MonsterProps);
  }

  static all(db: Database) {
    const rows = Monster.table(db).allRows();
    return rows.map((row) => new Monster(row as MonsterProps));
  }

  static where(db: Database, props: Partial<MonsterProps>) {
    const rows = Monster.table(db).where(props);
    return rows.map((row) => new Monster(row as MonsterProps));
  }

  private tile: MapTile | undefined;
  getTile(db: Database) {
    if (!this.tile) {
      this.tile = MapTile.where(db, { id: this.props.tile_id })[0];
    }

    return this.tile;
  }

  setTile(tile: MapTile) {
    if (this.tile) this.tile.isOccupied = false;

    this.props.tile_id = tile.props.id;
    this.tile = tile;

    tile.isOccupied = true;
  }

  moveTowardsPlayer(db: Database, playerTile: MapTile) {
    const monsterTile = this.getTile(db);

    if (!monsterTile) return;

    // const adjacentTiles = monsterTile.adjacentTiles(db);

    // if (adjacentTiles.length === 0) return;

    // const closestTile = adjacentTiles.sort((a, b) => {
    //   const distanceToA = a.distanceTo(playerTile);
    //   const distanceToB = b.distanceTo(playerTile);

    //   return distanceToA - distanceToB;
    // })[0];

    // if (closestTile.props.is_wall) return;

    // this.setTile(closestTile);

    const path = astar(monsterTile, playerTile, 500);

    if (!path || path.length < 1) {
      const adjacentTiles = monsterTile.adjacentTiles();

      if (adjacentTiles.length === 0) return;

      const closestTile = adjacentTiles.sort((a, b) => {
        const distanceToA = a.distanceTo(playerTile);
        const distanceToB = b.distanceTo(playerTile);

        return distanceToA - distanceToB;
      })[0];

      if (!closestTile.isTraversable()) return;

      this.setTile(closestTile);
      return;
    }

    this.setTile(path[0]);

    // TODO: use astar
  }
}
