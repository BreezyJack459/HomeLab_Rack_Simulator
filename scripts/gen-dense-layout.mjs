// Generates dense 42U layout fixtures (60 and 100 routes) for rack-scene
// performance checks. Output: tests/fixtures/dense-42u-{60,100}.json
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outDir = resolve('tests/fixtures');
await mkdir(outDir, { recursive: true });

const device = (overrides) => ({
  category: 'server',
  positionU: 1,
  sizeU: 1,
  depthMm: 400,
  widthType: '19in',
  weightKg: 8,
  powerW: 150,
  heatLevel: 2,
  color: '#3b82f6',
  ...overrides
});

function buildDevices() {
  const devices = [
    device({ id: 'pdu-rear', name: 'Rear PDU', category: 'pdu', positionU: 1, mountSide: 'rear', ports: { power: 12 }, color: '#fb923c' }),
    device({ id: 'hcm-top', name: 'Top HCM', category: 'cable-management', positionU: 41, depthMm: 100 }),
    device({ id: 'hcm-mid', name: 'Mid HCM', category: 'cable-management', positionU: 27, depthMm: 100 })
  ];
  for (let i = 0; i < 6; i++) {
    devices.push(
      device({
        id: `sw-${i}`,
        name: `Switch ${i + 1}`,
        category: 'switch',
        positionU: 35 + i,
        ports: { ethernet: 24 },
        color: '#38bdf8'
      })
    );
  }
  for (let i = 0; i < 12; i++) {
    devices.push(
      device({
        id: `srv-${i}`,
        name: `Server ${i + 1}`,
        category: 'server',
        positionU: 3 + i * 2,
        sizeU: 2,
        ports: { ethernet: 2, power: 2 },
        color: '#8b5cf6'
      })
    );
  }
  return devices;
}

function buildLayout(routeCount) {
  const devices = buildDevices();
  const cables = [];
  const ethernetCount = routeCount - 12;
  for (let i = 0; i < ethernetCount; i++) {
    const sw = `sw-${i % 6}`;
    const srv = `srv-${i % 12}`;
    cables.push({
      id: `eth-${String(i).padStart(3, '0')}`,
      type: 'ethernet',
      color: '',
      fromDeviceId: sw,
      fromPort: { type: 'ethernet', index: i % 24 },
      toDeviceId: srv,
      toPort: { type: 'ethernet', index: i % 2 }
    });
  }
  for (let i = 0; i < 12; i++) {
    cables.push({
      id: `pwr-${String(i).padStart(3, '0')}`,
      type: 'power',
      color: '',
      fromDeviceId: 'pdu-rear',
      fromPort: { type: 'power', index: i },
      toDeviceId: `srv-${i}`,
      toPort: { type: 'power', index: i % 2 }
    });
  }
  return {
    id: `dense-42u-${routeCount}`,
    name: `Dense 42U (${routeCount} routes)`,
    rackType: '19in',
    heightU: 42,
    rackDepthMm: 800,
    weightLimitKg: 800,
    powerBudgetW: 6000,
    viewSide: 'front',
    devices,
    cables,
    updatedAt: '2026-08-13T00:00:00.000Z'
  };
}

for (const count of [60, 100]) {
  const layout = buildLayout(count);
  const file = resolve(outDir, `dense-42u-${count}.json`);
  await writeFile(file, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(`wrote ${file} (${layout.cables.length} cables, ${layout.devices.length} devices)`);
}
