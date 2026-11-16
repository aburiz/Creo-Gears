import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Crosshair,
  Expand,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  Layers2,
  Link2,
  LoaderCircle,
  Maximize,
  MousePointer2,
  Move3D,
  Orbit,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Unlink2,
  X,
} from "lucide-react";
import Viewport from "./Viewport";
import BevelDetails from "./BevelDetails";
import MeshCheck from "./MeshCheck";
import {
  initialProject,
  types,
  dimensions,
  effectiveType,
  pitch,
  centerDistance,
  contour,
  issues,
  validateProject,
  type Gear,
  type GearType,
  type Project,
} from "./gear";
import { download, dxf, stl, step } from "./export";

const storageKey = "gearforge-project-v1";
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) || "null");
    return validateProject(v) ? v : structuredClone(initialProject);
  } catch {
    return structuredClone(initialProject);
  }
}
function GearIcon({
  kind = "spur",
  size = 31,
}: {
  kind?: string;
  size?: number;
}) {
  const path = Array.from({ length: 64 }, (_, j) => {
    const a = (j * Math.PI) / 32,
      r = [0, 3].includes(j % 8) ? 10 : 13;
    return `${Math.cos(a) * r + 18},${Math.sin(a) * r + 18}`;
  }).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "rack" ? (
        <>
          <path d="M3 29V20h3v-6h4v6h5v-6h4v6h5v-6h4v6h5v9Z" />
          <path d="M10 7h16M13 3v8M18 3v8M23 3v8" />
        </>
      ) : kind === "worm" ? (
        <>
          <path d="M5 15h26v9H5zM9 12l4 15m2-15 4 15m2-15 4 15m2-15 4 15M1 19h4m26 0h4" />
        </>
      ) : (
        <>
          <polygon points={path} />
          <circle cx="18" cy="18" r={kind === "internal" ? 8 : 4} />
          {["helical", "herringbone", "spiral"].includes(kind) && (
            <path
              d={
                kind === "herringbone"
                  ? "M12 9l4 3-4 3m9 7 4 3-4 3"
                  : "M12 9l-3 5m17 8-3 5"
              }
            />
          )}{" "}
          {["bevel", "spiral"].includes(kind) && (
            <ellipse cx="18" cy="18" rx="10" ry="6" />
          )}
        </>
      )}
    </svg>
  );
}
function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState(String(value)),
    inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);
  const normalize = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return value;
    const bounded = Math.max(min, Math.min(max, parsed));
    return step === 1 ? Math.round(bounded) : Math.round(bounded / step) * step;
  };
  return (
    <label className="field">
      <span>
        {label}
        {hint && (
          <span className="field-hint" title={hint}>
            i
          </span>
        )}
      </span>
      <div className="number-wrap">
        <input
          ref={inputRef}
          aria-label={label}
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed >= min && parsed <= max)
              onChange(parsed);
          }}
          onBlur={() => {
            const next = normalize(draft);
            setDraft(String(next));
            if (next !== value) onChange(next);
          }}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
