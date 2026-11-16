import * as THREE from "three";
import type { Project } from "./gear";

/** Ideal straight bevels: spherical involute flanks on cones sharing one apex.
 * Width is measured along a pitch-cone generator, not along the shaft.
 */
export function bevelDimensions(p: Project, i: number) {
  const g = p.gears[i],
    mate = p.gears[1 - i],
    delta = Math.atan(g.teeth / mate.teeth),
    R = (g.module * Math.hypot(g.teeth, mate.teeth)) / 2;
  const base = Math.asin(
    Math.sin(delta) * Math.cos((g.pressure * Math.PI) / 180),
  );
  return {
    delta,
    R,
    base,
    apex: R * Math.cos(delta),
    inner: R - g.width,
    maxWidth: Math.min(R / 3, 10 * g.module),
    tip: delta + Math.atan(g.module / R),
    root: Math.max(0.01, delta - Math.atan(((1 + p.clearance) * g.module) / R)),
  };
}
export function sphericalInvolute(theta: number, base: number) {
  const s = Math.acos(
    Math.min(1, Math.max(-1, Math.cos(theta) / Math.cos(base))),
  );
  return (
    s / Math.sin(base) - Math.atan2(Math.sin(s), Math.sin(base) * Math.cos(s))
  );
}
export function bevelOutline(p: Project, i: number) {
  const g = p.gears[i],
    d = bevelDimensions(p, i),
    half = Math.PI / (2 * g.teeth) - p.backlash / (4 * d.R * Math.sin(d.delta)),
    reference = sphericalInvolute(d.delta, d.base),
    start = Math.max(d.root, d.base);
  const flank = (theta: number) =>
    half + reference - sphericalInvolute(theta, d.base);
  const out: { theta: number; phi: number }[] = [];
  const add = (theta: number, phi: number) => out.push({ theta, phi });
  for (let k = 0; k < g.teeth; k++) {
    const c = (k * 2 * Math.PI) / g.teeth,
      rootAngle = flank(start);
    add(d.root, c - rootAngle);
    if (start > d.root) add(start, c - rootAngle);
    for (let j = 1; j <= 16; j++) {
      const t = start + ((d.tip - start) * j) / 16;
      add(t, c - flank(t));
    }
    for (let j = 1; j <= 5; j++)
      add(d.tip, c - flank(d.tip) + (2 * flank(d.tip) * j) / 5);
    for (let j = 15; j >= 0; j--) {
      const t = start + ((d.tip - start) * j) / 16;
      add(t, c + flank(t));
    }
    if (start > d.root) add(d.root, c + rootAngle);
    const next = ((k + 1) * 2 * Math.PI) / g.teeth - rootAngle;
    for (let j = 1; j < 5; j++)
      add(d.root, c + rootAngle + ((next - c - rootAngle) * j) / 5);
  }
  return out;
}
export function bevelGeometry(p: Project, i: number) {
  const g = p.gears[i],
    d = bevelDimensions(p, i),
    outline = bevelOutline(p, i),
    inner = Math.max(d.R * 0.1, d.inner),
    bore = Math.min(
      (g.bore + p.boreAllowance) / 2,
      inner * Math.sin(d.root) * 0.95,
    ),
    scale = 1 / (1 - p.shrinkage / 100),
    positions: number[] = [],
    groups: { start: number; count: number; materialIndex: number }[] = [];
  const point = (v: { theta: number; phi: number }, r: number) => {
    const twist =
        p.type === "spiral"
          ? ((g.hand * Math.tan((g.helix * Math.PI) / 180)) /
              Math.sin(d.delta)) *
            Math.log(d.R / r)
          : 0,
      phi = v.phi + twist;
    return new THREE.Vector3(
      r * Math.sin(v.theta) * Math.cos(phi),
      r * Math.sin(v.theta) * Math.sin(phi),
      d.apex - r * Math.cos(Math.max(v.theta, d.root)),
    );
  };
  const capZ = (x: number, y: number, r: number) =>
    d.apex -
    Math.sqrt(
      Math.max(0, r * r - Math.max(x * x + y * y, (r * Math.sin(d.root)) ** 2)),
    );
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    if (
      new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a))
        .lengthSq() < 1e-16
    )
      return;
    positions.push(
      ...a.toArray().map((v) => v * scale),
      ...b.toArray().map((v) => v * scale),
      ...c.toArray().map((v) => v * scale),
    );
  };
  const boreLoops: THREE.Vector3[][] = [];
  for (const [end, r] of [d.R, inner].entries()) {
    const outer = outline.map((v) => point(v, r)),
      hole =
        bore > 0
          ? Array.from(
              { length: 128 },
              (_, j) =>
                new THREE.Vector3(
                  bore * Math.cos((j / 128) * Math.PI * 2),
                  bore * Math.sin((j / 128) * Math.PI * 2),
                  capZ(0, 0, r),
                ),
            )
          : [];
    boreLoops.push(hole);
    const xy = (v: THREE.Vector3) => new THREE.Vector2(v.x, v.y),
      verts = [...outer, ...hole];
    const begin = positions.length / 3;
    for (const face of THREE.ShapeUtils.triangulateShape(
      outer.map(xy),
      hole.length ? [hole.map(xy)] : [],
    )) {
      const [a, b, c] = face.map((j) => verts[j]),
        n = 6;
      const sample = (u: number, v: number) => {
        const q = a
          .clone()
          .multiplyScalar(1 - u / n - v / n)
          .addScaledVector(b, u / n)
          .addScaledVector(c, v / n);
        q.z = capZ(q.x, q.y, r);
        return q;
      };
      const faceTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
        end === 0 ? tri(c, b, a) : tri(a, b, c);
      for (let u = 0; u < n; u++)
        for (let v = 0; v < n - u; v++) {
          faceTri(sample(u, v), sample(u + 1, v), sample(u, v + 1));
          if (u + v < n - 1)
            faceTri(sample(u + 1, v), sample(u + 1, v + 1), sample(u, v + 1));
        }
    }
    groups.push({
      start: begin,
      count: positions.length / 3 - begin,
      materialIndex: 0,
    });
  }
  const begin = positions.length / 3;
  const dense = outline.flatMap((v, j) => {
    const a = point(v, d.R),
      b = point(outline[(j + 1) % outline.length], d.R);
    return Array.from({ length: 6 }, (_, k) => {
      const q = a.clone().lerp(b, k / 6);
      return {
        theta: Math.asin(Math.hypot(q.x, q.y) / d.R),
        phi: Math.atan2(q.y, q.x),
      };
    });
  });
  for (let s = 0; s < 12; s++) {
    const r0 = d.R - ((d.R - inner) * s) / 12,
      r1 = d.R - ((d.R - inner) * (s + 1)) / 12;
    for (let j = 0; j < dense.length; j++) {
      const next = (j + 1) % dense.length,
        a = point(dense[j], r0),
        b = point(dense[next], r0),
        c = point(dense[next], r1),
        e = point(dense[j], r1);
      tri(a, b, c);
      tri(a, c, e);
    }
  }
  const bores = boreLoops.map((loop, end) =>
    loop.flatMap((a, j) =>
      Array.from({ length: 6 }, (_, k) => {
        const q = a.clone().lerp(loop[(j + 1) % loop.length], k / 6),
          r = end ? inner : d.R;
        q.z = capZ(q.x, q.y, r);
        return q;
      }),
    ),
  );
  for (let j = 0; j < bores[0].length; j++) {
    const k = (j + 1) % bores[0].length,
      a = bores[0][j],
      b = bores[0][k],
      c = bores[1][k],
      e = bores[1][j];
    tri(b, a, e);
    tri(b, e, c);
  }
  groups.push({
    start: begin,
    count: positions.length / 3 - begin,
    materialIndex: 1,
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  groups.forEach((v) => geo.addGroup(v.start, v.count, v.materialIndex));
  geo.computeVertexNormals();
  return geo;
}
export function finishBevelNormals(
  geo: THREE.BufferGeometry,
  p: Project,
  i: number,
) {
  const d = bevelDimensions(p, i),
    scale = 1 / (1 - p.shrinkage / 100),
    pos = geo.attributes.position,
    norm = geo.attributes.normal;
  for (let end = 0; end < 2; end++) {
    const group = geo.groups[end],
      r = (end ? Math.max(d.R * 0.1, d.inner) : d.R) * scale,
      root = r * Math.sin(d.root);
    for (let j = group.start; j < group.start + group.count; j++) {
      const x = pos.getX(j),
        y = pos.getY(j),
        z = pos.getZ(j);
      const n =
        Math.hypot(x, y) <= root + 1e-4
          ? new THREE.Vector3(0, 0, -1)
          : new THREE.Vector3(x, y, z - d.apex * scale).normalize();
      if (end) n.negate();
      norm.setXYZ(j, n.x, n.y, n.z);
    }
  }
  return geo;
}
