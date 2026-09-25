import { beforeEach, describe, expect, it } from "vitest";
import { useRackStore } from "./rackStore";
import { deviceCatalog } from "../data/deviceCatalog";
import { getRackTotals } from "../utils/validation";

const template = deviceCatalog.find(
  (d) => d.widthType === "19in" && d.defaultU === 1 && d.category === "switch",
)!;
const store = () => useRackStore.getState();
beforeEach(() => {
  store().createRack("Inventory test", "19in", 12);
});

describe("owned device inventory", () => {
  it("excludes inventory from rack totals and preserves identity and edits when placing, storing and undoing", () => {
    store().addDeviceToInventory(template.id);
    const inventory = store().layout.unplacedDevices![0];
    expect(store().layout.devices).toHaveLength(0);
    expect(getRackTotals(store().layout).powerW).toBe(0);
    expect(store().placeInventoryDevice(inventory.id, 3)).toBe(true);
    store().updateDevice(inventory.id, {
      label: "My core switch",
      portFaceOverrides: { ethernet: "rear" },
    });
    expect(store().moveDeviceToInventory(inventory.id)).toBe(true);
    expect(store().layout.unplacedDevices![0]).toMatchObject({
      id: inventory.id,
      label: "My core switch",
      portFaceOverrides: { ethernet: "rear" },
    });
    store().undo();
    expect(store().layout.devices[0].id).toBe(inventory.id);
    expect(store().layout.unplacedDevices).toHaveLength(0);
    store().redo();
    expect(store().layout.devices).toHaveLength(0);
    expect(store().placeInventoryDevice(inventory.id, 5)).toBe(true);
    expect(store().layout.devices[0]).toMatchObject({
      id: inventory.id,
      positionU: 5,
      label: "My core switch",
    });
  });
  it("rejects occupied and incompatible rack placements without losing inventory", () => {
    store().addDeviceFromTemplate(template.id, 1);
    store().addDeviceToInventory(template.id);
    const id = store().layout.unplacedDevices![0].id;
    expect(store().placeInventoryDevice(id, 1)).toBe(false);
    expect(store().layout.unplacedDevices).toHaveLength(1);
    store().setRackType("10in");
    expect(store().placeInventoryDevice(id, 5)).toBe(false);
    expect(store().layout.unplacedDevices).toHaveLength(1);
  });
  it("blocks connected equipment and keeps its cables intact", () => {
    store().addDeviceFromTemplate(template.id, 1);
    store().addDeviceFromTemplate(template.id, 3);
    const [a, b] = store().layout.devices;
    store().addCable({
      type: "ethernet",
      color: "#38bdf8",
      fromDeviceId: a.id,
      toDeviceId: b.id,
      nodes: [],
    });
    expect(store().moveDeviceToInventory(a.id)).toBe(false);
    expect(store().layout.cables).toHaveLength(1);
    expect(store().layout.devices).toHaveLength(2);
  });
  it("roundtrips inventory through JSON import and gives duplicated racks new inventory identities", () => {
    store().addDeviceToInventory(template.id);
    const id = store().layout.unplacedDevices![0].id;
    store().loadLayout(JSON.parse(JSON.stringify(store().layout)));
    expect(store().layout.unplacedDevices![0].id).toBe(id);
    store().duplicateRack(store().layout.id, "Inventory copy");
    expect(store().layout.unplacedDevices![0].id).not.toBe(id);
    expect(store().layout.unplacedDevices![0].templateId).toBe(template.id);
  });
  it("keeps external devices in inventory and makes inventory deletion undoable", () => {
    const external = deviceCatalog.find((d) => d.rackMountable === false)!;
    store().addDeviceToInventory(external.id);
    const id = store().layout.unplacedDevices![0].id;
    expect(store().placeInventoryDevice(id)).toBe(false);
    store().removeInventoryDevice(id);
    expect(store().layout.unplacedDevices).toHaveLength(0);
    store().undo();
    expect(store().layout.unplacedDevices![0].id).toBe(id);
  });
});

it("persists edits made after replacing a rack with a new layout", () => {
  store().newLayout();
  expect(store().currentRackId).toBe(store().layout.id);
  store().addDeviceToInventory(template.id);
  const id = store().layout.unplacedDevices![0].id;
  store().saveLocal();
  store().loadLocal();
  expect(
    store().workspace.racks.some((r) =>
      r.unplacedDevices?.some((d) => d.id === id),
    ),
  ).toBe(true);
});
