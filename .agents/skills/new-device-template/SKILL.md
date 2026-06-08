---
name: new-device-template
description: Standardized workflow for adding a new device template to the rack simulator. Ensures deviceCatalog.ts, portLayout.ts, 2D/3D compatibility, and templateToDevice() field copying are all handled correctly.
disable-model-invocation: true
---

# Add New Device Template

Use this skill when adding a new device template to the Homelab Rack Simulator.

## Prerequisites

- Identify the device category, dimensions (width, depth, height in U), and port configuration
- Determine if it is a single-face device (PDU/UPS/0U-PDU) or dual-face
- Decide on color and any special properties (customWidthMm, isHorizontal, etc.)

## Step-by-Step Checklist

### 1. Add Entry to deviceCatalog.ts

- Open `src/data/deviceCatalog.ts`
- Add a new `DeviceTemplate` entry at the appropriate location (grouped by category)
- Ensure all required fields are populated:
  - `id`, `name`, `category`, `uHeight`, `depth`, `color`
  - `widthType` (or `customWidthMm` for non-standard widths)
  - `ports` array with correct `type`, `speed`, `count`
  - `portLayouts` if non-default port columns are needed per face
  - `portFaceOverrides` if the device deviates from the default face mapping

### 2. Update portLayout.ts Face Mapping

- Open `src/utils/portLayout.ts`
- Ensure the new `category` has a case in `getPortFaceMap()`
- Default is `'front'` for everything — if the device should have rear ports, add explicit mapping

### 3. Set Port Columns (if needed)

- If the device needs non-default port grid columns, set:
  ```ts
  portLayouts: {
    front: [{ type: 'RJ45', columns: 8 }],  // override default columns
    rear:  [{ type: 'IEC', columns: 4 }]
  }
  ```
- Verify `buildPortLayout()` produces the expected slot positions

### 4. Verify templateToDevice() Copies New Fields

- Open `src/store/rackStore.ts` (or wherever `templateToDevice()` is defined)
- Check that any new template-level field added to `DeviceTemplate` is also copied to `PlacedDevice`
- **Critical**: Forgetting this silently drops fields on placement (e.g. `portFaceOverrides`, `portLayouts`)

### 5. Test in 2D View

- Run `npm run dev` and switch to 2D view
- Drag the new template from ComponentLibrary into the rack
- Verify:
  - Correct U height and width rendering
  - Port strip displays correctly (if applicable)
  - Single-face devices (PDU/UPS/0U-PDU) skip fallback correctly via `isSingleFaceDevice` check

### 6. Test in 3D View

- Switch to 3D view
- Verify the device model renders correctly
- If the device has ports, verify 3D port squares match the expected layout from `buildPortLayout()`
- Cable endpoints must match these positions exactly

### 7. Run Tests

```bash
npm test
```

- Ensure no existing tests are broken
- If the device introduces new port behavior, consider adding unit tests in `src/utils/portLayout.test.ts` or similar

### 8. Export/Import Round-Trip

- Save a layout with the new device placed
- Export to JSON
- Clear localStorage / reload
- Import the JSON
- Verify the device loads correctly and all fields are preserved

## Common Mistakes to Avoid

- ❌ Forgetting to add `category` to `getPortFaceMap()` → all ports default to front
- ❌ Setting `portLayouts` columns that conflict with `ports[].count` → grid mismatch
- ❌ Not copying new fields in `templateToDevice()` → data loss on placement
- ❌ Only testing 2D or 3D, not both → cable endpoints may mismatch
