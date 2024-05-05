import Database from "bun:sqlite";
import { DBTable } from "../table";
import { MapTile } from "./map-tile";
import { astar } from "../../astar";

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
  static table = new MonstersTable();

  constructor(public props: MonsterProps) {}

  save() {
    return Monster.table.updateRow(this.props.id, this.props);
  }

  static async create(payload: CreateMonsterProps) {
    const row = await Monster.table.createRow(payload);

    if (row === null) throw new Error("Could not find created Monster");

    return new Monster(row);
  }

  static async find(id: number) {
    const row = await Monster.table.getRow(id);
    return new Monster(row as MonsterProps);
  }

  static async all() {
    const rows = await Monster.table.allRows();
    return rows.map((row) => new Monster(row as MonsterProps));
  }

  static async where(props: Partial<MonsterProps>) {
    const rows = await Monster.table.where(props);
    return rows.map((row) => new Monster(row as MonsterProps));
  }

  private tile: MapTile | undefined;
  async getTile() {
    if (!this.tile) {
      this.tile = (await MapTile.where({ id: this.props.tile_id }))[0];
    }

    return this.tile;
  }

  get cachedTile() {
    return this.tile;
  }

  setTile(tile: MapTile) {
    if (this.tile) this.tile.isOccupied = false;

    this.props.tile_id = tile.props.id;
    this.tile = tile;

    tile.isOccupied = true;
  }

  async moveTowardsPlayer(playerTile: MapTile) {
    const monsterTile = await this.getTile();

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
