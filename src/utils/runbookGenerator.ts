import type { CableRoute, PlacedDevice, RackLayout } from '../types/rack';

export interface RunbookStep {
  order: number;
  text: string;
  deviceId?: string;
  deviceName?: string;
  riskLevel: 'safe' | 'caution' | 'stop';
  checkType: 'visual' | 'physical' | 'network' | 'power';
}

export interface Runbook {
  id: string;
  title: string;
  description: string;
  category: 'network' | 'storage' | 'power' | 'management' | 'performance';
  steps: RunbookStep[];
  estimatedMinutes: number;
}

function findDeviceByCategory(devices: PlacedDevice[], category: string): PlacedDevice | undefined {
  return devices.find((d) => d.category === category);
}

function findDevicesByCategory(devices: PlacedDevice[], category: string): PlacedDevice[] {
  return devices.filter((d) => d.category === category);
}

function getConnectedDevices(deviceId: string, cables: CableRoute[]): PlacedDevice['id'][] {
  const ids = new Set<string>();
  for (const c of cables) {
    if (c.fromDeviceId === deviceId) ids.add(c.toDeviceId);
    if (c.toDeviceId === deviceId) ids.add(c.fromDeviceId);
  }
  return Array.from(ids);
}

function deviceName(device: PlacedDevice | undefined): string {
  return device?.name ?? 'unknown device';
}

