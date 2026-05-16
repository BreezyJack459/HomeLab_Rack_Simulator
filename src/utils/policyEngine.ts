import type { PlacedDevice, RackLayout, RackPolicy, RackPolicyType, ValidationIssue } from '../types/rack';
import { getPortMetadata } from './portLayout';
import { isPdu } from './routing';
import { getDeviceMountSide, isZeroU, occupiedUnits } from './rackMath';

export const DEFAULT_POLICY_PARAMS: Record<
  RackPolicyType,
  Record<string, number | string>
> = {
  'ups-bottom-zone': { maxPercent: 25 },
  'heavy-device-bottom-zone': { weightThresholdKg: 8, maxPercent: 50 },
  'free-u-percent': { minPercent: 10 },
  'switch-port-free-percent': { minPercent: 20 },
  'dual-psu-circuit-split': {},
  'heat-separation': { minGapU: 1 },
  'power-budget-headroom': { minPercent: 10 },
  'no-endpoint-switch-direct': {},
};

export function getDefaultPolicies(): RackPolicy[] {
  const types = Object.keys(DEFAULT_POLICY_PARAMS) as RackPolicyType[];
  return types.map((type, index) => ({
    id: `policy-${type}-${index}`,
    type,
    enabled: false,
    severity: 'warning' as const,
    params: { ...DEFAULT_POLICY_PARAMS[type] },
  }));
}

function makeIssue(
  policy: RackPolicy,
  title: string,
  detail: string,
  deviceIds?: string[],
  cableIds?: string[]
): ValidationIssue {
  return {
    id: `policy-${policy.type}-${policy.id}`,
    severity: policy.severity,
    title,
    detail,
    deviceIds,
    cableIds,
  };
}

// ── Rule evaluators ──

function evaluateUpsBottomZone(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const maxPercent = Number(policy.params.maxPercent ?? 25);
  const maxAllowedU = Math.max(1, Math.floor(layout.heightU * (maxPercent / 100)));
  const violations: ValidationIssue[] = [];

  for (const device of layout.devices) {
    if (device.category !== 'ups') continue;
    if (device.positionU > maxAllowedU) {
      violations.push(
        makeIssue(
          policy,
          'UPS is not in the bottom zone',
          `${device.name} is at U${device.positionU}, above the ${maxPercent}% threshold (U${maxAllowedU}). Move heavy UPS units lower for stability.`,
          [device.id]
        )
      );
    }
  }
  return violations;
}

function evaluateHeavyDeviceBottomZone(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const weightThreshold = Number(policy.params.weightThresholdKg ?? 8);
  const maxPercent = Number(policy.params.maxPercent ?? 50);
  const maxAllowedU = Math.max(1, Math.floor(layout.heightU * (maxPercent / 100)));
  const violations: ValidationIssue[] = [];

  for (const device of layout.devices) {
    if (isZeroU(device)) continue;
    if (device.weightKg < weightThreshold) continue;
    if (device.positionU > maxAllowedU) {
      violations.push(
        makeIssue(
          policy,
          'Heavy device is not in the bottom zone',
          `${device.name} weighs ${device.weightKg}kg and is at U${device.positionU}, above the ${maxPercent}% threshold (U${maxAllowedU}). Heavy items should sit lower for safety.`,
          [device.id]
        )
      );
    }
  }
  return violations;
}

function evaluateFreeUPercent(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const minPercent = Number(policy.params.minPercent ?? 10);
  const usedU = occupiedUnits(layout.devices, layout.heightU).size;
  const freePercent = ((layout.heightU - usedU) / layout.heightU) * 100;

  if (freePercent < minPercent) {
    return [
      makeIssue(
        policy,
        'Free U space is below policy threshold',
        `Only ${freePercent.toFixed(1)}% of U space is free (policy requires ${minPercent}%). Leave room for future expansion.`
      ),
    ];
  }
  return [];
}

