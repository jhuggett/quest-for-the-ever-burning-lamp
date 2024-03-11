import Database from "bun:sqlite";
import { DBTable } from "../table";
import { MapTile } from "./map-tile";
import { XY } from "@jhuggett/terminal/xy";
import { Monster, MonsterProps } from "./monster";
import { Exit } from "./exit";
import { randomlyGet } from "../../pages/main-menu/new-game";
import { Player } from "./player";
import { Save } from "./save";
import { Item } from "./item";

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
  static table(db: Database) {
    return new GameMapsTable(db);
  }

  constructor(public props: GameMapProps) {}

  static create(db: Database, payload: CreateGameMapProps) {
    const row = GameMap.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created GameMap");

    const gameMap = new GameMap(row);

    return gameMap;
  }

  static find(db: Database, id: number) {
    const row = GameMap.table(db).getRow(id);
    return new GameMap(row as GameMapProps);
  }

  static all(db: Database) {
    const rows = GameMap.table(db).allRows();
    return rows.map((row) => new GameMap(row as GameMapProps));
  }

  getAllTiles(db: Database) {
    return MapTile.where(db, { game_map_id: this.props.id });
  }

  getTilesWithinRadius(db: Database, x: number, y: number, radius: number) {
    const tiles = this.getAllTiles(db);

    const tilesWithinRadius = tiles.filter((tile) => {
      const distance = Math.sqrt(
        (x - tile.props.x) ** 2 + (y - tile.props.y) ** 2
      );
      return distance <= radius;
    });

    return tilesWithinRadius;
  }

  static where(db: Database, props: Partial<GameMapProps>) {
    const rows = GameMap.table(db).where(props);
    return rows.map((row) => new GameMap(row as GameMapProps));
  }

  generateTiles(db: Database) {
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

    const tiles = grownPoints.map((point) => {
      return MapTile.create(db, {
        game_map_id: this.props.id,
        x: point.x,
        y: point.y,
        is_wall: wallPointsSet.has(xyToKey(point)),
      });
    });
  }

  getMonsters(db: Database) {
    const monsters = db
      .query(
        `select monsters.* from monsters join map_tiles on monsters.tile_id = map_tiles.id join game_maps on map_tiles.game_map_id = game_maps.id where game_maps.id = ${this.props.id}`
      )
      .all() as MonsterProps[];

    return monsters.map((monster) => new Monster(monster));
  }

  generateLevel(db: Database, save: Save) {
    // create map

    const nextMap = GameMap.create(db, {
      save_id: save.props.id,
      level: this.props.level + 1,
    });

    // generate tiles
    this.generateTiles(db);
    const tiles = this.getAllTiles(db);

    // create exit
    const exitTile = randomlyGet(tiles.filter((tile) => !tile.props.is_wall));
    Exit.create(db, {
      from_map_id: this.props.id,
      to_map_id: nextMap.props.id,
      from_map_tile_id: exitTile.props.id,
    });

    // create monsters
    for (let i = 0; i < 10 + 10 * this.props.level; i++) {
      const tile = randomlyGet(tiles.filter((tile) => !tile.props.is_wall));
      Monster.create(db, {
        save_id: save.props.id,
        tile_id: tile.props.id,
      });
    }

    const monsters = this.getMonsters(db);

    for (let i = 0; i < 10 + 10 * this.props.level; i++) {
      Item.create(db, {
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