function Profile({ p, selected }: { p: Project; selected: number }) {
  const { outer, holes } = contour(p, selected),
    all = [outer, ...holes],
    xs = outer.map((v) => v.x),
    ys = outer.map((v) => v.y),
    minX = Math.min(...xs),
    minY = Math.min(...ys),
    w = Math.max(...xs) - minX,
    h = Math.max(...ys) - minY;
  return (
    <div className="profile-view">
      <svg viewBox={`${minX - 10} ${minY - 10} ${w + 20} ${h + 20}`}>
        <defs>
          <pattern
            id="profilegrid"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <path d="M5 0H0V5" fill="none" stroke="#cdd3c9" strokeWidth=".1" />
          </pattern>
        </defs>
        <rect
          x={minX - 10}
          y={minY - 10}
          width={w + 20}
          height={h + 20}
          fill="url(#profilegrid)"
        />
        <g transform="scale(1,-1)">
          <path
            d={all
              .map(
                (points) =>
                  "M" + points.map((v) => `${v.x},${v.y}`).join("L") + "Z",
              )
              .join(" ")}
            fill={selected ? "#548d8633" : "#cfaa5d44"}
            fillRule="evenodd"
            stroke={selected ? "#39736b" : "#977332"}
            strokeWidth=".25"
          />
          <circle
            r={pitch(p.gears[selected], effectiveType(p, selected)) / 2}
            stroke="#53776d"
            strokeWidth=".15"
            strokeDasharray="1 1"
            fill="none"
          />
          <path
            d={`M${minX - 5},0 H${minX + w + 5} M0,${minY - 5} V${minY + h + 5}`}
            stroke="#879b8e"
            strokeWidth=".1"
          />
        </g>
      </svg>
      <span>GEAR {selected ? "B" : "A"} · LARGE-END PROFILE · mm</span>
    </div>
  );
}
export default function App() {
  const [p, setP] = useState<Project>(load),
    [selected, setSelected] = useState(0),
    [tab, setTab] = useState("geometry"),
    [playing, setPlaying] = useState(false),
    [showPitch, setShowPitch] = useState(true),
    [wire, setWire] = useState(false),
    [view, setView] = useState("perspective"),
    [reset, setReset] = useState(0),
    [mode, setMode] = useState("3d"),
    [angle, setAngle] = useState(0),
    [modal, setModal] = useState<"export" | "help" | null>(null),
    [format, setFormat] = useState("stl"),
    [scope, setScope] = useState<"selected" | "assembly">("selected"),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState(true),
    [history, setHistory] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]);
  const phase = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    fullscreenRef = useRef<HTMLDivElement>(null);
  const g = p.gears[selected],
    dim = dimensions(p, selected),
    checks = issues(p),
    errors = checks.some((i) => i.level === "error"),
    approx = types.find((t) => t.id === p.type)?.approximate;
  useEffect(() => {
    setSaved(false);
    const id = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(p));
        setSaved(true);
      } catch {
        setToast("Browser storage is full. Save your project as JSON.");
      }
    }, 600);
    return () => clearTimeout(id);
  }, [p]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4300);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function update(fn: (v: Project) => Project) {
    setHistory((h) => [...h.slice(-39), p]);
    setFuture([]);
    setP(fn(p));
  }
  function param(key: keyof Gear, value: number) {
    update((v) => ({
      ...v,
      gears: v.gears.map((a, i) =>
        i === selected ? { ...a, [key]: value } : a,
      ) as [Gear, Gear],
    }));
  }
  function setting<K extends keyof Project>(key: K, value: Project[K]) {
    update((v) => ({ ...v, [key]: value }));
  }
  function save() {
    download(
      JSON.stringify(p, null, 2),
      `${p.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "gearforge"}.json`,
      "application/json",
    );
    setToast("Project saved. Reopen the JSON file anytime.");
  }
  function changeType(type: GearType) {
    update((v) => {
      const next = {
        ...structuredClone(initialProject),
        name: v.name,
        type,
        process: v.process,
        material: v.material,
        backlash: v.backlash,
        boreAllowance: v.boreAllowance,
        shrinkage: v.shrinkage,
      };
      if (type === "internal") {
        next.gears[1].teeth = 64;
        next.gears[1].bore = 5;
      }
      if (type === "rack") {
        next.gears[1].teeth = 18;
        next.gears[1].bore = 10;
      }
      if (["bevel", "spiral"].includes(type)) {
        next.gears[0].width = 8;
        next.gears[1].width = 8;
      }
      if (type === "worm") {
        next.gears[0] = { ...next.gears[0], teeth: 1, width: 40, bore: 4 };
        next.gears[1].helix = 12.5;
      }
      if (type === "wheel") {
        next.gears[0].teeth = 40;
        next.gears[0].helix = 12.5;
        next.gears[1] = { ...next.gears[1], teeth: 1, width: 40, bore: 4 };
      }
      return next;
    });
    phase.current = 0;
    setPlaying(false);
    setReset((n) => n + 1);
  }
  function snap() {
    update((v) => ({
      ...v,
      snapped: true,
      offset: 0,
      gears: [
        v.gears[0],
        {
          ...v.gears[1],
          module: v.gears[0].module,
          pressure: v.gears[0].pressure,
          ...(["helical", "herringbone", "spiral"].includes(v.type)
            ? { helix: v.gears[0].helix, hand: -v.gears[0].hand }
            : {}),
          ...(v.type === "internal"
            ? { teeth: Math.max(v.gears[1].teeth, v.gears[0].teeth + 10) }
            : {}),
        },
      ],
    }));
    setToast("Snapped to nominal mesh. Module and pressure angle matched.");
  }
  function undo() {
    if (history.length) {
      setFuture((f) => [p, ...f]);
      setP(history.at(-1)!);
      setHistory((h) => h.slice(0, -1));
    }
  }
  function redo() {
    if (future.length) {
      setHistory((h) => [...h, p]);
      setP(future[0]);
      setFuture((f) => f.slice(1));
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if (
        e.code === "Space" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLSelectElement ||
          modal
        )
      ) {
        e.preventDefault();
        if (!errors) setPlaying((v) => !v);
      }
      if (e.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function exportFile() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 70));
    try {
      const name = `gearforge_${p.type}_${scope === "assembly" && format !== "dxf" ? "assembly" : selected ? "B" : "A"}`;
      download(
        format === "stl"
          ? stl(p, scope, selected)
          : format === "step"
            ? step(p, scope, selected)
            : dxf(p, selected),
        `${name}.${format}`,
      );
      setToast(`${format.toUpperCase()} exported in millimetres.`);
      setModal(null);
    } catch (e) {
      setToast(
        `Export failed: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }
  const effectiveDistance = centerDistance(p) + (p.snapped ? 0 : p.offset),
    ratio = p.gears[1].teeth / p.gears[0].teeth;
  return (
    <div className="app-shell">
      <input
        className="hidden"
        type="file"
        accept=".json"
        ref={fileInput}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            if (!validateProject(data))
              throw new Error(
                "Unsupported project or parameters outside limits.",
              );
            update(() => data);
            phase.current = 0;
            setPlaying(false);
            setToast("Project opened.");
          } catch {
            setToast(
              "Could not open project. Choose a valid Gearforge JSON file.",
            );
          }
          e.target.value = "";
        }}
      />
      <header className="topbar">
        <a className="brand" href="#" aria-label="Gearforge home">
          <span className="brand-symbol">
            <GearIcon size={27} />
          </span>
          gearforge<span className="beta">BETA</span>
        </a>
        <div className="project-crumb">
          <span>/</span>
          <FolderOpen size={15} />
          <input
            aria-label="Project name"
            value={p.name}
            maxLength={120}
            onChange={(e) => setting("name", e.target.value)}
          />
          <span
            className="save-dot"
            title={saved ? "Saved in this browser" : "Saving"}
          ></span>
        </div>
        <div className="header-actions">
          <span className="local-label">
            <ShieldCheck size={14} /> Local workspace
          </span>
          <button className="button soft" onClick={save}>
            <Save size={15} />
            Save project
          </button>
          <button className="button primary" onClick={() => setModal("export")}>
            <ArrowDownToLine size={16} />
            Export
            <ChevronDown size={13} />
          </button>
          <span className="avatar">AK</span>
        </div>
      </header>
      <div className="body-shell">
        <nav className="rail" aria-label="Main navigation">
          <button
            className="rail-button current"
            title="Gear workbench"
            onClick={() => {
              setTab("geometry");
              setMode("3d");
            }}
          >
            <Box size={21} />
          </button>
          <button
            className="rail-button"
            title="Open project"
            onClick={() => fileInput.current?.click()}
          >
            <FolderOpen size={21} />
          </button>
          <button
            className="rail-button"
            title="Manufacturing settings"
            onClick={() => setTab("manufacturing")}
          >
            <SlidersHorizontal size={21} />
          </button>
          <span className="rail-line" />
          <button
            className="rail-button"
            title="New project"
            onClick={() => {
              update(() => structuredClone(initialProject));
              setPlaying(false);
              phase.current = 0;
              setToast(
                "New project created. Undo restores your previous design.",
              );
            }}
          >
            <FilePlus2 size={20} />
          </button>
          <div className="rail-bottom">
            <button
              className="rail-button"
              title="Help and Creo import guide"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={21} />
            </button>
            <span className="online-dot" />
          </div>
        </nav>
        <main className="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">DESIGN / GEAR WORKBENCH</div>
              <h1>A little precision. A lot of possibility.</h1>
              <p>Design, mesh, and make your next mechanism.</p>
            </div>
            <div className="unit-badge">
              <span className="green-dot" />
              Metric workspace <span>mm</span>
            </div>
          </div>
          <div className="workbench" ref={fullscreenRef}>
            <aside className="design-panel">
              <div className="panel-tabs">
                <button
                  className={tab === "geometry" ? "active" : ""}
                  onClick={() => setTab("geometry")}
                >
                  <Settings2 size={15} />
                  Geometry
                </button>
                <button
                  className={tab === "manufacturing" ? "active" : ""}
                  onClick={() => setTab("manufacturing")}
                >
                  <SlidersHorizontal size={15} />
                  Manufacturing
                </button>
              </div>
              <div className="panel-scroll">
                {tab === "geometry" ? (
                  <>
                    <div className="section-title">
                      <h2>Gear type</h2>
                      <span>09 families</span>
                    </div>
                    <div className="gear-types">
                      {types.map((t) => (
                        <button
                          key={t.id}
                          className={`type-card ${p.type === t.id ? "selected" : ""}`}
                          title={
                            t.description +
                            (t.approximate ? " · Concept geometry" : "")
                          }
                          onClick={() => changeType(t.id)}
                        >
                          <GearIcon kind={t.id} />
                          <span>{t.name}</span>
                          {p.type === t.id && (
                            <span className="type-check">
                              <Check size={8} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="type-description">
                      {types.find((t) => t.id === p.type)?.description}
                      {approx && <span className="concept-label">Concept</span>}
                    </div>
                    <div className="section-divider" />
                    <div className="section-title">
                      <h2>Gear parameters</h2>
                      <span className={`gear-letter ${selected ? "teal" : ""}`}>
                        {selected ? "B" : "A"}
                      </span>
                    </div>
                    <div className="segmented gear-select">
                      {[0, 1].map((i) => (
                        <button
                          key={i}
                          className={selected === i ? "active" : ""}
                          onClick={() => setSelected(i)}
                        >
                          <span className={`tiny-dot ${i ? "teal" : ""}`} />
                          {i ? "Driven gear" : "Driver gear"}
                          <span>{i ? "B" : "A"}</span>
                        </button>
                      ))}
                    </div>
                    <div className="field-grid">
                      <Field
                        label={
                          effectiveType(p, selected) === "worm"
                            ? "Thread starts"
                            : "Number of teeth"
                        }
                        value={g.teeth}
                        onChange={(v) => param("teeth", v)}
                        min={effectiveType(p, selected) === "worm" ? 1 : 8}
                        max={effectiveType(p, selected) === "worm" ? 4 : 120}
                        unit={
                          effectiveType(p, selected) === "worm" ? "starts" : "z"
                        }
                      />
                      <Field
                        label={
                          ["bevel", "spiral"].includes(p.type)
                            ? "Outer module"
                            : "Normal module"
                        }
                        value={g.module}
                        onChange={(v) => param("module", v)}
                        min={0.5}
                        max={8}
                        step={0.1}
                        unit="mm"
                      />
                      <Field
                        label={
                          ["bevel", "spiral"].includes(p.type)
                            ? "Cone face width"
                            : "Face width"
                        }
                        value={g.width}
                        onChange={(v) => param("width", v)}
                        min={2}
                        max={60}
                        step={0.5}
                        unit="mm"
                      />
                      <Field
                        label={
                          effectiveType(p, selected) === "rack"
                            ? "Rack depth"
                            : effectiveType(p, selected) === "internal"
                              ? "Ring wall"
                              : "Bore diameter"
                        }
                        value={g.bore}
                        onChange={(v) => param("bore", v)}
                        min={0}
                        max={150}
                        step={0.1}
                        unit="mm"
                      />
                    </div>
                    <div className="field-grid">
                      <label className="field">
                        <span>Pressure angle</span>
                        <div className="select-wrap">
                          <select
                            aria-label="Pressure angle"
                            value={g.pressure}
                            onChange={(e) => param("pressure", +e.target.value)}
                          >
                            {[14.5, 20, 25, 30].map((n) => (
                              <option key={n} value={n}>
                                {n}°
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={13} />
                        </div>
                      </label>
                      {[
                        "helical",
                        "herringbone",
                        "spiral",
                        "wheel",
                        "worm",
                      ].includes(p.type) ? (
                        <Field
                          label="Helix angle"
                          value={g.helix}
                          onChange={(v) => param("helix", v)}
                          min={0}
                          max={45}
                          step={0.5}
                          unit="°"
                        />
                      ) : (
                        <Field
                          label="Root clearance"
                          value={p.clearance}
                          onChange={(v) => setting("clearance", v)}
                          min={0.1}
                          max={0.5}
                          step={0.05}
                          unit="x m"
                          hint="Additional dedendum; 0.25 is a standard starting point."
                        />
                      )}
                    </div>
                    {["helical", "herringbone", "spiral"].includes(p.type) && (
                      <label className="field">
                        <span>Helix hand</span>
                        <select
                          value={g.hand}
                          onChange={(e) => param("hand", +e.target.value)}
                        >
                          <option value={1}>Right hand</option>
                          <option value={-1}>Left hand</option>
                        </select>
                      </label>
                    )}
                    <div className="section-divider" />
                    <div className="section-title">
                      <h2>Calculated geometry</h2>
                      <span className="small-label">NOMINAL</span>
                    </div>
                    <div className="data-table">
                      {["bevel", "spiral"].includes(p.type) && (
                        <BevelDetails project={p} selected={selected} />
                      )}
                      <div>
                        <span>
                          {effectiveType(p, selected) === "rack"
                            ? "Rack pitch length"
                            : "Pitch diameter"}
                        </span>
                        <strong>
                          {effectiveType(p, selected) === "worm"
                            ? "-"
                            : effectiveType(p, selected) === "rack"
                              ? (Math.PI * g.module * g.teeth).toFixed(2)
                              : dim.pitch.toFixed(2)}{" "}
                          <small>mm</small>
                        </strong>
                      </div>
                      <div>
                        <span>Outside diameter</span>
                        <strong>
                          {["rack", "worm"].includes(effectiveType(p, selected))
                            ? "-"
                            : dim.outside.toFixed(2)}{" "}
                          <small>mm</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {p.type === "rack"
                            ? "Travel / revolution"
                            : "Gear ratio"}
                        </span>
                        <strong>
                          {p.type === "rack"
                            ? `${(Math.PI * pitch(p.gears[0], "spur")).toFixed(2)} mm`
                            : `${ratio.toFixed(3)} : 1`}
                        </strong>
                      </div>
                    </div>
                    <div className="info-note">
                      <span>i</span>
                      <p>
                        Dimensions update as you design. Export geometry
                        includes your manufacturing allowances.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="section-title">
                      <h2>Make it fit.</h2>
                      <span className="small-label">mm</span>
                    </div>
                    <p className="panel-description">
                      Tune your fit for the process, material, and machine you
                      actually use.
                    </p>
                    <label className="field">
                      <span>Manufacturing process</span>
                      <select
                        value={p.process}
                        onChange={(e) => setting("process", e.target.value)}
                      >
                        {["FDM printing", "SLA printing", "CNC machining"].map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="field">
                      <span>Material</span>
                      <select
                        value={p.material}
                        onChange={(e) => setting("material", e.target.value)}
                      >
                        {[
                          "PLA",
                          "PETG",
                          "ABS",
                          "Nylon",
                          "Resin",
                          "Aluminum",
                          "Steel",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <div className="preset-row">
                      <button
                        className="button soft"
                        onClick={() =>
                          update((v) => ({
                            ...v,
                            backlash:
                              v.process === "CNC machining"
                                ? 0.05
                                : v.process === "SLA printing"
                                  ? 0.1
                                  : 0.2,
                            boreAllowance:
                              v.process === "CNC machining"
                                ? 0.02
                                : v.process === "SLA printing"
                                  ? 0.1
                                  : 0.2,
                            shrinkage: 0,
                          }))
                        }
                      >
                        <Settings2 size={14} />
                        Apply starting values
                      </button>
                    </div>
                    <div className="section-divider" />
                    <Field
                      label="Pair backlash"
                      value={p.backlash}
                      onChange={(v) => setting("backlash", v)}
                      min={0}
                      max={1}
                      step={0.01}
                      unit="mm"
                    />
                    <p className="input-note">
                      Total circular tooth clearance, shared equally between
                      both gears.
                    </p>
                    <Field
                      label="Bore allowance"
                      value={p.boreAllowance}
                      onChange={(v) => setting("boreAllowance", v)}
                      min={-0.5}
                      max={1}
                      step={0.01}
                      unit="mm"
                    />
                    <p className="input-note">
                      Added to the bore diameter. Positive values loosen the
                      shaft fit.
                    </p>
                    <Field
                      label="Shrink compensation"
                      value={p.shrinkage}
                      onChange={(v) => setting("shrinkage", v)}
                      min={0}
                      max={5}
                      step={0.1}
                      unit="%"
                    />
                    <p className="input-note">
                      Uniform geometry scale: 1 ÷ (1 - shrinkage). Calibrate
                      with a test print.
                    </p>
                    <Field
                      label="Root clearance"
                      value={p.clearance}
                      onChange={(v) => setting("clearance", v)}
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      unit="x m"
                    />
                    <div className="info-note">
                      <ShieldCheck size={16} />
                      <p>
                        Starting values are suggestions. Print a fit coupon
                        before making a full assembly. No load or
                        material-strength analysis is performed.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="panel-footer">
                <span className="green-dot" />
                {saved ? "All changes saved locally" : "Saving changes..."}
                <span>v0.1</span>
              </div>
            </aside>
            <section className="viewport-panel">
              <div className="viewport-toolbar">
                <div className="viewport-tabs">
                  <button
                    className={mode === "3d" ? "active" : ""}
                    onClick={() => setMode("3d")}
                  >
                    <Box size={14} />
                    3D assembly
                  </button>
                  <button
                    className={mode === "profile" ? "active" : ""}
                    onClick={() => setMode("profile")}
                  >
                    <Layers2 size={14} />
                    2D profile
                  </button>
                </div>
                <div className="history-controls">
                  <button
                    title="Undo"
                    disabled={!history.length}
                    onClick={undo}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button title="Redo" disabled={!future.length} onClick={redo}>
                    <Redo2 size={15} />
                  </button>
                  <span />
                  <button
                    title="Expand viewport"
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen();
                      else
                        fullscreenRef.current
                          ?.requestFullscreen()
                          .catch(() =>
                            setToast(
                              "Fullscreen is unavailable in this browser.",
                            ),
                          );
                    }}
                  >
                    <Expand size={16} />
                  </button>
                </div>
              </div>
              <div className="viewport">
                <div className="viewport-topline">
                  <span className="viewport-title">
                    <span className="green-dot" />
                    {mode === "3d" ? "ASSEMBLY PREVIEW" : "TOOTH PROFILE"}
                  </span>
                  <span className={`mesh-badge ${errors ? "invalid" : ""}`}>
                    {errors ? (
                      <TriangleAlert size={12} />
                    ) : p.snapped ? (
                      <Link2 size={12} />
                    ) : (
                      <Unlink2 size={12} />
                    )}{" "}
                    {errors
                      ? "Check parameters"
                      : p.snapped
                        ? "Snapped to mesh"
                        : "Free positioning"}
                  </span>
                </div>
                {mode === "3d" ? (
                  <Viewport
                    project={p}
                    selected={selected}
                    onSelect={setSelected}
                    playing={playing && !errors}
                    wire={wire}
                    showPitch={showPitch}
                    view={view}
                    reset={reset}
                    onAngle={setAngle}
                    phase={phase}
                  />
                ) : (
                  <Profile p={p} selected={selected} />
                )}
                <div className="view-tools">
                  <button
                    title="Perspective view"
                    className={view === "perspective" ? "active" : ""}
                    onClick={() => {
                      setView("perspective");
                      setMode("3d");
                    }}
                  >
                    <Box size={17} />
                  </button>
                  <button
                    title="Top view"
                    className={view === "top" ? "active" : ""}
                    onClick={() => {
                      setView("top");
                      setMode("3d");
                    }}
                  >
                    <Grid2X2 size={17} />
                  </button>
                  <button
                    title="Front view"
                    className={view === "front" ? "active" : ""}
                    onClick={() => {
                      setView("front");
                      setMode("3d");
                    }}
                  >
                    <Move3D size={17} />
                  </button>
                  <span />
                  <button
                    title="Fit assembly to view"
                    onClick={() => setReset((v) => v + 1)}
                  >
                    <Maximize size={16} />
                  </button>
                  <button
                    title="Toggle wireframe"
                    className={wire ? "active" : ""}
                    onClick={() => setWire((v) => !v)}
                  >
                    <Orbit size={17} />
                  </button>
                  <button
                    title="Toggle pitch circles"
                    className={showPitch ? "active" : ""}
                    onClick={() => setShowPitch((v) => !v)}
                  >
                    <Crosshair size={17} />
                  </button>
                </div>
                <div className="viewport-bottom">
                  <div className="axis-widget">
                    <span className="axis-z">Z</span>
                    <span className="axis-y">Y</span>
                    <span className="axis-x">X</span>
                    <svg width="50" height="50">
                      <path
                        d="M25 30V8M25 30L7 40M25 30l20 9"
                        stroke="#9da99c"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </div>
                  <span>
                    <MousePointer2 size={12} />
                    Drag to orbit <b>·</b> Scroll to zoom <b>·</b> Right-drag to
                    pan
                  </span>
                  <span className="units-label">mm units</span>
                </div>
                {approx && (
                  <div className="concept-overlay">
                    <TriangleAlert size={12} />
                    Concept tooth contact
                  </div>
                )}
              </div>
              <div className="simulation">
                <div className="simulation-heading">
                  <div>
                    <span className="eyebrow">BRING IT TOGETHER</span>
                    <h2>A good fit. In motion.</h2>
                  </div>
                  <span className="kinematic-label">
                    <Activity size={13} />
                    Kinematic preview
                  </span>
                </div>
                <div className="simulation-controls">
                  <button
                    className={`play-button ${playing ? "playing" : ""}`}
                    title={playing ? "Pause simulation" : "Play simulation"}
                    disabled={errors}
                    onClick={() => setPlaying((v) => !v)}
                  >
                    {playing ? (
                      <Pause size={19} fill="currentColor" />
                    ) : (
                      <Play size={19} fill="currentColor" />
                    )}
                  </button>
                  <button
                    className="reset-motion"
                    title="Reset motion"
                    onClick={() => {
                      setPlaying(false);
                      phase.current = 0;
                      setAngle(0);
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                  <div className="motion-track">
                    <div>
                      <span>Driver rotation</span>
                      <strong>
                        {(
                          ((((angle * 180) / Math.PI) % 360) + 360) %
                          360
                        ).toFixed(0)}
                        <small> °</small>
                      </strong>
                    </div>
                    <input
                      type="range"
                      aria-label="Driver rotation"
                      min="0"
                      max="360"
                      step="1"
                      value={((((angle * 180) / Math.PI) % 360) + 360) % 360}
                      onChange={(e) => {
                        setPlaying(false);
                        phase.current = (+e.target.value * Math.PI) / 180;
                        setAngle(phase.current);
                      }}
                    />
                  </div>
                  <div className="speed-input">
                    <label htmlFor="rpm">Input speed</label>
                    <div>
                      <input
                        id="rpm"
                        type="number"
                        min="1"
                        max="60"
                        value={p.rpm}
                        onChange={(e) =>
                          setting(
                            "rpm",
                            Math.max(1, Math.min(60, +e.target.value || 1)),
                          )
                        }
                      />
                      <span>RPM</span>
                    </div>
                  </div>
                </div>
                <div className="simulation-foot">
                  <span>
                    <span className="tiny-dot" />
                    Driver: {p.rpm} rpm
                  </span>
                  <ArrowRight size={13} />
                  <span>
                    <span className="tiny-dot teal" />
                    Driven: {(p.rpm / ratio).toFixed(1)}{" "}
                    {p.type === "rack" ? "rev-eq/min" : "rpm"}
                  </span>
                  <span className="space-tip">
                    <kbd>space</kbd> to play / pause
                  </span>
                </div>
              </div>
            </section>
            <aside className="assembly-panel">
              <div className="assembly-heading">
                <h2>Assembly</h2>
                <span className="count-pill">2 parts</span>
                <button
                  title="Duplicate driver parameters to driven"
                  onClick={() => {
                    update((v) => ({
                      ...v,
                      gears: [
                        v.gears[0],
                        { ...v.gears[0], hand: -v.gears[0].hand },
                      ],
                    }));
                    setToast("Driver parameters copied to gear B.");
                  }}
                >
                  <Copy size={15} />
                </button>
              </div>
              <div className="assembly-scroll">
                <div className="eyebrow assembly-label">YOUR GEAR PAIR</div>
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    className={`assembly-part ${selected === i ? "active" : ""}`}
                    onClick={() => setSelected(i)}
                  >
                    <div className={`part-thumb ${i ? "teal" : ""}`}>
                      <GearIcon kind={effectiveType(p, i)} size={36} />
                    </div>
                    <div>
                      <strong>
                        Gear {i ? "B" : "A"}{" "}
                        <span>{i ? "Driven" : "Driver"}</span>
                      </strong>
                      <p>
                        {p.gears[i].teeth}
                        {effectiveType(p, i) === "worm"
                          ? " starts"
                          : " teeth"}{" "}
                        <b>·</b> m{p.gears[i].module}
                      </p>
                    </div>
                    {selected === i ? (
                      <span className="part-selected-dot" />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </button>
                ))}
                <div className="pair-connector">
                  <Link2 size={13} />
                  <span>
                    {p.type === "internal"
                      ? "Internal engagement"
                      : ["bevel", "spiral", "worm", "wheel"].includes(p.type)
                        ? "Crossed-axis pair"
                        : "Parallel-axis pair"}
                  </span>
                </div>
                <div className="section-divider" />
                <div className="section-title">
                  <h2>Mating setup</h2>
                  <Link2 size={15} />
                </div>
                <div className="mate-row">
                  <span>Auto-position gears</span>
                  <button
                    role="switch"
                    aria-checked={p.snapped}
                    aria-label="Auto-position gears"
                    className={`toggle ${p.snapped ? "on" : ""}`}
                    onClick={() => setting("snapped", !p.snapped)}
                  >
                    <span />
                  </button>
                </div>
                <button className="button snap-button" onClick={snap}>
                  <Link2 size={15} />
                  Snap to mesh
                  <ArrowUpRight size={14} />
                </button>
                <div className="data-table mating-data">
                  <div>
                    <span>
                      {p.type === "rack"
                        ? "Pitch radius"
                        : ["bevel", "spiral"].includes(p.type)
                          ? "Shaft angle"
                          : "Center distance"}
                    </span>
                    <strong>
                      {["bevel", "spiral"].includes(p.type)
                        ? "90°"
                        : `${(p.type === "rack" ? pitch(p.gears[0], "spur") / 2 : effectiveDistance).toFixed(2)} mm`}
                    </strong>
                  </div>
                  <div>
                    <span>Transmission ratio</span>
                    <strong>{ratio.toFixed(3)} : 1</strong>
                  </div>
                  <div>
                    <span>Pair backlash</span>
                    <strong>{p.backlash.toFixed(2)} mm</strong>
                  </div>
                </div>
                {!p.snapped && (
                  <Field
                    label="Center offset"
                    value={p.offset}
                    onChange={(v) => setting("offset", v)}
                    min={-10}
                    max={30}
                    step={0.1}
                    unit="mm"
                  />
                )}
                <div className="section-divider" />
                <div className="section-title">
                  <h2>Fit check</h2>
                  <span className="small-label">LIVE</span>
                </div>
                <div className="checks">
                  {checks.map((c, i) => (
                    <div className={`check-item ${c.level}`} key={i}>
                      {c.level === "ok" ? (
                        <CheckCheck size={15} />
                      ) : (
                        <TriangleAlert size={15} />
                      )}
                      <span>{c.text}</span>
                    </div>
                  ))}
                </div>
                <MeshCheck
                  project={p}
                  onCollision={(a) => {
                    phase.current = a;
                    setAngle(a);
                    setPlaying(false);
                  }}
                />
                <p className="validation-note">
                  Sampled overlap checks do not certify continuous contact,
                  load, wear, or strength.
                </p>
                <div className="manufacturing-card">
                  <span className="eyebrow">DESIGNED TO BE MADE</span>
                  <div>
                    <Box size={18} />
                    <strong>{p.process}</strong>
                  </div>
                  <p>
                    {p.material} <span>·</span> {p.backlash.toFixed(2)} mm
                    backlash
                  </p>
                  <button onClick={() => setTab("manufacturing")}>
                    Adjust tolerances <ArrowRight size={13} />
                  </button>
                </div>
              </div>
              <button className="creo-card" onClick={() => setModal("help")}>
                <span className="creo-icon">C</span>
                <span>
                  <strong>Next stop: Creo.</strong>
                  <small>
                    View the import guide <ArrowUpRight size={11} />
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              <span className="green-dot" />
              Made for the things you're making.
            </span>
            <span>
              Involute profiles <b>·</b> Millimetre precision <b>·</b> Your
              designs stay on your device <ShieldCheck size={12} />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
          <button title="Dismiss notification" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => !busy && setModal(null)}>
          <section
            className={`modal ${modal === "help" ? "help-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "export"
                ? "Export geometry"
                : "Help and Creo import guide"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {modal === "export" ? (
              <>
                <div className="modal-icon">
                  <ArrowDownToLine size={23} />
                </div>
                <span className="eyebrow">FROM DESIGN TO DESKTOP</span>
                <h2>Ready to make something?</h2>
                <p>
                  Export your geometry with manufacturing allowances applied.
                  All coordinates are in millimetres.
                </p>
                <div className="export-options">
                  {[
                    {
                      id: "stl",
                      title: "STL",
                      sub: "3D printing",
                      desc: "Binary triangle mesh. Set slicer units to mm.",
                    },
                    {
                      id: "step",
                      title: "STEP",
                      sub: "Creo / CAD",
                      desc: "Faceted B-rep. Triangle faces; no native features.",
                    },
                    {
                      id: "dxf",
                      title: "DXF",
                      sub: "2D profile",
                      desc: "Closed polylines. Sketch / extrude in Creo.",
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={format === f.id ? "active" : ""}
                      onClick={() => setFormat(f.id)}
                    >
                      <span className="export-radio" />
                      <strong>
                        {f.title}
                        <small>{f.sub}</small>
                      </strong>
                      <span>{f.desc}</span>
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Export scope</span>
                  <select
                    aria-label="Export scope"
                    value={format === "dxf" ? "selected" : scope}
                    disabled={format === "dxf"}
                    onChange={(e) =>
                      setScope(e.target.value as "selected" | "assembly")
                    }
                  >
                    <option value="selected">
                      Selected gear ({selected ? "B" : "A"}) · local origin
                    </option>
                    <option value="assembly">
                      Both gears · assembled positions
                    </option>
                  </select>
                </label>
                <div className="export-caveat">
                  <CircleHelp size={16} />
                  <p>
                    {format === "step"
                      ? "STEP contains faceted surfaces, not analytical gear surfaces or a feature tree. Creo acceptance depends on your import settings. Native Creo import has not been tested."
                      : format === "dxf"
                        ? "DXF is the untwisted, large-end profile. It does not encode helix, cone, or face width. Use STL or STEP for 3D shapes."
                        : "STL imports into Creo as facet geometry. It is not a native editable solid. Separate part exports are best for a moving assembly."}
                  </p>
                </div>
                {errors && (
                  <div className="check-item error">
                    <TriangleAlert size={16} />
                    Resolve the red fit checks before exporting.
                  </div>
                )}
                <button
                  className="button primary export-confirm"
                  disabled={busy || errors}
                  onClick={exportFile}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}{" "}
                  {busy
                    ? "Preparing geometry..."
                    : `Download ${format.toUpperCase()}`}
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="modal-icon">
                  <CircleHelp size={23} />
                </div>
                <span className="eyebrow">A FEW USEFUL THINGS</span>
                <h2>From a good idea to a good fit.</h2>
                <div className="help-section">
                  <h3>1. Design the pair</h3>
                  <p>
                    Choose a gear family and edit each gear's parameters. Snap
                    to mesh matches module, pressure angle, and parallel helix
                    settings, and positions the pair at nominal center distance.
                    Use free positioning to test a center offset.
                  </p>
                  <h3>2. Tune and preview</h3>
                  <p>
                    Manufacturing settings change tooth thickness, bore size,
                    and overall shrink compensation in the preview and exported
                    geometry. Play shows ideal ratio-based motion. Run mesh test
                    checks supported profiles at sampled phases and axial
                    slices. It does not certify continuous tooth contact.
                  </p>
                  <h3>3. Import into Creo</h3>
                  <p>
                    <strong>DXF:</strong> import the profile into a sketch,
                    confirm millimetres, then extrude to your face width. This
                    works directly for spur gears, internal gears, and racks.
                  </p>
                  <p>
                    <strong>STL:</strong> open or import as tessellated
                    geometry. This is a reference mesh, not a feature-based Creo
                    part.
                  </p>
                  <p>
                    <strong>STEP:</strong> open as a part with millimetre units.
                    This app exports triangular faceted B-reps, not analytical
                    solids. Import behavior varies by Creo version and has not
                    been verified in Creo.
                  </p>
                  <h3>Know the geometry</h3>
                  <p>
                    Spur, helical, double-helical, and internal profiles use
                    sampled involute flanks with simplified root transitions.
                    Straight bevels use ideal spherical involute flanks with
                    simplified roots. Spiral bevel and worm drives remain
                    concept models. Hypoid, cycloidal, harmonic, and load-rated
                    manufacturing designs are outside this version's scope.
                  </p>
                  <div className="help-links">
                    <a
                      href="https://support.ptc.com/help/creo/creo_pma/r13/usascii/data_exchange/interface/About_Tessellated_Files.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      PTC: tessellated imports <ArrowUpRight size={12} />
                    </a>
                    <a
                      href="https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      KHK: gear dimensions <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>
                <button
                  className="button primary"
                  onClick={() => setModal(null)}
                >
                  Back to the workbench <ArrowRight size={15} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
