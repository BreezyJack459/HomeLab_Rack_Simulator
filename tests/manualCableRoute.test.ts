import { describe, expect, it } from "vitest";
import type { CableRoute, PlacedDevice, RackLayout } from "../src/types/rack";
import {
  manualRoutePoints,
  portLeadPoints,
  resolveRouteAnchor,
  routeLengthMm,
} from "../src/utils/manualCableRoute";
import { validateImportedLayout } from "../src/utils/layoutValidation";
import { calculateCablePlan } from "../src/utils/routing";
import { buildRackSceneModel } from "../src/utils/rackSceneModel";
import { drawingCable, drawingObstruction } from "../src/utils/cableDrawing";
import { portChoicesForDevice } from "../src/utils/portSelection";
import { useRackStore } from "../src/store/rackStore";
const device = (id: string, positionU: number): PlacedDevice => ({
  id,
  name: id,
  category: "server",
  positionU,
  sizeU: 1,
  depthMm: 400,
  widthType: "19in",
  ports: { ethernet: 2, power: 1 },
  color: "#aaa",
  weightKg: 1,
  powerW: 10,
  heatLevel: 1,
});
const fixture = (): RackLayout => ({
  id: "manual",
  name: "Manual",
  rackType: "19in",
  heightU: 18,
  rackDepthMm: 800,
  weightLimitKg: 500,
  powerBudgetW: 4000,
  viewSide: "rear",
  updatedAt: "",
  devices: [device("a", 10), device("b", 6)],
  cables: [],
});
const cable: CableRoute = {
  id: "manual-cable",
  type: "ethernet",
  color: "#38bdf8",
  fromDeviceId: "a",
  toDeviceId: "b",
  fromPort: { type: "ethernet", index: 0, side: "rear" },
  toPort: { type: "ethernet", index: 0, side: "rear" },
  manualPath: [],
};
describe("User drawn cable routes", () => {
  it("shares exact path and length between plan and both 3D styles", () => {
    const layout = fixture();
    const custom: CableRoute = {
      ...cable,
      manualPath: [
        { kind: "channel", face: "rear", side: "left", positionU: 10 },
        { kind: "channel", face: "rear", side: "left", positionU: 6 },
      ],
    };
    layout.cables = [custom];
    const points = manualRoutePoints(custom, layout);
    const plan = calculateCablePlan(custom, layout)!;
    expect(plan.baseLengthMm).toBeCloseTo(routeLengthMm(points, layout));
    expect(plan.segments.reduce((n, s) => n + s.lengthMm, 0)).toBeCloseTo(
      plan.baseLengthMm,
    );
    expect(plan.baseLengthMm).toBeGreaterThan(
      calculateCablePlan(cable, layout)!.baseLengthMm,
    );
    for (const routingMode of ["clean", "realistic"] as const) {
      const route = buildRackSceneModel(layout, { routingMode }).routes[0];
      expect(route.routingDecision.kind).toBe("manual");
      expect(route.points).toEqual(points);
    }
  });
  it("rejects PDU/body obstructions, including a side-channel point", () => {
    const layout = fixture();
    const points = manualRoutePoints(cable, layout);
    layout.devices.push({
      ...device("pdu", 8),
      name: "Blocked PDU",
      category: "pdu",
      mountSide: "rear",
      depthMm: 800,
    });
    expect(drawingObstruction(layout, points, "a", "b")).toContain(
      "Blocked PDU",
    );
    layout.cables = [cable];
    expect(buildRackSceneModel(layout).routes[0].routingDecision.kind).toBe(
      "blocked",
    );
  });
  it("keeps references on save, reload and device moves; missing managers block the route", () => {
    const layout = fixture();
    layout.devices.push({
      ...device("manager", 8),
      category: "cable-management",
      ports: {},
    });
    const custom: CableRoute = {
      ...cable,
      manualPath: [{ kind: "manager", deviceId: "manager", side: "left" }],
    };
    const before = resolveRouteAnchor(custom.manualPath![0], layout)!;
    useRackStore.getState().loadLayout(layout);
    useRackStore.getState().addCable(custom);
    const saved = useRackStore.getState().layout;
    useRackStore.getState().loadLayout(JSON.parse(JSON.stringify(saved)));
    expect(useRackStore.getState().layout.cables[0].manualPath).toEqual(
      custom.manualPath,
    );
    const moved = {
      ...layout,
      devices: layout.devices.map((d) =>
        d.id === "manager" ? { ...d, positionU: 9 } : d,
      ),
    };
    expect(resolveRouteAnchor(custom.manualPath![0], moved)!.y).toBeGreaterThan(
      before.y,
    );
    layout.devices = layout.devices.filter((d) => d.id !== "manager");
    layout.cables = [custom];
    expect(manualRoutePoints(custom, layout)).toEqual([]);
    expect(buildRackSceneModel(layout).routes[0].routingDecision.kind).toBe(
      "blocked",
    );
  });
  it("rejects occupied and incompatible ports and allows non-Ethernet cables", () => {
    const layout = fixture();
    const picks = layout.devices.map((d) => portChoicesForDevice(d, layout));
    const a = picks[0].find((p) => p.type === "ethernet")!;
    const b = picks[1].find((p) => p.type === "ethernet")!;
    expect(drawingCable(layout, a, b)?.fromPort).toEqual(cable.fromPort);
    expect(
      drawingCable(layout, a, picks[1].find((p) => p.type === "power")!),
    ).toBeNull();
    expect(
      drawingCable(
        layout,
        picks[0].find((p) => p.type === "power")!,
        picks[1].find((p) => p.type === "power")!,
      )?.type,
    ).toBe("power");
    layout.cables = [cable];
    expect(drawingCable(layout, a, b)).toBeNull();
  });
  it("keeps PDU connector exit direction before dropping down", () => {
    const layout = fixture();
    layout.devices[0] = {
      ...layout.devices[0],
      category: "pdu",
      portFaceOverrides: { power: "rear" },
    };
    const points = portLeadPoints(layout, "a", {
      type: "power",
      index: 0,
      side: "rear",
    });
    expect(points).toHaveLength(3);
    expect(points[1].y).toBe(points[0].y);
    expect(points[1].z).toBeLessThan(points[0].z);
    expect(points[2].y).toBeLessThan(points[1].y);
    const power = {
      ...cable,
      type: "power" as const,
      fromPort: { type: "power" as const, index: 0, side: "rear" as const },
      toPort: { type: "power" as const, index: 0, side: "rear" as const },
    };
    const plan = calculateCablePlan(power, layout)!;
    expect(plan.segments.length).toBe(
      manualRoutePoints(power, layout).length - 1,
    );
    expect(
      plan.segments.reduce((sum, segment) => sum + segment.lengthMm, 0),
    ).toBeCloseTo(plan.baseLengthMm);
  });
  it("rejects a manager opening occupied by a PDU", () => {
    const layout = fixture();
    layout.devices.push({
      ...device("manager", 8),
      category: "cable-management",
      mountSide: "rear",
      depthMm: 80,
      ports: {},
    });
    layout.devices.push({
      ...device("pdu", 8),
      category: "pdu",
      mountSide: "rear",
      depthMm: 800,
    });
    const point = resolveRouteAnchor(
      { kind: "manager", deviceId: "manager", side: "left" },
      layout,
    )!;
    expect(
      drawingObstruction(
        layout,
        [...portLeadPoints(layout, "a", cable.fromPort), point],
        "a",
      ),
    ).toContain("pdu");
  });
  it("rejects malformed manual paths on import and blocks lost anchors", () => {
    const layout = fixture();
    layout.cables = [{ ...cable, manualPath: [null] as never }];
    expect(validateImportedLayout(layout).valid).toBe(false);
    expect(manualRoutePoints(layout.cables[0], layout)).toEqual([]);
    expect(buildRackSceneModel(layout).routes[0].routingDecision.kind).toBe(
      "blocked",
    );
  });
});
