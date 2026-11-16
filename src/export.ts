import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { contour, geometry, poses, type Project } from "./gear";
export function download(
  data: BlobPart,
  name: string,
  type = "application/octet-stream",
) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportMeshes(
  p: Project,
  scope: "selected" | "assembly",
  selected: number,
) {
  const group = new THREE.Group(),
    placements = poses(p);
  (scope === "assembly" ? [0, 1] : [selected]).forEach((i) => {
    const mesh = new THREE.Mesh(geometry(p, i));
    if (scope === "assembly") {
      mesh.position.set(...placements[i].position);
      mesh.rotation.set(...placements[i].rotation);
    }
    mesh.name = `Gear_${i ? "B" : "A"}`;
    group.add(mesh);
  });
  group.updateMatrixWorld(true);
  return group;
}
export function stl(
  p: Project,
  scope: "selected" | "assembly",
  selected: number,
) {
  const group = exportMeshes(p, scope, selected),
    data = new STLExporter().parse(group, { binary: true });
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  return data.buffer as ArrayBuffer;
}
export function dxf(p: Project, selected: number) {
  const { outer, holes } = contour(p, selected),
    scale = 1 / (1 - p.shrinkage / 100);
  const out = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  [outer, ...holes].forEach((points, i) => {
    out.push(
      "0",
      "POLYLINE",
      "8",
      i ? "BORE" : "PROFILE",
      "66",
      "1",
      "70",
      "1",
    );
    points.forEach((v) =>
      out.push(
        "0",
        "VERTEX",
        "8",
        i ? "BORE" : "PROFILE",
        "10",
        (v.x * scale).toFixed(6),
        "20",
        (v.y * scale).toFixed(6),
        "30",
        "0",
      ),
    );
    out.push("0", "SEQEND");
  });
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\r\n");
}
// ISO 10303-21 / AP214 faceted B-rep. A closed shell is exported per part.
// Faces are triangles, not analytical involute surfaces or a feature tree.
export function step(
  p: Project,
  scope: "selected" | "assembly",
  selected: number,
) {
  const lines: string[] = [];
  const add = (v: string) => {
    lines.push(`#${lines.length + 1}=${v};`);
    return `#${lines.length}`;
  };
  const app = add("APPLICATION_CONTEXT('automotive design')");
  add(
    `APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${app})`,
  );
  const pc = add(`PRODUCT_CONTEXT('',${app},'mechanical')`),
    product = add(
      `PRODUCT('Gearforge','Gear assembly','Millimetres; faceted geometry',(${pc}))`,
    ),
    formation = add(`PRODUCT_DEFINITION_FORMATION('1','',${product})`),
    dc = add(`PRODUCT_DEFINITION_CONTEXT('part definition',${app},'design')`),
    pd = add(`PRODUCT_DEFINITION('design','',${formation},${dc})`),
    pds = add(`PRODUCT_DEFINITION_SHAPE('','',${pd})`);
  const length = add("(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))"),
    angle = add("(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))"),
    solidAngle = add(
      "(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())",
    ),
    uncertainty = add(
      `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-6),${length},'distance_accuracy_value','')`,
    ),
    context = add(
      `(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${length},${angle},${solidAngle})) REPRESENTATION_CONTEXT('',''))`,
    );
  const group = exportMeshes(p, scope, selected),
    solids: string[] = [];
  group.children.forEach((obj) => {
    const mesh = obj as THREE.Mesh,
      geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
      pos = geo.getAttribute("position"),
      idx = geo.getIndex(),
      count = idx ? idx.count : pos.count,
      vertices = new Map<string, string>(),
      faces: string[] = [];
    for (let k = 0; k < count; k += 3) {
      const refs: string[] = [];
      for (let j = 0; j < 3; j++) {
        const v = idx ? idx.getX(k + j) : k + j,
          xyz = [pos.getX(v), pos.getY(v), pos.getZ(v)].map((n) =>
            Math.abs(n) < 1e-7 ? "0." : n.toFixed(6),
          ),
          key = xyz.join(",");
        if (!vertices.has(key))
          vertices.set(key, add(`CARTESIAN_POINT('',(${key}))`));
        refs.push(vertices.get(key)!);
      }
      if (new Set(refs).size !== 3) continue;
      const loop = add(`POLY_LOOP('',(${refs.join(",")}))`),
        bound = add(`FACE_OUTER_BOUND('',${loop},.T.)`);
      faces.push(add(`FACE('',(${bound}))`));
    }
    const shell = add(`CLOSED_SHELL('',(${faces.join(",")}))`);
    solids.push(add(`FACETED_BREP('${mesh.name}',${shell})`));
    geo.dispose();
    mesh.geometry.dispose();
  });
  const representation = add(
    `FACETED_BREP_SHAPE_REPRESENTATION('',(${solids.join(",")}),${context})`,
  );
  add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${representation})`);
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Gearforge faceted B-rep; units mm'),'2;1');\nFILE_NAME('gearforge.step','${new Date().toISOString()}',('Gearforge'),(''),'Gearforge','Gearforge','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
