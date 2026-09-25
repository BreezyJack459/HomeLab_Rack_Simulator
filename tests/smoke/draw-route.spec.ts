import { expect, test } from "@playwright/test";
import type { RackLayout } from "../../src/types/rack";
import type { useRackStore } from "../../src/store/rackStore";
const fixture: RackLayout = {
  id: "draw-browser",
  name: "Draw route test",
  rackType: "19in",
  heightU: 18,
  rackDepthMm: 800,
  weightLimitKg: 500,
  powerBudgetW: 4000,
  viewSide: "rear",
  updatedAt: "",
  cables: [],
  devices: [10, 6].map((positionU, i) => ({
    id: i ? "b" : "a",
    name: i ? "Lower device" : "Upper device",
    category: "server",
    positionU,
    sizeU: 1,
    depthMm: 400,
    widthType: "19in",
    ports: { ethernet: 2, power: 1 },
    color: "#64748b",
    powerW: 10,
    weightKg: 1,
    heatLevel: 1,
  })),
};
test("draw through selected points, save, reload, and cancel without creating a cable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.evaluate(
    (fixture) =>
      (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
        .getState()
        .loadLayout(fixture),
    fixture,
  );
  await page.getByRole("button", { name: "Cable", exact: true }).click();
  await page.getByRole("button", { name: "3D routing", exact: true }).click();
  const viewer = page.getByTestId("cable-viewer-3d");
  await viewer.getByRole("button", { name: "Draw route", exact: true }).click();
  const draw = page.getByTestId("route-drawing");
  await draw.getByRole("button", { name: "ethernet 1", exact: true }).click();
  await draw
    .getByRole("button", { name: "rear left · U10", exact: true })
    .click();
  await draw.getByLabel("Routing point height").selectOption("6");
  await draw
    .getByRole("button", { name: "rear left · U6", exact: true })
    .click();
  await expect(draw.getByRole("listitem")).toHaveCount(2);
  await draw.getByRole("button", { name: "Step back", exact: true }).click();
  await expect(draw.getByRole("listitem")).toHaveCount(1);
  await draw
    .getByRole("button", { name: "rear left · U6", exact: true })
    .click();
  // A numbered point in the actual 3D scene rewinds only the following path.
  await viewer
    .getByRole("button", { name: "Continue from point 1", exact: true })
    .click();
  await expect(draw.getByRole("listitem")).toHaveCount(1);
  await draw
    .getByRole("button", { name: "rear left · U6", exact: true })
    .click();
  await draw.getByLabel("Drawing device").selectOption("b");
  await draw.getByRole("button", { name: "ethernet 1", exact: true }).hover();
  await expect(draw.getByTestId("drawing-length")).toContainText(
    "Suggested cable",
  );
  await expect(draw.getByRole("status")).toContainText(
    "Click to finish at Lower device",
  );
  await expect(viewer.getByTestId("drawing-point-label").first()).toBeVisible({
    timeout: 20000,
  });
  await expect
    .poll(async () => (await viewer.locator("canvas").screenshot()).length, {
      timeout: 20000,
    })
    .toBeGreaterThan(15000);
  // Let the camera finish its resize/face transition before reviewing the frame.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/draw-route-preview.png" });
  await draw.getByRole("button", { name: "ethernet 1", exact: true }).click();
  await expect(draw).toHaveCount(0);
  await expect(
    viewer.getByText("3D route: Custom route · 2 routing points"),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      (
        window as unknown as { __rackStore: typeof useRackStore }
      ).__rackStore.getState().layout.cables,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].manualPath).toHaveLength(2);
  await viewer
    .getByRole("button", { name: "Redraw route", exact: true })
    .click();
  await expect(draw.getByRole("listitem")).toHaveCount(2);
  await draw.getByRole("button", { name: "Step back", exact: true }).click();
  await draw.getByRole("button", { name: "Step back", exact: true }).click();
  await draw.getByRole("button", { name: "ethernet 1", exact: true }).click();
  await expect(
    viewer.getByText("3D route: Custom route · 0 routing points"),
  ).toBeVisible();
  const edited = await page.evaluate(
    () =>
      (
        window as unknown as { __rackStore: typeof useRackStore }
      ).__rackStore.getState().layout.cables,
  );
  expect(edited).toHaveLength(1);
  expect(edited[0].id).toBe(saved[0].id);
  await page.evaluate(() =>
    (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
      .getState()
      .undo(),
  );
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __rackStore: typeof useRackStore }
        ).__rackStore.getState().layout.cables[0].manualPath,
    ),
  ).toEqual(saved[0].manualPath);
  await page.getByRole("button", { name: "2D map", exact: true }).click();
  await expect(page.getByTestId("cable-viewer-3d")).toHaveCount(0);
  await page.getByRole("button", { name: "3D routing", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Cable", exact: true }).click();
  await page.getByRole("button", { name: "3D routing", exact: true }).click();
  await expect(viewer).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __rackStore: typeof useRackStore }
        ).__rackStore.getState().layout.cables[0].manualPath,
    ),
  ).toEqual(saved[0].manualPath);
  await viewer.getByRole("button", { name: "Draw route", exact: true }).click();
  await draw.getByRole("button", { name: "ethernet 2", exact: true }).click();
  await draw.getByRole("button", { name: "Step back", exact: true }).focus();
  await page.keyboard.press("Backspace");
  await expect(
    draw.getByText("Draw route · Choose source", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(draw).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __rackStore: typeof useRackStore }
        ).__rackStore.getState().layout.cables.length,
    ),
  ).toBe(1);
});

