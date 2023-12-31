import Database from "bun:sqlite";
import { DBTable } from "../table";
import { MapTile } from "./map-tile";
import { XY } from "@jhuggett/terminal/xy";

type GameMapProps = {
  id: number;
  save_id: number;
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

    gameMap.generateTiles(db);

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

    while (growthPoints.length > 0 && grownPoints.length < 10000) {
      let nextGrowthPoints: XY[] = [];

      for (const growthPoint of growthPoints) {
        const key = xyToKey(growthPoint);

        if (visitedPoints.has(key)) continue;

        visitedPoints.add(key);

        const shouldGrow = Math.random() >= 0.4 || grownPoints.length === 0;

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
}