export function generateInternetDownRunbook(layout: RackLayout): Runbook {
  const modem = findDeviceByCategory(layout.devices, 'modem');
  const router = findDeviceByCategory(layout.devices, 'router');
  const firewall = findDeviceByCategory(layout.devices, 'firewall');
  const switchDevice = findDeviceByCategory(layout.devices, 'switch');
  const ups = findDeviceByCategory(layout.devices, 'ups');

  const steps: RunbookStep[] = [
    {
      order: 1,
      text: `Check ${deviceName(modem)} power LED. Solid = powered. Off = check UPS and PDU outlet.`,
      deviceId: modem?.id,
      deviceName: modem?.name,
      riskLevel: 'safe',
      checkType: 'visual',
    },
    {
      order: 2,
      text: `Verify ${deviceName(router)} status LED. Look for WAN/Internet light. Blinking = attempting connection. Off = no link.`,
      deviceId: router?.id,
      deviceName: router?.name,
      riskLevel: 'safe',
      checkType: 'visual',
    },
  ];

  if (firewall) {
    steps.push({
      order: 3,
      text: `Check ${firewall.name} for blocked outbound rules or failover state.`,
      deviceId: firewall.id,
      deviceName: firewall.name,
      riskLevel: 'caution',
      checkType: 'network',
    });
  }

  if (switchDevice) {
    steps.push({
      order: steps.length + 1,
      text: `Verify ${switchDevice.name} uplink port LED to router/firewall.`,
      deviceId: switchDevice.id,
      deviceName: switchDevice.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'Check if ISP is down in your area (use mobile data to check ISP status page).',
    riskLevel: 'safe',
    checkType: 'network',
  });

  if (ups) {
    steps.push({
      order: steps.length + 1,
      text: `${ups.name}: Check battery status. Low battery may cause modem/router reboot loops.`,
      deviceId: ups.id,
      deviceName: ups.name,
      riskLevel: 'caution',
      checkType: 'power',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'DO NOT factory reset modem or router unless all other checks pass. You will lose config.',
    riskLevel: 'stop',
    checkType: 'network',
  });

  return {
    id: 'internet-down',
    title: 'Internet Down',
    description: `Troubleshoot total or partial internet outage. ${modem ? 'Start at modem.' : 'Check WAN path.'}`,
    category: 'network',
    steps,
    estimatedMinutes: 15,
  };
}

export function generateNasUnreachableRunbook(layout: RackLayout): Runbook {
  const nas = findDeviceByCategory(layout.devices, 'nas');
  const switchDevice = findDeviceByCategory(layout.devices, 'switch');
  const router = findDeviceByCategory(layout.devices, 'router');
  const ups = findDeviceByCategory(layout.devices, 'ups');

  const steps: RunbookStep[] = [];

  if (nas) {
    steps.push({
      order: 1,
      text: `Check ${nas.name} power LED and drive activity lights. No lights = check power cable and PDU outlet.`,
      deviceId: nas.id,
      deviceName: nas.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });

    const connectedIds = getConnectedDevices(nas.id, layout.cables);
    const connectedDevices = layout.devices.filter((d) => connectedIds.includes(d.id));

    if (connectedDevices.length > 0) {
      steps.push({
        order: 2,
        text: `Verify cable from ${nas.name} to ${connectedDevices[0].name} is seated firmly at both ends.`,
        deviceId: nas.id,
        deviceName: nas.name,
        riskLevel: 'safe',
        checkType: 'physical',
      });
    }
  }

  if (switchDevice) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${switchDevice.name} port LED for NAS connection. Off = cable/port issue. Amber = speed mismatch.`,
      deviceId: switchDevice.id,
      deviceName: switchDevice.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  if (router) {
    steps.push({
      order: steps.length + 1,
      text: `Ping ${router.name} LAN IP from a working device to confirm local network is up.`,
      deviceId: router.id,
      deviceName: router.name,
      riskLevel: 'safe',
      checkType: 'network',
    });
  }

  if (ups) {
    steps.push({
      order: steps.length + 1,
      text: `${ups.name}: Check load percentage. NAS spin-up during power events can overload small UPS units.`,
      deviceId: ups.id,
      deviceName: ups.name,
      riskLevel: 'caution',
      checkType: 'power',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: nas
      ? `DO NOT pull drives from ${nas.name} while powered. Power down fully first if needed.`
      : 'DO NOT pull drives while powered. Power down fully first if needed.',
    deviceId: nas?.id,
    deviceName: nas?.name,
    riskLevel: 'stop',
    checkType: 'physical',
  });

  return {
    id: 'nas-unreachable',
    title: 'NAS Unreachable',
    description: 'Troubleshoot storage access failure.',
    category: 'storage',
    steps,
    estimatedMinutes: 10,
  };
}

export function generateWifiDownRunbook(layout: RackLayout): Runbook {
  const aps = findDevicesByCategory(layout.devices, 'access-point');
  const router = findDeviceByCategory(layout.devices, 'router');
  const switchDevice = findDeviceByCategory(layout.devices, 'switch');
  const poeInjector = findDeviceByCategory(layout.devices, 'poe-injector');

  const steps: RunbookStep[] = [];

  if (aps.length > 0) {
    for (const ap of aps) {
      steps.push({
        order: steps.length + 1,
        text: `Check ${ap.name} status LED. Solid = OK. Blinking = booting or firmware update. Off = no power.`,
        deviceId: ap.id,
        deviceName: ap.name,
        riskLevel: 'safe',
        checkType: 'visual',
      });
    }
  }

  if (switchDevice) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${switchDevice.name} PoE port LEDs. Off = no power delivery.`,
      deviceId: switchDevice.id,
      deviceName: switchDevice.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  if (poeInjector) {
    steps.push({
      order: steps.length + 1,
      text: `Verify ${poeInjector.name} power LED and that injector is receiving mains power.`,
      deviceId: poeInjector.id,
      deviceName: poeInjector.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  if (router) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${router.name} wireless settings — SSID may be hidden or disabled after firmware update.`,
      deviceId: router.id,
      deviceName: router.name,
      riskLevel: 'caution',
      checkType: 'network',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'Check if issue is client-specific: can other devices connect?',
    riskLevel: 'safe',
    checkType: 'network',
  });

  steps.push({
    order: steps.length + 1,
    text: 'DO NOT reset AP to factory unless you have the config backup. Re-adoption can be time-consuming.',
    riskLevel: 'stop',
    checkType: 'network',
  });

  return {
    id: 'wifi-down',
    title: 'Wi-Fi Down',
    description: `Troubleshoot wireless connectivity. ${aps.length} AP(s) in layout.`,
    category: 'network',
    steps,
    estimatedMinutes: 10,
  };
}

export function generateUpsBeepingRunbook(layout: RackLayout): Runbook {
  const upsDevices = findDevicesByCategory(layout.devices, 'ups');
  const pdu = findDevicesByCategory(layout.devices, 'pdu');

  const steps: RunbookStep[] = [];

  for (const ups of upsDevices) {
    steps.push({
      order: steps.length + 1,
      text: `${ups.name}: Identify beep pattern. Constant = overload or fault. Intermittent = on battery.`,
      deviceId: ups.id,
      deviceName: ups.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });

    steps.push({
      order: steps.length + 1,
      text: `${ups.name}: Check load display. Overload (>80%) causes constant tone. Reduce load or upgrade UPS.`,
      deviceId: ups.id,
      deviceName: ups.name,
      riskLevel: 'caution',
      checkType: 'power',
    });

    steps.push({
      order: steps.length + 1,
      text: `${ups.name}: Check battery age. Batteries older than 3 years often fail under load.`,
      deviceId: ups.id,
      deviceName: ups.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  if (pdu.length > 0) {
    steps.push({
      order: steps.length + 1,
      text: `Check PDU breakers. A tripped circuit can shift entire load to one UPS, causing overload.`,
      riskLevel: 'safe',
      checkType: 'power',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'DO NOT bypass UPS to stop the noise unless you accept risk of unprotected power.',
    riskLevel: 'stop',
    checkType: 'power',
  });

  return {
    id: 'ups-beeping',
    title: 'UPS Beeping',
    description: `Troubleshoot UPS alarms. ${upsDevices.length} UPS unit(s) in layout.`,
    category: 'power',
    steps,
    estimatedMinutes: 5,
  };
}

export function generateNoManagementAccessRunbook(layout: RackLayout): Runbook {
  const router = findDeviceByCategory(layout.devices, 'router');
  const switchDevice = findDeviceByCategory(layout.devices, 'switch');
  const firewall = findDeviceByCategory(layout.devices, 'firewall');
  const kvm = findDeviceByCategory(layout.devices, 'ip-kvm');

  const steps: RunbookStep[] = [
    {
      order: 1,
      text: 'Check if issue is IP-related (DHCP lease expired) or physical (cable disconnected).',
      riskLevel: 'safe',
      checkType: 'network',
    },
  ];

  if (switchDevice) {
    steps.push({
      order: 2,
      text: `Check ${switchDevice.name} management VLAN port LED.`,
      deviceId: switchDevice.id,
      deviceName: switchDevice.name,
      riskLevel: 'safe',
      checkType: 'visual',
    });
  }

  if (router) {
    steps.push({
      order: steps.length + 1,
      text: `Try ${router.name} via direct Ethernet cable bypassing switch.`,
      deviceId: router.id,
      deviceName: router.name,
      riskLevel: 'safe',
      checkType: 'physical',
    });
  }

  if (firewall) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${firewall.name} for management access rules that may block your subnet.`,
      deviceId: firewall.id,
      deviceName: firewall.name,
      riskLevel: 'caution',
      checkType: 'network',
    });
  }

  if (kvm) {
    steps.push({
      order: steps.length + 1,
      text: `${kvm.name}: If network management fails, use KVM for direct console access.`,
      deviceId: kvm.id,
      deviceName: kvm.name,
      riskLevel: 'safe',
      checkType: 'physical',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'DO NOT change firewall rules unless you have console/physical access as fallback.',
    riskLevel: 'stop',
    checkType: 'network',
  });

  return {
    id: 'no-management',
    title: 'No Management Access',
    description: 'Cannot reach router, switch, or server management interfaces.',
    category: 'management',
    steps,
    estimatedMinutes: 15,
  };
}

export function generateSlowPerformanceRunbook(layout: RackLayout): Runbook {
  const router = findDeviceByCategory(layout.devices, 'router');
  const switchDevices = findDevicesByCategory(layout.devices, 'switch');
  const nas = findDeviceByCategory(layout.devices, 'nas');
  const server = findDeviceByCategory(layout.devices, 'server');

  const steps: RunbookStep[] = [
    {
      order: 1,
      text: 'Identify scope: one device, one room, one service, or everything?',
      riskLevel: 'safe',
      checkType: 'network',
    },
  ];

  if (switchDevices.length > 0) {
    for (const sw of switchDevices) {
      steps.push({
        order: steps.length + 1,
        text: `Check ${sw.name} port utilization. Blinking wildly = possible loop or broadcast storm.`,
        deviceId: sw.id,
        deviceName: sw.name,
        riskLevel: 'safe',
        checkType: 'visual',
      });
    }
  }

  if (nas) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${nas.name} drive health and SMART status. Failing drives cause severe slowdown.`,
      deviceId: nas.id,
      deviceName: nas.name,
      riskLevel: 'caution',
      checkType: 'network',
    });
  }

  if (server) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${server.name} CPU/memory load. High load on VM host affects all guests.`,
      deviceId: server.id,
      deviceName: server.name,
      riskLevel: 'safe',
      checkType: 'network',
    });
  }

  if (router) {
    steps.push({
      order: steps.length + 1,
      text: `Check ${router.name} CPU load and connection count. Consumer routers choke on high connection counts.`,
      deviceId: router.id,
      deviceName: router.name,
      riskLevel: 'safe',
      checkType: 'network',
    });
  }

  steps.push({
    order: steps.length + 1,
    text: 'Check for thermal throttling: are fans loud? Is the room hot?',
    riskLevel: 'safe',
      checkType: 'visual',
    });

  steps.push({
    order: steps.length + 1,
    text: 'DO NOT reboot everything at once. Reboot one device at a time and verify after each.',
    riskLevel: 'stop',
    checkType: 'network',
  });

  return {
    id: 'slow-performance',
    title: 'Everything Is Slow',
    description: 'Network, storage, or general performance degradation.',
    category: 'performance',
    steps,
    estimatedMinutes: 20,
  };
}