test("drawing hints recover after an invalid pick and clear when changing face", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.evaluate(
    (fixture) =>
      (window as unknown as { __rackStore: typeof useRackStore }).__rackStore
        .getState()
        .loadLayout(fixture),
    fixture,
  );
  await page.getByRole("button", { name: "Cable", exact: true }).click();
  await page.getByRole("button", { name: "3D routing", exact: true }).click();
  const viewer = page.getByTestId("cable-viewer-3d");
  await viewer.getByRole("button", { name: "Draw route", exact: true }).click();
  const draw = page.getByTestId("route-drawing");
  await draw.getByRole("button", { name: "ethernet 1", exact: true }).click();
  await draw.getByLabel("Drawing device").selectOption("b");
  await draw
    .getByRole("button", { name: "power 1", exact: true })
    .click({ force: true });
  await expect(draw.getByRole("status")).toContainText(
    "power port cannot connect to the ethernet source",
  );
  await draw.getByRole("button", { name: "ethernet 2", exact: true }).hover();
  await expect(draw.getByRole("status")).toContainText(
    "Click to finish at Lower device",
  );
  await expect(draw.getByTestId("drawing-length")).toContainText("With slack");
  await draw.getByRole("button", { name: "Front ports", exact: true }).click();
  await expect(draw.getByRole("status")).not.toContainText("Lower device");
  await expect(draw.getByTestId("drawing-length")).toContainText(
    "Drawn so far",
  );
  await expect(draw.getByTestId("drawing-length")).not.toContainText(
    "Suggested cable",
  );
  await draw.getByRole("button", { name: "Rear ports", exact: true }).click();
  await draw
    .getByRole("button", { name: "rear left · U10", exact: true })
    .click();
  await draw
    .getByRole("button", { name: "Continue from source", exact: true })
    .click();
  await expect(draw.getByRole("listitem")).toHaveCount(0);
  await expect(
    draw.getByText("Draw route · Choose next point", { exact: true }),
  ).toBeVisible();
  await draw
    .getByRole("button", { name: "Cancel drawing", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __rackStore: typeof useRackStore }
        ).__rackStore.getState().layout.cables.length,
    ),
  ).toBe(0);
});
