import { expect, test } from "@playwright/test";
import type { useRackStore } from "../../src/store/rackStore";

test.describe("Organized shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem("rack-simulator-new-shell") === null) {
        localStorage.setItem("rack-simulator-new-shell", "1");
      }
      localStorage.removeItem("homelab-rack-simulator-layout-prefs");
    });
  });
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 900, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    test(`keeps workflow and view controls accessible at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      for (const name of [
        "Build Rack",
        "Cable",
        "Check Health",
        "2D",
        "3D",
        "Front",
        "Rear",
      ])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
      await page.getByRole("button", { name: "Cable", exact: true }).click();
      for (const name of ["2D map", "3D routing", "Topology", "Table"])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      if (viewport.width < 1024) {
        await page
          .getByRole("button", { name: "Cable list", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Cable list" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "+ Connect cable", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Cable list" }),
        ).not.toBeVisible();
        await expect(
          page.getByRole("region", { name: "Visual cable connector" }),
        ).toBeVisible();
        await expect(page.getByRole("dialog", { name: "Inspector" })).not.toBeVisible();
        await page.getByRole("button", { name: "Cancel connection" }).click();
      }
      await page
        .getByRole("button", { name: "File and export options" })
        .click();
      await expect(
        page.getByRole("button", { name: "New rack layout", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "New rack layout", exact: true }),
      ).not.toBeVisible();
    });
  }
  test("retains cable selection, filters and view while moving between workflows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const cableId = await page.evaluate(() => {
      const s = (
        window as unknown as { __rackStore: typeof useRackStore }
      ).__rackStore.getState();
      const cable = s.layout.cables[0];
      s.selectCable(cable.id);
      return cable.id;
    });
    await page.getByRole("button", { name: "Cable", exact: true }).click();
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Filter cable routes" })
      .fill("power");
    await page.getByRole("button", { name: "Build Rack", exact: true }).click();
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await page
      .getByRole("button", { name: "Check Health", exact: true })
      .click();
    await page.getByRole("button", { name: "Cable", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Table", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("searchbox", { name: "Filter cable routes" }),
    ).toHaveValue("power");
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as { __rackStore: typeof useRackStore }
          ).__rackStore.getState().selectedCableId,
      ),
    ).toBe(cableId);
    await page.getByRole("button", { name: "Build Rack", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "3D", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  test("enables optional workspaces through Tools and opens focused settings", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Tools/ }).click();
    await page.getByRole("button", { name: /Operations/ }).click();
    await expect(
      page
        .getByRole("heading", { name: "Run operations", exact: true })
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /Tools/ }).click();
    await page.getByRole("button", { name: /Settings →/ }).click();
    await page
      .getByRole("button", { name: "Manage plugins", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
  test("supports the classic chrome fallback", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("rack-simulator-new-shell", "0"),
    );
    await page.reload();
    await expect(page.getByTestId("shell-top-bar")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "2D", exact: true }),
    ).toBeVisible();
  });
});

test("owned inventory supports drag placement, undo and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("rack-simulator-new-shell", "1");
    localStorage.removeItem("homelab-rack-simulator-layout-prefs");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "File and export options" }).click();
  await page
    .getByRole("button", { name: "New rack layout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByRole("button", { name: /^Save .* to My devices$/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "My devices (1)", exact: true }).click();
  const inventory = page.getByRole("tabpanel", {
    name: "My devices",
    exact: true,
  });
  await inventory
    .locator("article")
    .first()
    .dragTo(page.getByTestId("rack-frame"));
  await expect(page.getByTestId("rack-device-count")).toHaveText("1 devices");
  await expect(
    page.getByRole("tab", { name: "My devices (0)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("rack-device-count")).toHaveText("0 devices");
  await expect(
    page.getByRole("tab", { name: "My devices (1)", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "My devices (1)", exact: true }),
  ).toBeVisible();
});

test('shares route filtering with topology and the table', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await page.getByRole('button',{name:'Cable',exact:true}).click();
  await page.getByRole('searchbox',{name:'Filter cable routes'}).fill('no-such-cable-123');
  await page.getByRole('button',{name:'Topology',exact:true}).click();
  await expect(page.locator('[data-topology-route]')).toHaveCount(0);
  await page.getByRole('button',{name:'Table',exact:true}).click();
  await expect(page.getByText('No cables match the current filters.',{exact:false})).toBeVisible();
  await page.getByRole('searchbox',{name:'Filter cable routes'}).fill('');
  await page.getByRole('button',{name:'Topology',exact:true}).click();
  expect(await page.locator('[data-topology-route]').count()).toBeGreaterThan(0);
});
