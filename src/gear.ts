import * as THREE from "three";
import { bevelGeometry, bevelDimensions, bevelOutline } from "./bevel";

export type GearType =
  | "spur"
  | "helical"
  | "herringbone"
  | "bevel"
  | "spiral"
  | "internal"
  | "rack"
  | "worm"
  | "wheel";
export interface Gear {
  teeth: number;
  module: number;
  pressure: number;
  width: number;
  bore: number;
  helix: number;
  hand: number;
}
export interface Project {
  version: 1;
  name: string;
  type: GearType;
  gears: [Gear, Gear];
  backlash: number;
  boreAllowance: number;
  shrinkage: number;
  clearance: number;
  process: string;
  material: string;
  snapped: boolean;
  offset: number;
  rpm: number;
}
export const types: {
  id: GearType;
  name: string;
  description: string;
  approximate?: boolean;
}[] = [
  { id: "spur", name: "Spur", description: "Parallel shafts · straight teeth" },
  {
    id: "helical",
    name: "Helical",
    description: "Parallel shafts · angled teeth",
  },
  {
    id: "herringbone",
    name: "Herringbone",
    description: "Opposed helices · balanced thrust",
  },
  {
    id: "bevel",
    name: "Bevel",
    description: "90° shafts · spherical involute",
  },
  {
    id: "spiral",
    name: "Spiral bevel",
    description: "90° shafts · curved teeth",
    approximate: true,
  },
  { id: "internal", name: "Internal", description: "Pinion and internal ring" },
  { id: "rack", name: "Rack & pinion", description: "Rotary to linear motion" },
  {
    id: "worm",
    name: "Worm drive",
    description: "Crossed shafts · high reduction",
    approximate: true,
  },
  {
    id: "wheel",
    name: "Worm wheel",
    description: "Wheel-led worm drive",
    approximate: true,
  },
];
export const defaultGear: Gear = {
  teeth: 24,
  module: 2,
  pressure: 20,
  width: 12,
  bore: 8,
  helix: 20,
  hand: 1,
};
export const initialProject: Project = {
  version: 1,
  name: "Untitled transmission",
  type: "spur",
  gears: [
    { ...defaultGear },
    { ...defaultGear, teeth: 40, bore: 12, hand: -1 },
  ],
  backlash: 0.15,
  boreAllowance: 0.2,
  shrinkage: 0,
  clearance: 0.25,
  process: "FDM printing",
  material: "PLA",
  snapped: true,
  offset: 0,
  rpm: 12,
};
export const rad = (d: number) => (d * Math.PI) / 180;
export function transverse(g: Gear, type: GearType) {
  return ["helical", "herringbone", "wheel"].includes(type)
    ? g.module / Math.cos(rad(g.helix))
    : g.module;
}
export function pitch(g: Gear, type: GearType) {
  return transverse(g, type) * g.teeth;
}
export function effectiveType(p: Project, i: number): GearType {
  if (p.type === "internal") return i === 1 ? "internal" : "spur";
  if (p.type === "rack") return i === 1 ? "rack" : "spur";
  if (p.type === "worm") return i === 0 ? "worm" : "wheel";
  if (p.type === "wheel") return i === 0 ? "wheel" : "worm";
  return p.type;
}
export function dimensions(p: Project, i: number) {
  const g = p.gears[i],
    t = effectiveType(p, i),
    d = pitch(g, t);
  return {
    pitch: d,
    outside: ["bevel", "spiral"].includes(t)
      ? 2 * bevelDimensions(p, i).R * Math.sin(bevelDimensions(p, i).tip)
      : t === "internal"
        ? d + 2 * g.module * (1 + p.clearance) + 2 * Math.max(1, g.bore)
        : d + 2 * g.module,
    root: d - 2 * g.module * (1 + p.clearance),
    bore: g.bore + p.boreAllowance,
  };
}
const inv = (a: number) => Math.tan(a) - a;
export function profile(
  g: Gear,
  type: GearType,
  backlash: number,
  clearance: number,
): THREE.Vector2[] {
  const m = transverse(g, type),
    r = (m * g.teeth) / 2,
    alpha = Math.atan(Math.tan(rad(g.pressure)) / (m / g.module)),
    rb = r * Math.cos(alpha),
    rr = Math.max(
      m * 0.5,
      r - g.module * (type === "internal" ? 1 : 1 + clearance),
    ),
    ra = r + g.module * (type === "internal" ? 1 + clearance : 1);
  const half = Math.max(
    0.005,
    Math.PI / (2 * g.teeth) +
      ((type === "internal" ? 1 : -1) * backlash) / (4 * r),
  );
  const angle = (radius: number) =>
    half + inv(alpha) - inv(Math.acos(Math.min(1, rb / radius)));
  const pts: THREE.Vector2[] = [];
  const add = (rho: number, a: number) =>
    pts.push(new THREE.Vector2(rho * Math.cos(a), rho * Math.sin(a)));
  for (let k = 0; k < g.teeth; k++) {
    const a = (k * 2 * Math.PI) / g.teeth,
      start = Math.max(rr, rb),
      rootAngle = angle(start);
    add(rr, a - rootAngle);
    if (start > rr) add(start, a - rootAngle);
    for (let j = 1; j <= 16; j++) {
      let radius = start + ((ra - start) * j) / 16;
      add(radius, a - angle(radius));
    }
    for (let j = 1; j <= 4; j++)
      add(ra, a - angle(ra) + (2 * angle(ra) * j) / 4);
    for (let j = 15; j >= 0; j--) {
      let radius = start + ((ra - start) * j) / 16;
      add(radius, a + angle(radius));
    }
    if (start > rr) add(rr, a + rootAngle);
    const next = ((k + 1) * 2 * Math.PI) / g.teeth - rootAngle;
    for (let j = 1; j <= 4; j++)
      add(rr, a + rootAngle + ((next - a - rootAngle) * j) / 4);
  }
  return pts;
}
export function contour(
  p: Project,
  i: number,
): { outer: THREE.Vector2[]; holes: THREE.Vector2[][] } {
  const g = p.gears[i],
    type = effectiveType(p, i),
    r = pitch(g, type) / 2;
  const circle = (radius: number, n = 96) =>
    Array.from(
      { length: n },
      (_, j) =>
        new THREE.Vector2(
          radius * Math.cos((j / n) * Math.PI * 2),
          radius * Math.sin((j / n) * Math.PI * 2),
        ),
    );
  if (type === "bevel" || type === "spiral") {
    const d = bevelDimensions(p, i);
    return {
      outer: bevelOutline(p, i).map(
        (v) =>
          new THREE.Vector2(
            d.R * Math.sin(v.theta) * Math.cos(v.phi),
            d.R * Math.sin(v.theta) * Math.sin(v.phi),
          ),
      ),
      holes: g.bore > 0 ? [circle((g.bore + p.boreAllowance) / 2, 128)] : [],
    };
  }
  if (type === "rack") {
    const m = g.module,
      step = Math.PI * m,
      length = g.teeth * step,
      depth = Math.max(g.bore, 4 * m),
      h = (Math.PI * m) / 4 - p.backlash / 4,
      slope = m * Math.tan(rad(g.pressure)),
      pts: THREE.Vector2[] = [];
    pts.push(
      new THREE.Vector2(-length / 2, -depth),
      new THREE.Vector2(length / 2, -depth),
      new THREE.Vector2(length / 2, -m * (1 + p.clearance)),
    );
    for (let k = g.teeth - 1; k >= 0; k--) {
      const x = -length / 2 + (k + 0.5) * step;
      pts.push(
        new THREE.Vector2(x + h + slope, -m * (1 + p.clearance)),
        new THREE.Vector2(x + h - slope, m),
        new THREE.Vector2(x - h + slope, m),
        new THREE.Vector2(x - h - slope, -m * (1 + p.clearance)),
      );
    }
    pts.push(new THREE.Vector2(-length / 2, -m * (1 + p.clearance)));
    return { outer: pts, holes: [] };
  }
  if (type === "internal") {
    const hole = profile(g, "internal", p.backlash, p.clearance);
    return {
      outer: circle(r + g.module * (1 + p.clearance) + Math.max(1, g.bore)),
      holes: [hole],
    };
  }
  if (type === "worm") {
    const root = g.module * 4,
      starts = g.teeth,
      pts: THREE.Vector2[] = [];
    for (let j = 0; j < 240; j++) {
      const a = (j / 240) * Math.PI * 2,
        rho = root + g.module * (0.5 + 0.5 * Math.cos(a * starts));
      pts.push(new THREE.Vector2(rho * Math.cos(a), rho * Math.sin(a)));
    }
    return {
      outer: pts,
      holes: g.bore > 0 ? [circle((g.bore + p.boreAllowance) / 2)] : [],
    };
  }
  return {
    outer: profile(g, type, p.backlash, p.clearance),
    holes: g.bore > 0 ? [circle((g.bore + p.boreAllowance) / 2)] : [],
  };
}
export function geometry(p: Project, i: number) {
  if (p.type === "bevel" || p.type === "spiral") return bevelGeometry(p, i);
  const g = p.gears[i],
    t = effectiveType(p, i),
    { outer, holes } = contour(p, i),
    shape = new THREE.Shape(outer);
  holes.forEach((h) => shape.holes.push(new THREE.Path(h)));
  const twisted = [
      "helical",
      "herringbone",
      "spiral",
      "worm",
      "wheel",
    ].includes(t),
    geo = new THREE.ExtrudeGeometry(shape, {
      depth: g.width,
      steps: twisted ? 32 : 1,
      bevelEnabled: false,
      curveSegments: 32,
    });
  const pos = geo.attributes.position;
  for (let j = 0; j < pos.count; j++) {
    const z = pos.getZ(j),
      f = z / g.width;
    let x = pos.getX(j),
      y = pos.getY(j),
      angle = 0,
      scale = 1;
    if (["bevel", "spiral"].includes(t)) {
      const mate = p.gears[1 - i],
        delta = Math.atan(g.teeth / mate.teeth);
      scale = Math.max(0.15, 1 - (z * Math.tan(delta)) / (pitch(g, t) / 2));
    }
    if (t === "worm")
      angle = (z / (Math.PI * g.module * g.teeth)) * Math.PI * 2;
    else if (twisted)
      angle =
        (((t === "herringbone" ? (f <= 0.5 ? f : 1 - f) : f) *
          g.width *
          Math.tan(rad(g.helix))) /
          (pitch(g, t) / 2)) *
        g.hand;
    // Conical bores stay cylindrical. Tooth surfaces taper toward the common apex.
    const bore = (g.bore + p.boreAllowance) / 2;
    const isBore =
      g.bore > 0 &&
      Math.abs(Math.hypot(x, y) - bore) < 0.001 &&
      t !== "internal";
    if (!isBore) {
      const c = Math.cos(angle),
        s = Math.sin(angle);
      [x, y] = [(x * c - y * s) * scale, (x * s + y * c) * scale];
    }
    const compensation = 1 / (1 - p.shrinkage / 100);
    pos.setXYZ(j, x * compensation, y * compensation, z * compensation);
  }
  geo.computeVertexNormals();
  return geo;
}
export interface Pose {
  position: [number, number, number];
  rotation: [number, number, number];
}
export function centerDistance(p: Project) {
  if (["worm", "wheel"].includes(p.type)) {
    const wi = p.type === "worm" ? 0 : 1;
    return pitch(p.gears[1 - wi], "wheel") / 2 + p.gears[wi].module * 4.5;
  }
  const a = pitch(p.gears[0], effectiveType(p, 0)) / 2,
    b = pitch(p.gears[1], effectiveType(p, 1)) / 2;
  return p.type === "internal" ? b - a : a + b;
}
export function poses(p: Project, angle = 0): [Pose, Pose] {
  const g = p.gears,
    a = pitch(g[0], effectiveType(p, 0)) / 2,
    b = pitch(g[1], effectiveType(p, 1)) / 2,
    dist = centerDistance(p) + (p.snapped ? 0 : p.offset),
    ratio = g[0].teeth / g[1].teeth;
  if (p.type === "rack")
    return [
      { position: [0, 0, 0], rotation: [0, 0, -Math.PI / 2 + angle] },
      {
        position: [
          angle * a + (g[1].teeth % 2 ? (Math.PI * g[1].module) / 2 : 0),
          -a - (p.snapped ? 0 : p.offset),
          0,
        ],
        rotation: [0, 0, 0],
      },
    ];
  if (["bevel", "spiral"].includes(p.type)) {
    const scale = 1 / (1 - p.shrinkage / 100);
    return [
      { position: [0, 0, 0], rotation: [0, 0, angle] },
      {
        position: [(-a - (p.snapped ? 0 : p.offset)) * scale, 0, b * scale],
        rotation: [
          0,
          Math.PI / 2,
          ((g[0].teeth - 1) * Math.PI) / g[1].teeth - angle * ratio,
        ],
      },
    ];
  }
  if (["worm", "wheel"].includes(p.type)) {
    const wi = p.type === "worm" ? 0 : 1,
      wh = 1 - wi,
      w = g[wi],
      r = pitch(g[wh], "wheel") / 2,
      wp: Pose = {
        position: [
          -w.width / 2,
          -r - w.module * 4.5 - (p.snapped ? 0 : p.offset),
          6,
        ],
        rotation: [0, Math.PI / 2, wi === 0 ? angle : angle * ratio],
      },
      hp: Pose = {
        position: [0, 0, 0],
        rotation: [0, 0, wh === 0 ? angle : -angle * ratio],
      };
    return wi === 0 ? [wp, hp] : [hp, wp];
  }
  if (p.type === "internal")
    return [
      { position: [-dist, 0, 0], rotation: [0, 0, angle] },
      {
        position: [0, 0, 0],
        rotation: [
          0,
          0,
          Math.PI - (Math.PI * g[0].teeth) / g[1].teeth + angle * ratio,
        ],
      },
    ];
  return [
    { position: [-dist / 2, 0, 0], rotation: [0, 0, angle] },
    {
      position: [dist / 2, 0, 0],
      rotation: [0, 0, Math.PI - Math.PI / g[1].teeth - angle * ratio],
    },
  ];
}
export function issues(
  p: Project,
): { level: "error" | "warn" | "ok"; text: string }[] {
  const out: { level: "error" | "warn" | "ok"; text: string }[] = [];
  const a = p.gears[0],
    b = p.gears[1];
  if (["bevel", "spiral"].includes(p.type)) {
    p.gears.forEach((g, i) => {
      const d = bevelDimensions(p, i);
      if (g.width > d.maxWidth)
        out.push({
          level: "error",
          text: `Gear ${i ? "B" : "A"} cone face width exceeds ${d.maxWidth.toFixed(2)} mm (min of R/3 and 10m).`,
        });
      if ((g.bore + p.boreAllowance) / 2 + 1 >= d.inner * Math.sin(d.root))
        out.push({
          level: "error",
          text: `Gear ${i ? "B" : "A"} bore breaks through the small-end root. Reduce bore or face width.`,
        });
    });
  }
  if (a.module !== b.module)
    out.push({ level: "error", text: "Modules must match to mesh." });
  if (a.pressure !== b.pressure)
    out.push({ level: "error", text: "Pressure angles must match." });
  if (
    ["helical", "herringbone", "spiral"].includes(p.type) &&
    (a.helix !== b.helix || a.hand === b.hand)
  )
    out.push({
      level: "error",
      text: "Use equal helix angles and opposite hands.",
    });
  if (p.type === "internal" && b.teeth - a.teeth < 10)
    out.push({
      level: "error",
      text: "Ring needs at least 10 more teeth for this preview.",
    });
  p.gears.forEach((g, i) => {
    const t = effectiveType(p, i);
    if (
      !["internal", "rack"].includes(t) &&
      g.bore + p.boreAllowance >=
        (t === "worm" ? g.module * 8 : dimensions(p, i).root) - 2
    )
      out.push({
        level: "error",
        text: `Gear ${i ? "B" : "A"} bore leaves less than 1 mm of material.`,
      });
    if (t === "spiral" && g.width > (pitch(g, t) / 2) * 0.75)
      out.push({
        level: "warn",
        text: `Gear ${i ? "B" : "A"} face width is large for the pitch cone.`,
      });
  });
  if (
    p.gears.some(
      (g, i) =>
        !["rack", "worm", "internal"].includes(effectiveType(p, i)) &&
        g.teeth < Math.ceil(2 / Math.sin(rad(g.pressure)) ** 2),
    )
  )
    out.push({
      level: "warn",
      text: "Low tooth count: undercut may occur. Root relief is not generated.",
    });
  if (p.backlash === 0)
    out.push({ level: "warn", text: "Zero backlash may bind after printing." });
  if (p.shrinkage > 0)
    out.push({
      level: "warn",
      text: "Shrink compensation changes center distance. Scale mating hardware and mounting distances consistently.",
    });
  if (!p.snapped && Math.abs(p.offset) > 0.01)
    out.push({
      level: "warn",
      text: "Manual center offset: nominal mesh is not maintained.",
    });
  if (types.find((t) => t.id === p.type)?.approximate)
    out.push({
      level: "warn",
      text: "Concept geometry: tooth contact is approximate. Validate in CAD before manufacture.",
    });
  if (p.type === "bevel")
    out.push({
      level: "warn",
      text: "Ideal spherical involute model. Root transitions are simplified; cutter geometry and load capacity are not certified.",
    });
  if (!out.some((i) => i.level === "error"))
    out.unshift({
      level: "ok",
      text: "Nominal mating parameters are compatible.",
    });
  return out;
}
export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Project;
  const n = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  return (
    p.version === 1 &&
    types.some((t) => t.id === p.type) &&
    typeof p.name === "string" &&
    p.name.length <= 120 &&
    Array.isArray(p.gears) &&
    p.gears.length === 2 &&
    p.gears.every(
      (g) =>
        n(g.teeth, 1, 120) &&
        Number.isInteger(g.teeth) &&
        n(g.module, 0.5, 8) &&
        n(g.pressure, 14.5, 30) &&
        n(g.width, 2, 60) &&
        n(g.bore, 0, 150) &&
        n(g.helix, 0, 45) &&
        [-1, 1].includes(g.hand),
    ) &&
    n(p.backlash, 0, 1) &&
    n(p.boreAllowance, -0.5, 1) &&
    n(p.shrinkage, 0, 5) &&
    n(p.clearance, 0.1, 0.5) &&
    n(p.offset, -10, 30) &&
    n(p.rpm, 1, 60) &&
    typeof p.snapped === "boolean" &&
    ["FDM printing", "SLA printing", "CNC machining"].includes(p.process) &&
    ["PLA", "PETG", "ABS", "Nylon", "Resin", "Aluminum", "Steel"].includes(
      p.material,
    )
  );
}