function evaluateSwitchPortFreePercent(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const minPercent = Number(policy.params.minPercent ?? 20);
  const switches = layout.devices.filter((d) => d.category === 'switch');
  if (switches.length === 0) return [];

  let totalPorts = 0;
  for (const sw of switches) {
    const ports = sw.ports;
    if (ports) {
      totalPorts +=
        (ports.ethernet ?? 0) +
        (ports.fiber ?? 0) +
        (ports.usb ?? 0) +
        (ports.hdmi ?? 0) +
        (ports.power ?? 0) +
        (ports.atx ?? 0) +
        (ports.coax ?? 0);
    }
  }
  if (totalPorts === 0) return [];

  // Count claimed ports via cables
  const claimedPorts = new Set<string>();
  for (const cable of layout.cables) {
    if (cable.fromPort) {
      claimedPorts.add(`${cable.fromDeviceId}:${cable.fromPort.type}:${cable.fromPort.index}`);
    }
    if (cable.toPort) {
      claimedPorts.add(`${cable.toDeviceId}:${cable.toPort.type}:${cable.toPort.index}`);
    }
  }

  const usedPorts = Array.from(claimedPorts).filter((key) => {
    const [deviceId, portType] = key.split(':');
    const device = layout.devices.find((d) => d.id === deviceId);
    return device?.category === 'switch' && portType !== 'power';
  }).length;

  const freePercent = ((totalPorts - usedPorts) / totalPorts) * 100;
  if (freePercent < minPercent) {
    return [
      makeIssue(
        policy,
        'Switch port headroom is below policy threshold',
        `Only ${freePercent.toFixed(1)}% of switch ports are free (policy requires ${minPercent}%). Leave ports for future devices and redundancy.`
      ),
    ];
  }
  return [];
}

function evaluateDualPsuCircuitSplit(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const servers = layout.devices.filter(
    (d) => d.category === 'server' && (d.ports?.power ?? 0) >= 2
  );
  const violations: ValidationIssue[] = [];

  for (const server of servers) {
    const powerCables = layout.cables.filter(
      (cable) =>
        cable.type === 'power' &&
        (cable.fromDeviceId === server.id || cable.toDeviceId === server.id)
    );
    if (powerCables.length < 2) continue;

    const circuits = new Set<string>();
    for (const cable of powerCables) {
      const pdu = layout.devices.find(
        (d) => isPdu(d) && (d.id === cable.fromDeviceId || d.id === cable.toDeviceId)
      );
      if (pdu?.circuit) {
        circuits.add(pdu.circuit);
      }
    }

    if (circuits.size <= 1) {
      violations.push(
        makeIssue(
          policy,
          'Dual PSU server is not split across circuits',
          `${server.name} has ${powerCables.length} power cable(s) but they all route to the same circuit. For true redundancy, connect each PSU to a different circuit (A and B).`,
          [server.id],
          powerCables.map((c) => c.id)
        )
      );
    }
  }
  return violations;
}

function evaluateHeatSeparation(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const minGapU = Number(policy.params.minGapU ?? 1);
  const highHeat = layout.devices.filter((d) => !isZeroU(d) && d.heatLevel >= 4);
  const violations: ValidationIssue[] = [];

  for (let i = 0; i < highHeat.length; i += 1) {
    for (let j = i + 1; j < highHeat.length; j += 1) {
      const a = highHeat[i];
      const b = highHeat[j];
      if (getDeviceMountSide(a) !== getDeviceMountSide(b)) continue;

      const distance = Math.min(
        Math.abs(a.positionU - (b.positionU + b.sizeU - 1)),
        Math.abs(b.positionU - (a.positionU + a.sizeU - 1))
      );
      if (distance < minGapU) {
        violations.push(
          makeIssue(
            policy,
            'High-heat devices are too close together',
            `${a.name} and ${b.name} are ${distance}U apart (policy requires ${minGapU}U minimum). Separate them or add airflow gaps.`,
            [a.id, b.id]
          )
        );
      }
    }
  }
  return violations;
}

