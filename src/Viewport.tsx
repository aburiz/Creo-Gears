import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { geometry, poses, pitch, effectiveType, type Project } from "./gear";
import { finishBevelNormals } from "./bevel";

interface Props {
  project: Project;
  selected: number;
  onSelect: (i: number) => void;
  playing: boolean;
  wire: boolean;
  showPitch: boolean;
  view: string;
  reset: number;
  onAngle: (n: number) => void;
  phase: React.RefObject<number>;
}
function Part({
  project,
  index,
  selected,
  onSelect,
  phase,
  wire,
  showPitch,
  geo,
}: {
  project: Project;
  index: number;
  selected: number;
  onSelect: (i: number) => void;
  phase: React.RefObject<number>;
  wire: boolean;
  showPitch: boolean;
  geo: THREE.BufferGeometry;
}) {
  const group = useRef<THREE.Group>(null),
    g = project.gears[index],
    t = effectiveType(project, index),
    r = pitch(g, t) / 2;
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(64, 64, 53, 0, Math.PI * 2);
    ctx.fillStyle = selected === index ? "#faf9ef" : "#fffffff0";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = selected === index ? "#b6a675" : "#b8c6af";
    ctx.stroke();
    ctx.fillStyle = selected === index ? "#8c793d" : "#657761";
    ctx.font = "500 49px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(index ? "B" : "A", 64, 66);
    return new THREE.CanvasTexture(canvas);
  }, [index, selected]);
  useEffect(() => () => label.dispose(), [label]);
  useFrame(() => {
    if (group.current) {
      const p = poses(project, phase.current)[index];
      group.current.position.set(...p.position);
      group.current.rotation.set(...p.rotation);
    }
  });
  const ring = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints(
        Array.from(
          { length: 161 },
          (_, j) =>
            new THREE.Vector3(
              Math.cos((j / 160) * Math.PI * 2) * r,
              Math.sin((j / 160) * Math.PI * 2) * r,
              ["bevel", "spiral"].includes(t) ? 0 : g.width + 0.2,
            ),
        ),
      ),
    [r, g.width, t],
  );
  useEffect(() => () => ring.dispose(), [ring]);
  return (
    <group ref={group}>
      <mesh
        geometry={geo}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          attach="material-0"
          color={index === 0 ? "#c5a15a" : "#477d79"}
          metalness={0.68}
          roughness={0.3}
          envMapIntensity={0.8}
          wireframe={wire}
        />
        <meshStandardMaterial
          attach="material-1"
          color={index === 0 ? "#c5a15a" : "#477d79"}
          metalness={0.68}
          roughness={0.3}
          envMapIntensity={0.8}
          wireframe={wire}
        />
      </mesh>
      {showPitch && !["rack", "worm"].includes(t) && (
        <lineLoop geometry={ring}>
          <lineDashedMaterial
            color={index === 0 ? "#85682d" : "#225e57"}
            transparent
            opacity={0.5}
          />
        </lineLoop>
      )}
      <sprite
        position={[0, t === "rack" ? -6 : 0, g.width + 3]}
        scale={[7, 7, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        renderOrder={10}
      >
        <spriteMaterial map={label} depthTest={false} transparent />
      </sprite>
    </group>
  );
}
function World(props: Props) {
  const { project, playing, phase, view, reset, onAngle } = props,
    controls = useRef<any>(null),
    { camera, size } = useThree();
  const signature = JSON.stringify([
    project.type,
    project.gears,
    project.backlash,
    project.clearance,
    project.boreAllowance,
    project.shrinkage,
  ]);
  const meshes = useMemo(
    () =>
      [0, 1].map((i) => {
        const raw = geometry(project, i),
          smooth = toCreasedNormals(raw, Math.PI / 5);
        if (raw !== smooth) raw.dispose();
        if (["bevel", "spiral"].includes(project.type))
          finishBevelNormals(smooth, project, i);
        return smooth;
      }),
    [signature],
  );
  useEffect(() => () => meshes.forEach((g) => g.dispose()), [meshes]);
  const bounds = useMemo(() => {
    const box = new THREE.Box3(),
      pose = poses(project);
    meshes.forEach((geo, i) => {
      geo.computeBoundingBox();
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...pose[i].position),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...pose[i].rotation),
        ),
        new THREE.Vector3(1, 1, 1),
      );
      box.union(geo.boundingBox!.clone().applyMatrix4(matrix));
    });
    return box;
  }, [meshes, project.snapped, project.offset]);
  const floor = bounds.min.z - 2;
  useEffect(() => {
    const center = bounds.getCenter(new THREE.Vector3()),
      aspect = size.width / size.height,
      fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const direction = new THREE.Vector3(
        ...((view === "top"
          ? [0, -0.001, 1]
          : view === "front"
            ? [0, -1, 0.08]
            : ["bevel", "spiral"].includes(project.type)
              ? [1.4, -2, 1.05]
              : [0.7, -1, 1.4]) as [number, number, number]),
      ).normalize(),
      right = new THREE.Vector3(0, 0, 1).cross(direction).normalize(),
      up = direction.clone().cross(right),
      v = new THREE.Vector3(),
      placement = poses(project);
    let distance = 25;
    meshes.forEach((geo, i) => {
      const pose = placement[i],
        matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(...pose.position),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(...pose.rotation),
          ),
          new THREE.Vector3(1, 1, 1),
        ),
        pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        v.fromBufferAttribute(pos, j).applyMatrix4(matrix).sub(center);
        distance = Math.max(
          distance,
          v.dot(direction) +
            (Math.abs(v.dot(right)) / (Math.tan(fov / 2) * aspect)) * 1.25,
          v.dot(direction) + (Math.abs(v.dot(up)) / Math.tan(fov / 2)) * 1.25,
        );
      }
    });
    camera.up.set(0, 0, 1);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.update();
    }
  }, [camera, view, reset, bounds, size.width, size.height]);
  let tick = 0;
  useFrame((_, delta) => {
    if (playing)
      phase.current += (Math.min(delta, 0.05) * project.rpm * Math.PI) / 30;
    tick += delta;
    if (tick > 0.12) {
      onAngle(phase.current);
      tick = 0;
    }
  });
  return (
    <>
      <color attach="background" args={["#eef1ee"]} />
      <ambientLight intensity={0.8} />
      <Environment resolution={128}>
        <Lightformer
          position={[0, 0, 100]}
          intensity={3}
          scale={[100, 70, 1]}
        />
        <Lightformer
          position={[0, -80, 40]}
          rotation={[Math.PI / 2, 0, 0]}
          intensity={2}
          scale={[120, 30, 1]}
        />
        <Lightformer
          position={[80, 40, 30]}
          rotation={[0, -Math.PI / 2, 0]}
          intensity={3}
          scale={[60, 90, 1]}
        />
      </Environment>
      <directionalLight
        position={[-80, -100, 180]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-220}
        shadow-camera-right={220}
        shadow-camera-top={220}
        shadow-camera-bottom={-220}
        shadow-bias={-0.0001}
        shadow-normalBias={0.06}
        shadow-radius={4}
      />
      <directionalLight
        position={[90, 80, 70]}
        intensity={1.5}
        color="#e9f7ff"
      />
      <Grid
        args={[1000, 1000]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, floor + 0.1]}
        side={THREE.DoubleSide}
        cellSize={5}
        cellThickness={0.6}
        cellColor="#cdd1c6"
        sectionSize={25}
        sectionThickness={0.85}
        sectionColor="#bec5b9"
        fadeDistance={500}
        fadeStrength={1.8}
        infiniteGrid
      />
      <mesh position={[0, 0, floor]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <shadowMaterial transparent opacity={0.09} depthWrite={false} />
      </mesh>
      {[0, 1].map((index) => (
        <Part key={index} {...props} geo={meshes[index]} index={index} />
      ))}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        minDistance={25}
        maxDistance={1000}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  );
}
export default function Viewport(props: Props) {
  return (
    <Canvas
      shadows
      camera={{ fov: 35, near: 0.1, far: 4000, up: [0, 0, 1] }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}
