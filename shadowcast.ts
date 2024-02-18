import { XY } from "@jhuggett/terminal/xy";

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

function range(start: number, end: number) {
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

export function getVisiblePoints(
  vantagePoint: XY,
  getAllowsLight: (point: XY) => boolean,
  maxDistance: number
) {
  const losCache = new Set<XY>();
  losCache.add(vantagePoint);
  for (const region of range(0, 8)) {
    castLight(
      losCache,
      getAllowsLight,
      vantagePoint.x,
      vantagePoint.y,
      1,
      1.0,
      0.0,
      maxDistance,
      MULT[0][region],
      MULT[1][region],
      MULT[2][region],
      MULT[3][region]
    );
  }
  return losCache;
}

function castLight(
  losCache: Set<XY>,
  getAllowsLight: (point: XY) => boolean,
  cx: number,
  cy: number,
  row: number,
  start: number,
  end: number,
  radius: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number
) {
  if (start < end) {
    return;
  }

  const radiusSquared = radius * radius;

  for (const j of range(row, radius + 1)) {
    let dx = -j - 1;
    let dy = -j;
    let blocked = false;

    let newStart;

    while (dx <= 0) {
      dx += 1;
      // Translate the dx, dy coordinates into map coordinates:
      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;
      const point = { x: X, y: Y };
      // l_slope and r_slope store the slopes of the left and right
      // extremities of the square we're considering:
      const l_slope = (dx - 0.5) / (dy + 0.5);
      const r_slope = (dx + 0.5) / (dy - 0.5);
      if (start < r_slope) {
        continue;
      } else if (end > l_slope) {
        break;
      } else {
        // Our light beam is touching this square; light it:
        losCache.add(point);
        // if (dx * dx + dy * dy < radiusSquared) {
        // }

        if (blocked) {
          // we're scanning a row of blocked squares:
          if (!getAllowsLight(point)) {
            newStart = r_slope;
            continue;
          } else {
            blocked = false;
            newStart && (start = newStart);
          }
        } else {
          if (!getAllowsLight(point) && j < radius) {
            // This is a blocking square, start a child scan:
            blocked = true;
            castLight(
              losCache,
              getAllowsLight,
              cx,
              cy,
              j + 1,
              start,
              l_slope,
              radius,
              xx,
              xy,
              yx,
              yy
            );
            newStart = r_slope;
          }
        }
      }
    }
    // Row is scanned; do next row unless last square was blocked:
    if (blocked) {
      break;
    }
  }
}