function evaluatePowerBudgetHeadroom(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const minPercent = Number(policy.params.minPercent ?? 10);
  const totalPower = layout.devices.reduce((sum, d) => sum + d.powerW, 0);
  const usedPercent = (totalPower / layout.powerBudgetW) * 100;

  if (usedPercent > 100 - minPercent) {
    return [
      makeIssue(
        policy,
        'Power budget headroom is below policy threshold',
        `Rack uses ${usedPercent.toFixed(1)}% of power budget (policy requires ${minPercent}% headroom). Current: ${totalPower}W / ${layout.powerBudgetW}W.`
      ),
    ];
  }
  return [];
}

function evaluateNoEndpointSwitchDirect(layout: RackLayout, policy: RackPolicy): ValidationIssue[] {
  const networkTypes = ['ethernet', 'fiber', 'patch', 'structured'];
  const violations: ValidationIssue[] = [];

  for (const cable of layout.cables) {
    if (!networkTypes.includes(cable.type)) continue;
    const from = layout.devices.find((d) => d.id === cable.fromDeviceId);
    const to = layout.devices.find((d) => d.id === cable.toDeviceId);
    if (!from || !to) continue;

    const isPatchPanel = (d: PlacedDevice) => d.category === 'patch-panel';
    const isSwitch = (d: PlacedDevice) => d.category === 'switch';
    const isEndpoint = (d: PlacedDevice) => !isPatchPanel(d) && !isSwitch(d);

    if ((isEndpoint(from) && isSwitch(to)) || (isSwitch(from) && isEndpoint(to))) {
      violations.push(
        makeIssue(
          policy,
          'Endpoint connected directly to switch',
          `${from.name} → ${to.name}: policy requires endpoints to connect via patch panel for structured cabling.`,
          [from.id, to.id],
          [cable.id]
        )
      );
    }
  }
  return violations;
}

const EVALUATORS: Record<
  RackPolicyType,
  (layout: RackLayout, policy: RackPolicy) => ValidationIssue[]
> = {
  'ups-bottom-zone': evaluateUpsBottomZone,
  'heavy-device-bottom-zone': evaluateHeavyDeviceBottomZone,
  'free-u-percent': evaluateFreeUPercent,
  'switch-port-free-percent': evaluateSwitchPortFreePercent,
  'dual-psu-circuit-split': evaluateDualPsuCircuitSplit,
  'heat-separation': evaluateHeatSeparation,
  'power-budget-headroom': evaluatePowerBudgetHeadroom,
  'no-endpoint-switch-direct': evaluateNoEndpointSwitchDirect,
};

export function evaluatePolicies(layout: RackLayout): ValidationIssue[] {
  const policies = layout.policies ?? [];
  const issues: ValidationIssue[] = [];

  for (const policy of policies) {
    if (!policy.enabled) continue;
    const evaluator = EVALUATORS[policy.type];
    if (!evaluator) continue;
    issues.push(...evaluator(layout, policy));
  }

  return issues;
}

export type PolicyPresetName = 'home-lab-minimal' | 'soho-best-practice' | 'datacenter-standard';

export const POLICY_PRESETS: PolicyPresetName[] = [
  'home-lab-minimal',
  'soho-best-practice',
  'datacenter-standard',
];

interface PresetDefinition {
  label: string;
  description: string;
  policies: Omit<RackPolicy, 'id'>[];
}

