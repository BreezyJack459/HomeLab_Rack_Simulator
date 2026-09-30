import { getCableLengthRequirements, cablePurchaseLengthLabel } from '../utils/cableLengthRequirements';
import { Html, Line } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { useRackStore } from "../store/rackStore";
import type { CableRouteAnchor } from "../types/rack";
import {
  anchorKey,
  anchorLabel,
  manualRoutePoints,
  portLeadPoints,
  resolveRouteAnchor,
  routeLengthMm,
} from "../utils/manualCableRoute";
import { drawingCable, drawingObstruction } from "../utils/cableDrawing";
import {
  portChoicesForDevice,
  portKey,
  type PortChoice,
} from "../utils/portSelection";
import type { WorldPoint } from "../utils/rackGeometry";
import { buildRouteCurve } from "./three/rack-scene/ManagedCable3D";
import { calculateCablePlan } from "../utils/routing";
import { sceneButtonClass } from "./SceneViewToolbar";

type Dot = {
  key: string;
  label: string;
  point: WorldPoint;
  port?: PortChoice;
  anchor?: CableRouteAnchor;
};

export function useCableRouteDrawing(
  active: boolean,
  onClose: () => void,
  editingCableId: string | null = null,
) {
  const storedLayout = useRackStore((s) => s.layout);
  const layout = useMemo(
    () =>
      editingCableId
        ? {
            ...storedLayout,
            cables: storedLayout.cables.filter((c) => c.id !== editingCableId),
          }
        : storedLayout,
    [storedLayout, editingCableId],
  );
  const [source, setSource] = useState<PortChoice | null>(null);
  const [anchors, setAnchors] = useState<CableRouteAnchor[]>([]);
  const [hover, updateHover] = useState<Dot | null>(null);
  const [message, setMessage] = useState("");
  const [face, setFace] = useState<"front" | "rear">("rear");
  const [deviceId, setDeviceId] = useState("");
  const [level, setLevel] = useState(1);
  const setHover = (dot: Dot | null) => {
    updateHover(dot);
    setMessage("");
  };
  // A picker change must not leave a preview for the previously visible port.
  useEffect(() => {
    updateHover(null);
    setMessage("");
  }, [face, deviceId, level]);
  const ports = useMemo(
    () => layout.devices.flatMap((d) => portChoicesForDevice(d, layout)),
    [layout],
  );
  useEffect(() => {
    if (!active || !editingCableId) return;
    const cable = storedLayout.cables.find((c) => c.id === editingCableId);
    const picked = ports.find(
      (p) =>
        p.deviceId === cable?.fromDeviceId &&
        p.type === cable.fromPort?.type &&
        p.index === cable.fromPort.index &&
        (!cable.fromPort.side || p.side === cable.fromPort.side),
    );
    if (picked) {
      setSource(picked);
      setFace(picked.side ?? "rear");
      setDeviceId(cable!.toDeviceId);
      setAnchors(cable?.manualPath ?? []);
      setLevel(
        Math.max(
          1,
          Math.min(
            layout.heightU,
            Math.round(
              layout.devices.find((d) => d.id === picked.deviceId)?.positionU ??
                1,
            ),
          ),
        ),
      );
    }
    // Initialise only when an edit starts; subsequent layout changes are checked at commit.
  }, [active, editingCableId]);
  const dots = useMemo((): Dot[] => {
    if (!active) return [];
    const result: Dot[] = ports
      .filter((p) => p.side === face)
      .flatMap((port) => {
        const point = portLeadPoints(layout, port.deviceId, port)[0];
        return point
          ? [
              {
                key: `${port.deviceId}:${portKey(port)}`,
                label: `${port.deviceName} · ${port.label}`,
                point,
                port,
              },
            ]
          : [];
      });
    if (source) {
      const choices: CableRouteAnchor[] = [];
      for (const side of ["left", "right"] as const) {
        choices.push({
          kind: "channel",
          face,
          side,
          positionU: Math.min(level, layout.heightU),
        });
        for (const device of layout.devices.filter(
          (d) => d.category === "cable-management",
        ))
          choices.push({ kind: "manager", deviceId: device.id, side });
      }
      choices.forEach((anchor) => {
        const point = resolveRouteAnchor(anchor, layout);
        if (point)
          result.push({
            key: anchorKey(anchor),
            label: anchorLabel(anchor, layout),
            point,
            anchor,
          });
      });
    }
    return result;
  }, [active, ports, face, source, level, layout]);
  const path = useMemo(
    () =>
      source
        ? [
            ...portLeadPoints(layout, source.deviceId, source),
            ...anchors
              .map((a) => resolveRouteAnchor(a, layout))
              .filter((p): p is WorldPoint => !!p),
          ]
        : [],
    [source, anchors, layout],
  );

  const evaluateDot = (dot: Dot) => {
    if (dot.port?.disabled)
      return { points: path, error: "This port is already occupied." };
    if (!source)
      return {
        points: [],
        error: dot.port ? null : "Pick a source port first.",
      };
    if (dot.port) {
      if (dot.port.deviceId === source.deviceId)
        return {
          points: path,
          error: "Choose a destination on another device.",
        };
      if (dot.port.type !== source.type)
        return {
          points: path,
          error: `This ${dot.port.type} port cannot connect to the ${source.type} source.`,
        };
      const cable = drawingCable(layout, source, dot.port);
      if (!cable)
        return {
          points: path,
          error: "Pick a free, compatible port on another device.",
        };
      cable.manualPath = anchors;
      const points = manualRoutePoints(cable, layout);
      return {
        points,
        error: drawingObstruction(
          layout,
          points,
          source.deviceId,
          dot.port.deviceId,
        ),
        cable,
      };
    }
    if (dot.anchor && anchors.some((a) => anchorKey(a) === dot.key))
      return {
        points: path,
        error:
          "This point is already in the route. Use Step back to change it.",
      };
    const points = [...path, dot.point];
    return {
      points,
      error: drawingObstruction(layout, points, source.deviceId),
    };
  };
  const evaluations = useMemo(
    () => new Map(dots.map((dot) => [dot.key, evaluateDot(dot)])),
    [dots, path, anchors, source, layout],
  );
  const evaluate = (dot: Dot) => evaluations.get(dot.key) ?? evaluateDot(dot);
  const choose = (dot: Dot) => {
    const result = evaluate(dot);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("");
    setHover(null);
    if (!source && dot.port) {
      setSource(dot.port);
      const device = layout.devices.find((d) => d.id === dot.port?.deviceId);
      setLevel(
        Math.max(
          1,
          Math.min(layout.heightU, Math.round(device?.positionU ?? 1)),
        ),
      );
    } else if (dot.anchor) setAnchors((a) => [...a, dot.anchor!]);
    else if (result.cable) {
      const latest = useRackStore.getState();
      if (
        editingCableId &&
        !latest.layout.cables.some((c) => c.id === editingCableId)
      ) {
        setMessage("This cable was removed. Cancel and start a new route.");
        return;
      }
      const commitLayout = editingCableId
        ? {
            ...latest.layout,
            cables: latest.layout.cables.filter((c) => c.id !== editingCableId),
          }
        : latest.layout;
      const checked = drawingCable(commitLayout, source!, dot.port!);
      if (!checked) {
        setMessage(
          "A selected port is no longer available. Pick another port.",
        );
        return;
      }
      checked.manualPath = anchors;
      const error = drawingObstruction(
        commitLayout,
        manualRoutePoints(checked, commitLayout),
        checked.fromDeviceId,
        checked.toDeviceId,
      );
      if (error) {
        setMessage(error);
        return;
      }
      if (editingCableId) {
        const { id: _id, color: _color, ...patch } = checked;
        latest.updateCable(editingCableId, patch);
      } else latest.addCable(checked);
      onClose();
    }
  };
  const continueFrom = (index: number) => {
    if (!Number.isInteger(index) || index < -1 || index >= anchors.length)
      return;
    setHover(null);
    setAnchors((current) => current.slice(0, index + 1));
  };
  const back = () => {
    setHover(null);
    setMessage("");
    if (anchors.length) setAnchors((a) => a.slice(0, -1));
    else setSource(null);
  };
  useEffect(() => {
    if (!active) {
      setSource(null);
      setAnchors([]);
      setHover(null);
      setMessage("");
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, anchors.length, onClose]);
  // A different rack must never inherit an unfinished path.
  useEffect(() => {
    setSource(null);
    setAnchors([]);
    setHover(null);
    setMessage("");
  }, [layout.id]);
  const hovered =
    hover && dots.some((dot) => dot.key === hover.key) ? evaluate(hover) : null;
  const previewPoints = hovered?.points ?? path;
  const completionPlan =
    hovered && !hovered.error && "cable" in hovered && hovered.cable
      ? calculateCablePlan(hovered.cable, layout)
      : null;
  const completionPurchase = hovered && !hovered.error && "cable" in hovered && hovered.cable
    ? getCableLengthRequirements({ ...layout, cables: [...layout.cables.filter(cable => cable.id !== hovered.cable!.id), hovered.cable] }).get(hovered.cable.id)
    : undefined;
  const reachablePorts = source
    ? dots.filter((dot) => dot.port && !evaluate(dot).error).length
    : null;
  return {
    active,
    source,
    anchors,
    dots,
    path: previewPoints,
    lengthMm: routeLengthMm(previewPoints, layout),
    completionPlan,
    completionPurchase,
    reachablePorts,
    continueFrom,
    message: message || hovered?.error,
    invalid: !!hovered?.error,
    hover,
    setHover,
    choose,
    evaluate,
    back,
    face,
    setFace,
    deviceId,
    setDeviceId,
    level,
    setLevel,
    layout,
    onClose,
  };
}
type Drawing = ReturnType<typeof useCableRouteDrawing>;

export function CableDrawingScene({ drawing }: { drawing: Drawing }) {
  const curve = useMemo(
    () =>
      buildRouteCurve(drawing.path)?.getPoints(
        Math.max(24, drawing.path.length * 12),
      ),
    [drawing.path],
  );
  if (!drawing.active) return null;
  return (
    <group>
      {curve && (
        <Line
          points={curve}
          color={drawing.invalid ? "#fb7185" : "#22d3ee"}
          lineWidth={3}
        />
      )}
      {drawing.source &&
        (() => {
          const point = portLeadPoints(
            drawing.layout,
            drawing.source.deviceId,
            drawing.source,
          )[0];
          return (
            point && (
              <Html
                position={[point.x, point.y, point.z]}
                center
                zIndexRange={[8, 0]}
                style={{ pointerEvents: "none" }}
              >
                <span className="inline-block -translate-y-6 rounded border border-accent bg-surface px-2 py-1 text-xs font-bold text-accent-fg">
                  A
                </span>
              </Html>
            )
          );
        })()}
      {drawing.completionPlan &&
        drawing.path.length > 0 &&
        (() => {
          const point = drawing.path[drawing.path.length - 1];
          return (
            <Html
              position={[point.x, point.y, point.z]}
              center
              zIndexRange={[8, 0]}
              style={{ pointerEvents: "none" }}
            >
              <span
                data-testid="drawing-destination"
                className="inline-block translate-y-6 rounded border border-accent bg-surface px-2 py-1 text-xs font-bold text-accent-fg"
              >
                B
              </span>
            </Html>
          );
        })()}
      {drawing.anchors.map((anchor, i) => {
        const point = resolveRouteAnchor(anchor, drawing.layout);
        return (
          point && (
            <Html
              key={i}
              position={[point.x, point.y, point.z]}
              center
              zIndexRange={[8, 0]}
              style={{ pointerEvents: "auto" }}
            >
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  drawing.continueFrom(i);
                }}
                aria-label={`Continue from point ${i + 1}`}
                title="Keep the route up to this point and draw the rest again"
                data-testid="drawing-point-label"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-accent bg-surface text-xs font-bold text-accent-fg hover:bg-accent-subtle"
              >
                {i + 1}
              </button>
            </Html>
          )
        );
      })}
      {drawing.dots.map((dot) => {
        const disabled = !!drawing.evaluate(dot).error;
        const selected =
          dot.port &&
          drawing.source?.deviceId === dot.port.deviceId &&
          portKey(drawing.source) === portKey(dot.port);
        return (
          <mesh
            key={dot.key}
            position={[dot.point.x, dot.point.y, dot.point.z]}
            renderOrder={5}
            onPointerOver={(e) => {
              e.stopPropagation();
              drawing.setHover(dot);
            }}
            onPointerOut={() => drawing.setHover(null)}
            onClick={(e) => {
              if (e.delta > 4) return;
              e.stopPropagation();
              drawing.choose(dot);
            }}
          >
            <sphereGeometry args={[dot.anchor ? 0.055 : 0.026, 12, 8]} />
            <meshBasicMaterial
              color={
                selected
                  ? "#22d3ee"
                  : disabled
                    ? "#64748b"
                    : dot.anchor
                      ? "#fbbf24"
                      : "#4ade80"
              }
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function CableDrawingControls({ drawing }: { drawing: Drawing }) {
  if (!drawing.active) return null;
  const devices = drawing.layout.devices.filter(
    (d) =>
      d.ports &&
      Object.values(d.ports).some((v) => typeof v === "number" && v > 0),
  );
  const activeDevice =
    devices.find((d) => d.id === drawing.deviceId) ?? devices[0];
  const portDots = drawing.dots.filter(
    (d) => d.port?.deviceId === activeDevice?.id,
  );
  return (
    <div
      className="relative z-10 w-64 shrink-0 space-y-3 overflow-y-auto border-r border-edge bg-surface p-3 text-xs text-content"
      data-testid="route-drawing"
    >
      <div className="sticky -top-3 z-20 -mx-3 -mt-3 flex items-center justify-between border-b border-edge bg-surface p-3">
        <strong>
          Draw route · {drawing.source ? "Choose next point" : "Choose source"}
        </strong>
        <button
          className={sceneButtonClass}
          onClick={drawing.onClose}
          aria-label="Cancel drawing"
        >
          ×
        </button>
      </div>
      <p className="text-content-secondary">
        Pick a green port, then optional gold routing points. Pick another green
        port to save. Click a numbered point to redraw from there.
      </p>
      <div className="flex gap-1">
        {(["front", "rear"] as const).map((face) => (
          <button
            key={face}
            className={sceneButtonClass}
            aria-pressed={drawing.face === face}
            onClick={() => drawing.setFace(face)}
          >
            {face === "front" ? "Front ports" : "Rear ports"}
          </button>
        ))}
      </div>
      <label className="block">
        Device
        <select
          aria-label="Drawing device"
          value={activeDevice?.id ?? ""}
          onChange={(e) => drawing.setDeviceId(e.target.value)}
          className="mt-1 w-full rounded border border-edge bg-surface p-2"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="grid max-h-32 grid-cols-2 gap-1 overflow-auto"
        aria-label="Available ports"
      >
        {portDots.map((dot) => (
          <button
            key={dot.key}
            className={`${sceneButtonClass} !h-auto !py-2 data-[unavailable=true]:opacity-40`}
            aria-disabled={!!drawing.evaluate(dot).error}
            data-unavailable={!!drawing.evaluate(dot).error}
            title={drawing.evaluate(dot).error ?? dot.label}
            onMouseEnter={() => drawing.setHover(dot)}
            onMouseLeave={() => drawing.setHover(null)}
            onFocus={() => drawing.setHover(dot)}
            onBlur={() => drawing.setHover(null)}
            onClick={() => drawing.choose(dot)}
          >
            {dot.port!.type} {dot.port!.index + 1}
            {dot.port!.disabled ? " · used" : ""}
          </button>
        ))}
        {!portDots.length && (
          <span className="col-span-2 text-content-muted">
            No ports on this face.
          </span>
        )}
      </div>
      {drawing.source && (
        <>
          <div className="rounded border border-edge p-2">
            <button
              type="button"
              onClick={() => drawing.continueFrom(-1)}
              title="Keep the source and redraw the route"
              aria-label="Continue from source"
              className="mr-1 rounded border border-accent px-2 py-1 font-bold text-accent-fg hover:bg-accent-subtle"
            >
              A
            </button>{" "}
            {drawing.source.deviceName} · {drawing.source.label}
            <ol className="mt-1 h-12 overflow-auto text-content-secondary">
              {drawing.anchors.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded py-1 text-left hover:bg-accent-subtle hover:text-content"
                    onClick={() => drawing.continueFrom(i)}
                    aria-label={`Continue from point ${i + 1}: ${anchorLabel(a, drawing.layout)}`}
                    title="Keep the route up to this point and draw the rest again"
                  >
                    {i + 1}. {anchorLabel(a, drawing.layout)}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <label className="flex items-center justify-between">
            Side-channel height
            <select
              aria-label="Routing point height"
              value={drawing.level}
              onChange={(e) => drawing.setLevel(Number(e.target.value))}
              className="rounded border border-edge bg-surface p-1"
            >
              {Array.from({ length: drawing.layout.heightU }, (_, i) => i + 1)
                .reverse()
                .map((u) => (
                  <option key={u} value={u}>
                    U{u}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-content-muted">
            Left/right refer to the rack viewed from the front.
          </p>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
            {drawing.dots
              .filter((d) => d.anchor)
              .map((dot) => (
                <button
                  key={dot.key}
                  className={`${sceneButtonClass} data-[unavailable=true]:opacity-40`}
                  aria-disabled={!!drawing.evaluate(dot).error}
                  data-unavailable={!!drawing.evaluate(dot).error}
                  title={drawing.evaluate(dot).error ?? dot.label}
                  onMouseEnter={() => drawing.setHover(dot)}
                  onMouseLeave={() => drawing.setHover(null)}
                  onFocus={() => drawing.setHover(dot)}
                  onBlur={() => drawing.setHover(null)}
                  onClick={() => drawing.choose(dot)}
                >
                  {dot.label}
                </button>
              ))}
          </div>
        </>
      )}
      {drawing.source && (
        <div
          className="h-24 space-y-1 rounded border border-edge p-2"
          data-testid="drawing-length"
        >
          <div>
            {drawing.completionPlan ? "Preview path" : "Drawn so far"} ·{" "}
            {(drawing.lengthMm / 1000).toFixed(2)} m
          </div>
          {drawing.completionPlan && (
            <div className="text-content-secondary">
              With slack ·{" "}
              {drawing.completionPurchase?.requiredMm != null ? `${(drawing.completionPurchase.requiredMm / 1000).toFixed(2)} m` : 'Not estimated'}
              <br />
              Suggested cable ·{" "}
              {drawing.completionPurchase ? cablePurchaseLengthLabel(drawing.completionPurchase) : 'Not estimated'}
            </div>
          )}
          <div className="text-content-muted">
            {drawing.reachablePorts} reachable ports on this face
          </div>
        </div>
      )}
      <div role="status" className="h-12 overflow-auto text-content-secondary">
        {drawing.message ||
          (drawing.completionPlan
            ? `Click to finish at ${drawing.hover?.label}`
            : drawing.hover?.label) ||
          (drawing.source
            ? "You can finish directly at a port; routing points are optional."
            : "Green: available · Grey: unavailable · Gold: routing point")}
      </div>
      <div className="flex items-center gap-2">
        <button
          className={sceneButtonClass}
          disabled={!drawing.source}
          onClick={drawing.back}
        >
          Step back
        </button>
        <span className="text-content-muted">Backspace · Esc to cancel</span>
      </div>
    </div>
  );
}
