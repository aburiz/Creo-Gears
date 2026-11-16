import { test } from "node:test";
import * as THREE from "three";
import assert from "node:assert/strict";
import {
  initialProject,
  geometry,
  types,
  pitch,
  transverse,
  centerDistance,
  poses,
  issues,
  validateProject,
  type Project,
} from "../src/gear.ts";
import { stl, step, dxf } from "../src/export.ts";
import { sweepProfiles } from "../src/mesh-check.ts";
import { bevelDimensions, sphericalInvolute } from "../src/bevel.ts";

test("pitch circles and mating velocities match the tooth ratio", () => {
  const p = structuredClone(initialProject);
  assert.equal(pitch(p.gears[0], "spur"), 48);
  assert.equal(centerDistance(p), 64);
  const before = poses(p, 0),
    after = poses(p, Math.PI / 4);
  assert.ok(
    Math.abs(
      after[1].rotation[2] - before[1].rotation[2] + (Math.PI / 4) * 0.6,
    ) < 1e-10,
  );
  assert.ok(
    Math.abs(
      transverse({ ...p.gears[0], helix: 30 }, "helical") -
        2 / Math.cos(Math.PI / 6),
    ) < 1e-10,
  );
});
test("worm free spacing and displayed center distance agree with the assembly axes", () => {
  const p = structuredClone(initialProject);
  p.type = "worm";
  p.gears[0].teeth = 1;
  const first = poses(p);
  assert.equal(
    Math.abs(first[0].position[1] - first[1].position[1]),
    centerDistance(p),
  );
  p.snapped = false;
  p.offset = 3;
  assert.equal(Math.abs(poses(p)[0].position[1]), centerDistance(p) + 3);
});
for (const [z1, z2] of [
  [24, 40],
  [24, 24],
  [20, 40],
  [15, 45],
  [25, 37],
])
  test(`straight bevel ${z1}:${z2}: shared apex, rolling direction and sampled clearance`, () => {
    const p = structuredClone(initialProject);
    p.type = "bevel";
    p.gears[0].teeth = z1;
    p.gears[1].teeth = z2;
    p.gears.forEach((g) => {
      g.width = 6;
      g.bore = 4;
    });
    const a = bevelDimensions(p, 0),
      b = bevelDimensions(p, 1);
    assert.ok(Math.abs(a.delta + b.delta - Math.PI / 2) < 1e-12);
    assert.equal(a.R, b.R);
    const pose = poses(p, 0.4),
      apexA = new THREE.Vector3(0, 0, a.apex)
        .applyEuler(new THREE.Euler(...pose[0].rotation))
        .add(new THREE.Vector3(...pose[0].position)),
      apexB = new THREE.Vector3(0, 0, b.apex)
        .applyEuler(new THREE.Euler(...pose[1].rotation))
        .add(new THREE.Vector3(...pose[1].position));
    assert.ok(apexA.distanceTo(apexB) < 1e-9);
    assert.ok(poses(p, 0.5)[1].rotation[2] < pose[1].rotation[2]);
    assert.equal(sweepProfiles(p).collisions, 0);
    assert.ok(
      sphericalInvolute(a.tip, a.base) > sphericalInvolute(a.delta, a.base),
    );
  });

function family(id: Project["type"]) {
  const p = structuredClone(initialProject);
  p.type = id;
  if (id === "internal") p.gears[1].teeth = 64;
  if (id === "worm")
    p.gears[0] = { ...p.gears[0], teeth: 1, width: 40, bore: 4 };
  if (id === "wheel")
    p.gears[1] = { ...p.gears[1], teeth: 1, width: 40, bore: 4 };
  return p;
}
for (const type of types)
  test(`${type.name}: meshes are closed, consistently oriented, and finite`, () => {
    const p = family(type.id);
    for (let i = 0; i < 2; i++) {
      const geo = geometry(p, i),
        pos = geo.getAttribute("position"),
        edges = new Map<string, number>(),
        directions = new Map<string, number>();
      let volume = 0;
      const vertex = (j: number) => [pos.getX(j), pos.getY(j), pos.getZ(j)];
      const key = (v: number[]) => v.map((n) => n.toFixed(4)).join(",");
      for (let j = 0; j < pos.count; j += 3) {
        const v = [vertex(j), vertex(j + 1), vertex(j + 2)],
          keys = v.map(key);
        assert.ok(v.flat().every(Number.isFinite));
        if (new Set(keys).size < 3) continue;
        const [a, b, c] = v;
        volume +=
          (a[0] * (b[1] * c[2] - b[2] * c[1]) +
            a[1] * (b[2] * c[0] - b[0] * c[2]) +
            a[2] * (b[0] * c[1] - b[1] * c[0])) /
          6;
        for (let k = 0; k < 3; k++) {
          const a = keys[k],
            b = keys[(k + 1) % 3],
            edge = [a, b].sort().join("/");
          edges.set(edge, (edges.get(edge) || 0) + 1);
          directions.set(edge, (directions.get(edge) || 0) + (a < b ? 1 : -1));
        }
      }
      assert.ok(volume > 0, `gear ${i} positive volume`);
      assert.equal(
        [...edges.values()].filter((n) => n !== 2).length,
        0,
        `gear ${i} closed manifold`,
      );
      assert.equal(
        [...directions.values()].filter((n) => n !== 0).length,
        0,
        `gear ${i} consistent winding`,
      );
      geo.dispose();
    }
  });
