import { XY } from "@jhuggett/terminal/xy";

function range(start: number, end: number) {
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

class Fraction {
  constructor(public numerator: number, public denominator: number) {}

  value() {
    return this.numerator / this.denominator;
  }

  multiply(other: Fraction) {
    return new Fraction(
      this.numerator * other.numerator,
      this.denominator * other.denominator
    );
  }
}

export const calculateFOV = (
  origin: XY,
  isBlocked: (point: XY) => boolean,
  markAsVisible: (point: XY) => void,
  maxDepth = 10
) => {
  markAsVisible(origin);

  for (const i of [0, 1, 2, 3]) {
    const quadrant = new Quadrant(i, origin);

    const reveal = ({ column, row }: Tile) => {
      markAsVisible(quadrant.transform(row, column));
    };

    const isWall = ({ column, row }: Tile) => {
      return isBlocked(quadrant.transform(row, column));
    };

    const isFloor = ({ column, row }: Tile) => {
      return !isBlocked(quadrant.transform(row, column));
    };

    const scan = (row: Row) => {
      if (row.depth > maxDepth) {
        return;
      }

      let previousTile: Tile | undefined;

      for (const tile of row.tiles()) {
        if (isWall(tile) || isSymmetric(row, tile)) {
          reveal(tile);
        }
        if (previousTile && isWall(previousTile) && isFloor(tile)) {
          row.startingSlope = slopeAt(tile);
        }
        if (previousTile && isFloor(previousTile) && isWall(tile)) {
          const nextRow = row.next();
          nextRow.endingSlope = slopeAt(tile);
          scan(nextRow);
        }
        previousTile = tile;
      }
      if (previousTile && isFloor(previousTile)) {
        scan(row.next());
      }
    };

    const firstRow = new Row(1, new Fraction(-1, 1), new Fraction(1, 1));
    scan(firstRow);
  }
};

type Tile = {
  row: number;
  column: number;
};

enum QuadrantCardinal {
  North = 0,
  East = 1,
  South = 2,
  West = 3,
}

class Quadrant {
  constructor(public cardinal: QuadrantCardinal, public origin: XY) {}

  transform(row: number, column: number) {
    switch (this.cardinal) {
      case QuadrantCardinal.North:
        return { x: this.origin.x + column, y: this.origin.y - row };
      case QuadrantCardinal.East:
        return { x: this.origin.x + row, y: this.origin.y + column };
      case QuadrantCardinal.South:
        return { x: this.origin.x + column, y: this.origin.y + row };
      case QuadrantCardinal.West:
        return { x: this.origin.x - row, y: this.origin.y + column };
    }
    throw new Error(`Invalid cardinal: ${this.cardinal}`);
  }
}

class Row {
  constructor(
    public depth: number,
    public startingSlope: Fraction,
    public endingSlope: Fraction
  ) {}

  tiles(): Tile[] {
    const minColumn = roundTiesUp(
      this.startingSlope.multiply(new Fraction(this.depth, 1))
    );
    const maxColumn = roundTiesDown(
      this.endingSlope.multiply(new Fraction(this.depth, 1))
    );

    return range(minColumn, maxColumn + 1).map((column) => ({
      row: this.depth,
      column,
    }));
  }

  next() {
    return new Row(this.depth + 1, this.startingSlope, this.endingSlope);
  }
}

const roundTiesUp = (fraction: Fraction) => {
  return Math.floor(fraction.value() + 0.5);
};

const roundTiesDown = (fraction: Fraction) => {
  return Math.ceil(fraction.value() - 0.5);
};

const slopeAt = ({ column, row }: Tile) => {
  return new Fraction(2 * column - 1, 2 * row);
};

const isSymmetric = (row: Row, tile: Tile) => {
  return (
    tile.column >=
      row.startingSlope.multiply(new Fraction(row.depth, 1)).value() &&
    tile.column <= row.endingSlope.multiply(new Fraction(row.depth, 1)).value()
  );
};
