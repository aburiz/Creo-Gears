import * as THREE from "three";
import { bevelDimensions, sphericalInvolute } from "./bevel";
import { poses, type Project } from "./gear";
import type { SweepResult } from "./mesh-check";
export function sweepBevel(p: Project, samples = 48): SweepResult {
  const dims = [bevelDimensions(p, 0), bevelDimensions(p, 1)],
    scale = 1 / (1 - p.shrinkage / 100);
  const contains = (i: number, v: THREE.Vector3) => {
    const d = dims[i],
      g = p.gears[i],
      z = d.apex - v.z,
      r = Math.hypot(v.x, v.y, z),
      rho = Math.hypot(v.x, v.y);
    if (
      r < d.inner + 1e-5 ||
      r > d.R - 1e-5 ||
      rho < (g.bore + p.boreAllowance) / 2
    )
      return false;
    const theta = Math.atan2(rho, z);
    if (theta > d.tip - 1e-6) return false;
    if (theta < d.root) return true;
    const half =
        Math.PI / (2 * g.teeth) -
        p.backlash / (4 * d.R * Math.sin(d.delta)) +
        sphericalInvolute(d.delta, d.base) -
        sphericalInvolute(Math.max(theta, d.base), d.base),
      phase = Math.atan2(v.y, v.x) * g.teeth;
    return (
      Math.abs(Math.atan2(Math.sin(phase), Math.cos(phase))) / g.teeth <
      half - 1e-6
    );
  };
  let collisions = 0,
    firstAngle: number | null = null;
  for (let k = 0; k < samples; k++) {
    const angle = ((k / samples) * 2 * Math.PI) / p.gears[0].teeth,
      pose = poses(p, angle),
      matrices = pose.map((v) =>
        new THREE.Matrix4().compose(
          new THREE.Vector3(...v.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...v.rotation)),
          new THREE.Vector3(scale, scale, scale),
        ),
      ),
      inverse = matrices[1].clone().invert(),
      d = dims[0];
    let hit = false;
    for (const f of [0.12, 0.5, 0.88]) {
      if (hit) break;
      const r = d.R - Math.min(...p.gears.map((g) => g.width)) * f;
      for (let t = 0; t <= 28 && !hit; t++)
        for (let a = 0; a <= 60 && !hit; a++) {
          const theta = d.root + ((d.tip - d.root) * t) / 28,
            phi =
              Math.PI -
              angle +
              ((a / 60 - 0.5) * Math.PI * 6) / p.gears[0].teeth,
            v = new THREE.Vector3(
              r * Math.sin(theta) * Math.cos(phi),
              r * Math.sin(theta) * Math.sin(phi),
              d.apex - r * Math.cos(theta),
            );
          if (
            contains(0, v) &&
            contains(
              1,
              v.clone().applyMatrix4(matrices[0]).applyMatrix4(inverse),
            )
          )
            hit = true;
        }
    }
    if (hit) {
      collisions++;
      firstAngle ??= angle;
    }
  }
  return { supported: true, samples, slices: 3, collisions, firstAngle };
}
