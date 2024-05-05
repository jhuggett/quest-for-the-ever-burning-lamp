import { db, konsole } from "../..";
import { DBTable } from "../table";
import { Exit, ExitProps } from "./exit";
import { GameMap } from "./game-map";
import { Item, ItemProps } from "./item";
import { Monster } from "./monster";
import { Player } from "./player";

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

export class MapTileManager {
  tileMap: Map<string, MapTile> = new Map();

  tileKey(tile: MapTile) {
    return `${tile.props.x},${tile.props.y}`;
  }

  constructor(public tiles: MapTile[]) {}

  async setup({ monsters, player }: { monsters: Monster[]; player: Player }) {
    for (const tile of this.tiles) {
      this.tileMap.set(this.tileKey(tile), tile);
    }
    this.buildAdjacencies();

    for (const monster of monsters) {
      // to maintain the same tile references
      const tile = await monster.getTile();
      const monsterTile = this.getTile(tile.props.x, tile.props.y);
      if (monsterTile) monster.setTile(monsterTile);
    }

    const playerTile = await player.getTile();
    const playerMapTile = this.getTile(playerTile.props.x, playerTile.props.y);
    if (playerMapTile) player.setTile(playerMapTile);

    const mapId = playerTile.props.game_map_id;

    const items = (await db.do("rawQuery", {
      query: `select items.*, map_tiles.x,  map_tiles.y from items join map_tiles on items.tile_id = map_tiles.id join game_maps on map_tiles.game_map_id = ${mapId}`,
    })) as (ItemProps & { x: number; y: number })[];

    for (const item of items) {
      const mapTile = this.getTile(item.x, item.y);
      if (mapTile) {
        mapTile.addCachedItem(new Item(item));
      }
    }

    const exits = (await db.do("rawQuery", {
      query: `select distinct exits.*, map_tiles.x, map_tiles.y from exits join map_tiles on exits.from_map_tile_id = map_tiles.id join game_maps on map_tiles.game_map_id = ${mapId}`,
    })) as (ExitProps & { x: number; y: number })[];

    // The problem is that x and y are also being added to the exit props so when it tries to save
    // it fails because it's trying to save x and y as well which don't exist on the actual exits table.

    for (const exit of exits) {
      const mapTile = this.getTile(exit.x, exit.y);
      if (mapTile) {
        mapTile.setCachedExit(new Exit(exit));
      }
    }
  }

  getTile(x: number, y: number) {
    return this.tileMap.get(`${x},${y}`);
  }

  saveAll() {
    for (const tile of this.tiles) {
      tile.save();
    }
  }

  northOf(tile: MapTile, distance: number = 1) {
    return this.getTile(tile.props.x, tile.props.y - distance);
  }

  southOf(tile: MapTile, distance: number = 1) {
    return this.getTile(tile.props.x, tile.props.y + distance);
  }

  eastOf(tile: MapTile, distance: number = 1) {
    return this.getTile(tile.props.x + distance, tile.props.y);
  }

  westOf(tile: MapTile, distance: number = 1) {
    return this.getTile(tile.props.x - distance, tile.props.y);
  }

  buildAdjacencies() {
    for (const tile of this.tiles) {
      tile.adjacentUp = this.northOf(tile);
      tile.adjacentDown = this.southOf(tile);
      tile.adjacentLeft = this.westOf(tile);
      tile.adjacentRight = this.eastOf(tile);
    }
  }
}

export class MapTile {
  get xy() {
    return { x: this.props.x, y: this.props.y };
  }

  x() {
    return this.props.x;
  }

  y() {
    return this.props.y;
  }

  neighbors() {
    return this.adjacentTiles();
  }

  isTraversable() {
    return !this.props.is_wall && !this.isOccupied;
  }

  isOccupied = false;

  static table = new MapTilesTable();

  constructor(public props: MapTileProps) {}

  static async create(payload: CreateMapTileProps) {
    const row = await MapTile.table.createRow(payload);

    if (row === null) throw new Error("Could not find created MapTile");

    return new MapTile(row);
  }

  static async find(id: number) {
    const row = await MapTile.table.getRow(id);
    return new MapTile(row as MapTileProps);
  }

  static async all() {
    const rows = await MapTile.table.allRows();
    return rows.map((row) => new MapTile(row as MapTileProps));
  }

  static async where(props: Partial<MapTileProps>) {
    const rows = await MapTile.table.where(props);
    return rows.map((row) => new MapTile(row as MapTileProps));
  }

  distanceTo(otherTile: MapTile) {
    const distance = Math.sqrt(
      (this.props.x - otherTile.props.x) ** 2 +
        (this.props.y - otherTile.props.y) ** 2
    );
    return distance;
  }

  adjacentTiles() {
    const tiles = [];
    if (this.adjacentUp) tiles.push(this.adjacentUp);
    if (this.adjacentDown) tiles.push(this.adjacentDown);
    if (this.adjacentLeft) tiles.push(this.adjacentLeft);
    if (this.adjacentRight) tiles.push(this.adjacentRight);
    return tiles;
  }

  save() {
    return MapTile.table.updateRow(this.props.id, this.props);
  }

  private _attachedExit?: Exit | null;
  async attachedExit() {
    if (this._attachedExit === undefined) {
      // NOTE: this won't show an exit if you're on the other side of it,
      // we'd need to also check the to_map_tile_id.
      const exits = await Exit.table.where({ from_map_tile_id: this.props.id });
      if (exits.length > 0) {
        this._attachedExit = new Exit(exits[0]);
      } else {
        this._attachedExit = null;
      }
    }

    return this._attachedExit;
  }

  get cachedAttachedExit() {
    return this._attachedExit;
  }

  setCachedExit(exit: Exit) {
    this._attachedExit = exit;
  }

  private _items: Item[] | undefined;
  async getItems() {
    if (this._items === undefined) {
      this._items = (await Item.table.where({ tile_id: this.props.id })).map(
        (row) => new Item(row)
      );
    }
    return this._items;
  }

  get cachedItems() {
    return this._items;
  }

  addCachedItem(item: Item) {
    if (this._items === undefined) {
      this._items = [];
    }
    this._items.push(item);
  }

  refetchItems() {
    this._items = undefined;
    return this.getItems();
  }

  getGameMap() {
    return GameMap.table.getRow(this.props.game_map_id);
  }

  adjacentUp: MapTile | undefined | null;
  adjacentDown: MapTile | undefined | null;
  adjacentLeft: MapTile | undefined | null;
  adjacentRight: MapTile | undefined | null;
}