test("manufacturing allowance changes physical bore and shrink dimensions", () => {
  const p = structuredClone(initialProject);
  p.boreAllowance = 0.4;
  p.shrinkage = 2;
  const geo = geometry(p, 0);
  geo.computeBoundingBox();
  assert.ok(Math.abs(geo.boundingBox!.max.z - 12 / 0.98) < 1e-5);
  const pos = geo.getAttribute("position");
  let min = Infinity;
  for (let i = 0; i < pos.count; i++)
    min = Math.min(min, Math.hypot(pos.getX(i), pos.getY(i)));
  assert.ok(Math.abs(min - 4.2 / 0.98) < 1e-5);
  geo.dispose();
});
test("mating checks detect module, pressure, hand and bore conflicts", () => {
  const p = structuredClone(initialProject);
  p.type = "helical";
  p.gears[1] = { ...p.gears[1], module: 3, pressure: 25, hand: 1, bore: 150 };
  assert.equal(issues(p).filter((c) => c.level === "error").length, 4);
});
test("profile sweep accepts nominal spur pair and detects a center-distance clash", () => {
  assert.equal(sweepProfiles(initialProject).collisions, 0);
  const p = structuredClone(initialProject);
  p.snapped = false;
  p.offset = -2;
  const clash = sweepProfiles(p);
  assert.ok(clash.collisions > 0);
  assert.equal(clash.firstAngle, 0);
  p.type = "spiral";
  assert.equal(sweepProfiles(p).supported, false);
});
for (const type of ["helical", "herringbone", "internal", "rack"] as const)
  test(`${type}: nominal mating passes the profile sweep`, () => {
    const p = family(type);
    if (type === "rack") p.gears[1].teeth = 18;
    assert.equal(sweepProfiles(p).collisions, 0);
  });
test("rack and internal phasing supports odd tooth counts", () => {
  for (const type of ["rack", "internal"] as const) {
    const p = family(type);
    p.gears[0].teeth = 25;
    p.gears[1].teeth = type === "internal" ? 65 : 19;
    assert.equal(sweepProfiles(p).collisions, 0);
  }
});
test("untrusted imported projects are bounded and finite", () => {
  assert.ok(validateProject(initialProject));
  assert.ok(!validateProject({ ...initialProject, shrinkage: 100 }));
  assert.ok(
    !validateProject({
      ...initialProject,
      gears: [
        { ...initialProject.gears[0], teeth: Infinity },
        initialProject.gears[1],
      ],
    }),
  );
  assert.ok(!validateProject({ ...initialProject, process: "unknown" }));
});
test("STL, DXF and STEP exports have units, correct triangle counts and resolved STEP references", () => {
  const p = structuredClone(initialProject),
    data = stl(p, "selected", 0),
    view = new DataView(data);
  assert.equal(data.byteLength, 84 + view.getUint32(80, true) * 50);
  const cad = step(p, "assembly", 0),
    definitions = [...cad.matchAll(/^#(\d+)=/gm)].map((m) => m[1]),
    refs = [...cad.matchAll(/#(\d+)/g)].map((m) => m[1]);
  assert.ok(refs.every((r) => definitions.includes(r)));
  assert.equal((cad.match(/FACETED_BREP\('/g) || []).length, 2);
  assert.ok(cad.includes("SI_UNIT(.MILLI.,.METRE.)"));
  assert.ok(cad.endsWith("END-ISO-10303-21;\n"));
  const drawing = dxf(p, 0);
  assert.ok(drawing.includes("$INSUNITS\r\n70\r\n4"));
  assert.equal((drawing.match(/\r\nPOLYLINE\r\n/g) || []).length, 2);
});