export function generateAllRunbooks(layout: RackLayout): Runbook[] {
  return [
    generateInternetDownRunbook(layout),
    generateNasUnreachableRunbook(layout),
    generateWifiDownRunbook(layout),
    generateUpsBeepingRunbook(layout),
    generateNoManagementAccessRunbook(layout),
    generateSlowPerformanceRunbook(layout),
  ];
}

export function exportRunbooksMarkdown(runbooks: Runbook[], layoutName: string): string {
  const lines: string[] = [
    `# Emergency Runbooks — ${layoutName}`,
    '',
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    `**Runbooks:** ${runbooks.length}`,
    '',
  ];

  for (const runbook of runbooks) {
    lines.push(
      `## ${runbook.title}`,
      '',
      `${runbook.description}`,
      '',
      `**Category:** ${runbook.category} | **Estimated time:** ${runbook.estimatedMinutes} min`,
      ''
    );

    for (const step of runbook.steps) {
      const icon = step.riskLevel === 'stop' ? '🛑' : step.riskLevel === 'caution' ? '⚠️' : '✅';
      lines.push(`${icon} **Step ${step.order}** (${step.checkType}) ${step.text}`);
    }

    lines.push('');
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}

export function findRunbookById(runbooks: Runbook[], id: string): Runbook | undefined {
  return runbooks.find((r) => r.id === id);
}
