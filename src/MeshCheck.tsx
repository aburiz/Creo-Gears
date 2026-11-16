import { useState } from "react";
import {
  Activity,
  CheckCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { sweepProfiles, type SweepResult } from "./mesh-check";
import type { Project } from "./gear";
export default function MeshCheck({
  project,
  onCollision,
}: {
  project: Project;
  onCollision: (angle: number) => void;
}) {
  const [result, setResult] = useState<{
      signature: string;
      value: SweepResult;
    } | null>(null),
    [busy, setBusy] = useState(false),
    signature = JSON.stringify(project),
    supported = [
      "bevel",
      "spur",
      "helical",
      "herringbone",
      "internal",
      "rack",
    ].includes(project.type),
    current = result?.signature === signature ? result.value : null;
  async function run() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      setResult({ signature, value: sweepProfiles(project) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mesh-test">
      <button
        className="button soft"
        disabled={!supported || busy}
        onClick={run}
      >
        {busy ? (
          <LoaderCircle className="spin" size={13} />
        ) : (
          <Activity size={13} />
        )}{" "}
        {busy ? "Sweeping profiles…" : "Run mesh test"}
      </button>
      {!supported ? (
        <p>
          3D tooth interference testing is not available for this concept
          family.
        </p>
      ) : current ? (
        <>
          <div className={`check-item ${current.collisions ? "error" : "ok"}`}>
            {current.collisions ? (
              <TriangleAlert size={14} />
            ) : (
              <CheckCheck size={14} />
            )}
            <span>
              {current.collisions
                ? `Overlap at ${current.collisions} of ${current.samples} sampled phases.`
                : `No overlap at ${current.samples} sampled phases.`}
            </span>
          </div>
          <p>
            {current.slices} {project.type === "bevel" ? "cone" : "axial"}{" "}
            {current.slices === 1 ? "slice" : "slices"} · one tooth cycle ·
            sampled geometry only.
          </p>
          {current.firstAngle !== null && (
            <button
              className="collision-link"
              onClick={() => onCollision(current.firstAngle!)}
            >
              Show first overlap →
            </button>
          )}
        </>
      ) : (
        <p>
          Sweep sampled profiles through a tooth cycle to look for interference.
        </p>
      )}
    </div>
  );
}