const PRESET_DEFINITIONS: Record<PolicyPresetName, PresetDefinition> = {
  'home-lab-minimal': {
    label: 'Home Lab Minimal',
    description: 'Light rules for home use — basic stability and headroom checks.',
    policies: [
      { type: 'ups-bottom-zone', enabled: true, severity: 'warning', params: { maxPercent: 30 } },
      { type: 'free-u-percent', enabled: true, severity: 'warning', params: { minPercent: 5 } },
      { type: 'power-budget-headroom', enabled: true, severity: 'warning', params: { minPercent: 5 } },
    ],
  },
  'soho-best-practice': {
    label: 'SOHO Best Practice',
    description: 'Small office rules — balanced coverage for reliability and growth.',
    policies: [
      { type: 'ups-bottom-zone', enabled: true, severity: 'warning', params: { maxPercent: 25 } },
      { type: 'heavy-device-bottom-zone', enabled: true, severity: 'warning', params: { weightThresholdKg: 8, maxPercent: 50 } },
      { type: 'free-u-percent', enabled: true, severity: 'warning', params: { minPercent: 10 } },
      { type: 'switch-port-free-percent', enabled: true, severity: 'warning', params: { minPercent: 15 } },
      { type: 'power-budget-headroom', enabled: true, severity: 'warning', params: { minPercent: 10 } },
    ],
  },
  'datacenter-standard': {
    label: 'Datacenter Standard',
    description: 'Strict enterprise rules — comprehensive coverage with critical severity.',
    policies: [
      { type: 'ups-bottom-zone', enabled: true, severity: 'critical', params: { maxPercent: 20 } },
      { type: 'heavy-device-bottom-zone', enabled: true, severity: 'critical', params: { weightThresholdKg: 5, maxPercent: 40 } },
      { type: 'free-u-percent', enabled: true, severity: 'critical', params: { minPercent: 15 } },
      { type: 'switch-port-free-percent', enabled: true, severity: 'critical', params: { minPercent: 25 } },
      { type: 'dual-psu-circuit-split', enabled: true, severity: 'critical', params: {} },
      { type: 'heat-separation', enabled: true, severity: 'warning', params: { minGapU: 2 } },
      { type: 'power-budget-headroom', enabled: true, severity: 'critical', params: { minPercent: 15 } },
      { type: 'no-endpoint-switch-direct', enabled: true, severity: 'warning', params: {} },
    ],
  },
};

export const getPolicyPreset = (name: PolicyPresetName): RackPolicy[] => {
  const def = PRESET_DEFINITIONS[name];
  const timestamp = Date.now();
  return def.policies.map((p, index) => ({
    ...p,
    id: `preset-${name}-${p.type}-${timestamp}-${index}`,
  }));
};

export const getPresetLabel = (name: PolicyPresetName): string => PRESET_DEFINITIONS[name].label;

export const getPresetDescription = (name: PolicyPresetName): string => PRESET_DEFINITIONS[name].description;

export function policyLabel(type: RackPolicyType): string {
  switch (type) {
    case 'ups-bottom-zone':
      return 'UPS Bottom Zone';
    case 'heavy-device-bottom-zone':
      return 'Heavy Device Bottom Zone';
    case 'free-u-percent':
      return 'Free U Percent';
    case 'switch-port-free-percent':
      return 'Switch Port Headroom';
    case 'dual-psu-circuit-split':
      return 'Dual PSU Circuit Split';
    case 'heat-separation':
      return 'Heat Separation';
    case 'power-budget-headroom':
      return 'Power Budget Headroom';
    case 'no-endpoint-switch-direct':
      return 'No Direct Endpoint-Switch';
  }
}

export function policyDescription(type: RackPolicyType): string {
  switch (type) {
    case 'ups-bottom-zone':
      return 'UPS devices must sit in the bottom N% of the rack for stability.';
    case 'heavy-device-bottom-zone':
      return 'Devices over a weight threshold must sit in the bottom N% of the rack.';
    case 'free-u-percent':
      return 'Maintain a minimum percentage of free U space for future expansion.';
    case 'switch-port-free-percent':
      return 'Keep a minimum percentage of switch ports unconnected for growth.';
    case 'dual-psu-circuit-split':
      return 'Dual-PSU servers must have each PSU on a different circuit (A/B).';
    case 'heat-separation':
      return 'High-heat devices must be separated by at least N U positions.';
    case 'power-budget-headroom':
      return 'Keep a minimum percentage of the power budget unallocated.';
    case 'no-endpoint-switch-direct':
      return 'Endpoints must connect via patch panel, not directly to switches.';
  }
}
