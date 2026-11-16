import {
  contour,
  effectiveType,
  poses,
  rad,
  pitch,
  type Project,
} from "./gear";
import { sweepBevel } from "./bevel-check";
type Point = { x: number; y: number };
type Segment = {
  a: Point;
  b: Point;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
export interface SweepResult {
  supported: boolean;
  collisions: number;
  samples: number;
  slices: number;
  firstAngle: number | null;
}
const segment = (a: Point, b: Point): Segment => ({
  a,
  b,
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: Segment, b: Segment) {
  if (
    a.maxX <= b.minX ||
    b.maxX <= a.minX ||
    a.maxY <= b.minY ||
    b.maxY <= a.minY
  )
    return false;
  const e = 1e-7;
  return (
    cross(a.a, a.b, b.a) * cross(a.a, a.b, b.b) < -e &&
    cross(b.a, b.b, a.a) * cross(b.a, b.b, a.b) < -e
  );
}
function inside(point: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
function overlaps(a: Point[][], b: Point[][], cell: number) {
  const buckets = new Map<string, Segment[]>();
  const visit = (s: Segment, fn: (key: string) => void) => {
    for (let x = Math.floor(s.minX / cell); x <= Math.floor(s.maxX / cell); x++)
      for (
        let y = Math.floor(s.minY / cell);
        y <= Math.floor(s.maxY / cell);
        y++
      )
        fn(`${x},${y}`);
  };
  for (const loop of b)
    for (let i = 0; i < loop.length; i++) {
      const s = segment(loop[i], loop[(i + 1) % loop.length]);
      visit(s, (key) => {
        const list = buckets.get(key) || [];
        list.push(s);
        buckets.set(key, list);
      });
    }
  for (const loop of a)
    for (let i = 0; i < loop.length; i++) {
      let hit = false;
      const s = segment(loop[i], loop[(i + 1) % loop.length]);
      visit(s, (key) => {
        if (!hit) hit = (buckets.get(key) || []).some((t) => intersects(s, t));
      });
      if (hit) return true;
    }
  const solid = (v: Point, loops: Point[][]) =>
    inside(v, loops[0]) && !loops.slice(1).some((h) => inside(v, h));
  return (
    a[0]
      .filter((_, i) => i % Math.max(1, Math.floor(a[0].length / 4)) === 0)
      .some((v) => solid(v, b)) ||
    b[0]
      .filter((_, i) => i % Math.max(1, Math.floor(b[0].length / 4)) === 0)
      .some((v) => solid(v, a))
  );
}
/** Sampled polygon interference check. This is not continuous collision detection. */
export function sweepProfiles(p: Project, samples = 48): SweepResult {
  if (p.type === "bevel") return sweepBevel(p, samples);
  if (!["spur", "helical", "herringbone", "internal", "rack"].includes(p.type))
    return {
      supported: false,
      collisions: 0,
      samples: 0,
      slices: 0,
      firstAngle: null,
    };
  const bases = [contour(p, 0), contour(p, 1)].map((c) => [
      c.outer,
      ...c.holes,
    ]),
    height = Math.min(...p.gears.map((g) => g.width)),
    twisted = ["helical", "herringbone"].includes(p.type),
    slices = twisted ? [0, height / 2, height] : [0];
  if (p.type === "herringbone")
    slices.push(...p.gears.map((g) => g.width / 2).filter((z) => z < height));
  let collisions = 0,
    firstAngle: number | null = null;
  for (let phase = 0; phase < samples; phase++) {
    const angle = ((phase / samples) * Math.PI * 2) / p.gears[0].teeth,
      placements = poses(p, angle);
    let collision = false;
    for (const z of slices) {
      const loops = bases.map((base, i) => {
        const g = p.gears[i],
          pose = placements[i],
          f = z / g.width,
          twist = twisted
            ? (((p.type === "herringbone" ? (f <= 0.5 ? f : 1 - f) : f) *
                g.width *
                Math.tan(rad(g.helix))) /
                (pitch(g, effectiveType(p, i)) / 2)) *
              g.hand
            : 0,
          rotation = pose.rotation[2] + twist,
          cos = Math.cos(rotation),
          sin = Math.sin(rotation),
          scale = 1 / (1 - p.shrinkage / 100);
        return base.map((loop) =>
          loop.map((v) => ({
            x: (v.x * cos - v.y * sin) * scale + pose.position[0],
            y: (v.x * sin + v.y * cos) * scale + pose.position[1],
          })),
        );
      });
      if (overlaps(loops[0], loops[1], p.gears[0].module * 4)) {
        collision = true;
        break;
      }
    }
    if (collision) {
      collisions++;
      if (firstAngle === null) firstAngle = angle;
    }
  }
  return {
    supported: true,
    collisions,
    samples,
    slices: new Set(slices).size,
    firstAngle,
  };
}
