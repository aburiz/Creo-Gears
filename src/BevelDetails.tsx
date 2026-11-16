import { bevelDimensions } from "./bevel";
import type { Project } from "./gear";
export default function BevelDetails({
  project,
  selected,
}: {
  project: Project;
  selected: number;
}) {
  const d = bevelDimensions(project, selected);
  return (
    <>
      <div>
        <span>Pitch cone angle</span>
        <strong>{((d.delta * 180) / Math.PI).toFixed(3)}°</strong>
      </div>
      <div>
        <span>Outer cone distance</span>
        <strong>{d.R.toFixed(3)} mm</strong>
      </div>
      <div>
        <span>Inner cone distance</span>
        <strong>{d.inner.toFixed(3)} mm</strong>
      </div>
      <div>
        <span>Maximum cone face width</span>
        <strong>{d.maxWidth.toFixed(2)} mm</strong>
      </div>
      <div>
        <span>Apex to outer pitch plane</span>
        <strong>{d.apex.toFixed(3)} mm</strong>
      </div>
    </>
  );
}
