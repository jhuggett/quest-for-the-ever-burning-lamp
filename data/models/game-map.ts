import Database from "bun:sqlite";
import { DBTable } from "../table";
import { MapTile } from "./map-tile";
import { XY } from "@jhuggett/terminal/xy";
import { Monster, MonsterProps } from "./monster";
import { Exit } from "./exit";
import { randomlyGet } from "../../pages/main-menu/new-game";
import { Save } from "./save";
import { Item } from "./item";
import { konsole } from "../..";

type GameMapProps = {
  id: number;
  save_id: number;
  level: number;
};

export type CreateGameMapProps = Omit<GameMapProps, "id">;

class GameMapsTable extends DBTable<CreateGameMapProps, GameMapProps> {
  tableName = "game_maps";
}

export class GameMap {
  static table = new GameMapsTable();

  constructor(public props: GameMapProps) {}

  static async create(payload: CreateGameMapProps) {
    const row = await GameMap.table.createRow(payload);

    if (row === null) throw new Error("Could not find created GameMap");

    const gameMap = new GameMap(row);

    return gameMap;
  }

  static async find(id: number) {
    const row = await GameMap.table.getRow(id);
    return new GameMap(row as GameMapProps);
  }

  static async all() {
    const rows = await GameMap.table.allRows();
    return rows.map((row) => new GameMap(row as GameMapProps));
  }

  getAllTiles() {
    return MapTile.where({ game_map_id: this.props.id });
  }

  async getTilesWithinRadius(x: number, y: number, radius: number) {
    const tiles = await this.getAllTiles();

    const tilesWithinRadius = tiles.filter((tile) => {
      const distance = Math.sqrt(
        (x - tile.props.x) ** 2 + (y - tile.props.y) ** 2
      );
      return distance <= radius;
    });

    return tilesWithinRadius;
  }

  static async where(props: Partial<GameMapProps>) {
    const rows = await GameMap.table.where(props);
    return rows.map((row) => new GameMap(row as GameMapProps));
  }

  async generateTiles() {
    let grownPoints: XY[] = [];

    const visitedPoints = new Set<string>();
    const grownPointsSet = new Set<string>();

    const xyToKey = (xy: XY) => `${xy.x},${xy.y}`;
    const keyToXY = (key: string) => {
      const [x, y] = key.split(",");
      return { x: parseInt(x), y: parseInt(y) };
    };

    const adjacentPoints = (xy: XY) => {
      return [
        { x: xy.x - 1, y: xy.y },
        { x: xy.x + 1, y: xy.y },
        { x: xy.x, y: xy.y - 1 },
        { x: xy.x, y: xy.y + 1 },
      ];
    };

    let growthPoints = [{ x: 0, y: 0 }];

    while (
      growthPoints.length > 0 &&
      grownPoints.length < 1000 + 1000 * this.props.level
    ) {
      let nextGrowthPoints: XY[] = [];

      for (const growthPoint of growthPoints) {
        const key = xyToKey(growthPoint);

        if (visitedPoints.has(key)) continue;

        visitedPoints.add(key);

        const shouldGrow =
          Math.random() >= 0.4 || nextGrowthPoints.length === 0;

        if (shouldGrow) {
          grownPointsSet.add(key);
          grownPoints.push(growthPoint);

          const adjacent = adjacentPoints(growthPoint);

          for (const point of adjacent) {
            const key = xyToKey(point);

            if (visitedPoints.has(key)) continue;

            nextGrowthPoints.push(point);
          }
        }
      }

      growthPoints = nextGrowthPoints;
    }

    let wallPoints: XY[] = [];

    for (const point of grownPoints) {
      const adjacent = adjacentPoints(point);
      const adjacentWalls = adjacent.filter((point) => {
        const key = xyToKey(point);
        return !grownPointsSet.has(key);
      });

      wallPoints = [...wallPoints, ...adjacentWalls];
    }

    for (const point of wallPoints) {
      const key = xyToKey(point);

      if (grownPointsSet.has(key)) continue;
      grownPointsSet.add(key);
      grownPoints.push(point);
    }

    let wallPointsSet = new Set<string>();
    wallPoints = [];

    for (const point of grownPoints) {
      const adjacent = adjacentPoints(point);
      const adjacentWalls = adjacent.filter((point) => {
        const key = xyToKey(point);
        return !grownPointsSet.has(key);
      });

      wallPoints = [...wallPoints, ...adjacentWalls];
    }

    for (const point of wallPoints) {
      const key = xyToKey(point);

      if (grownPointsSet.has(key)) continue;
      grownPointsSet.add(key);
      grownPoints.push(point);
      wallPointsSet.add(key);
    }

    for (const point of grownPoints) {
      await MapTile.create({
        game_map_id: this.props.id,
        x: point.x,
        y: point.y,
        is_wall: wallPointsSet.has(xyToKey(point)),
      });
    }
  }

  async getMonsters() {
    const monsters = (await GameMap.table.rawQuery(
      `select monsters.* from monsters join map_tiles on monsters.tile_id = map_tiles.id join game_maps on map_tiles.game_map_id = game_maps.id where game_maps.id = ${this.props.id}`
    )) as MonsterProps[];

    return monsters.map((monster) => new Monster(monster));
  }

  async generateLevel(save: Save) {
    // create map
    konsole.log("general", "info", `Generating level ${this.props.level}`);

    konsole.log("general", "info", "Creating next map");

    const nextMap = await GameMap.create({
      save_id: save.props.id,
      level: this.props.level + 1,
    });

    konsole.log("general", "info", "Generating tiles");

    // generate tiles
    await this.generateTiles();
    const tiles = await this.getAllTiles();

    // create exit
    const exitTile = randomlyGet(tiles.filter((tile) => !tile.props.is_wall));
    konsole.log(
      "general",
      "info",
      `Creating exit ${{
        from_map_id: this.props.id,
        to_map_id: nextMap.props.id,
        from_map_tile_id: exitTile.props.id,
      }}`
    );
    await Exit.create({
      from_map_id: this.props.id,
      to_map_id: nextMap.props.id,
      from_map_tile_id: exitTile.props.id,
    });

    konsole.log("general", "info", "Creating monsters");

    // create monsters
    for (let i = 0; i < 10 + 10 * this.props.level; i++) {
      const tile = randomlyGet(tiles.filter((tile) => !tile.props.is_wall));
      await Monster.create({
        save_id: save.props.id,
        tile_id: tile.props.id,
      });
    }

    const monsters = await this.getMonsters();

    for (let i = 0; i < 10 + 10 * this.props.level; i++) {
      await Item.create({
        item_type: "oil",
        tile_id: randomlyGet(tiles.filter((tile) => !tile.props.is_wall)).props
          .id,
      });
    }

    return {
      tiles,
      monsters,
    };
  }
}

/*
--Idea--

High-Point Procedural Generation:

Randomly select coordinates, set a random elevation (between 0.0 and 1.0). Keep track of these.

Then at any point in the world, you can calculate it's elevation by calculating
the distance to each of the high points, put into some inverse square linear function, and
averaging them.

In theory you can then get elevation/land data on demand for any point in the world, only needing
reference to the "seed" high points.

In theory this would avoid the need to smoothen the data (as is the case in the Growth Based Algorithm), as it would be smooth by nature.
And it would calculate elevation up front.

*/
