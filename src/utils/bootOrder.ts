import type { PlacedDevice, RackLayout } from '../types/rack';

export interface BootNode {
  deviceId: string;
  deviceName: string;
  level: number;
  startTime: number;
  finishTime: number;
  dependencies: string[];
}

export interface BootAnalysis {
  sequence: BootNode[];
  levels: BootNode[][];
  totalTime: number;
  criticalPath: string[];
  cycles: string[][];
}

const BOOT_DURATION_SECONDS = 1; // Simplified: each device takes 1s to boot

function detectCycles(devices: PlacedDevice[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const adjacency = new Map<string, string[]>();

  devices.forEach((d) => {
    adjacency.set(
      d.id,
      (d.bootDependsOn ?? []).filter((depId) => devices.some((dev) => dev.id === depId))
    );
  });

  function dfs(nodeId: string, path: string[]) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    const deps = adjacency.get(nodeId) ?? [];

    for (const depId of deps) {
      if (!visited.has(depId)) {
        dfs(depId, [...path, depId]);
      } else if (recursionStack.has(depId)) {
        // Found cycle: extract cycle from path
        const cycleStart = path.indexOf(depId);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          // Normalize cycle: rotate to smallest ID to avoid duplicates
          const minIndex = cycle.indexOf(Math.min(...cycle.map((id) => parseInt(id.replace(/\D/g, '') || '0', 10))) as unknown as string);
          const normalized = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
          const cycleKey = normalized.join('→');
          const existingKeys = cycles.map((c) => {
            const doubled = [...c, ...c];
            for (let i = 0; i < c.length; i++) {
              const candidate = doubled.slice(i, i + c.length).join('→');
              if (candidate === cycleKey) return true;
            }
            return false;
          });
          if (!existingKeys.some(Boolean)) {
            cycles.push(cycle);
          }
        }
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const device of devices) {
    if (!visited.has(device.id)) {
      dfs(device.id, [device.id]);
    }
  }

  return cycles;
}

function topologicalLevels(devices: PlacedDevice[]): Map<string, number> {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  devices.forEach((d) => {
    inDegree.set(d.id, 0);
    adjacency.set(d.id, []);
  });

  devices.forEach((d) => {
    const deps = (d.bootDependsOn ?? []).filter((depId) => devices.some((dev) => dev.id === depId));
    for (const depId of deps) {
      adjacency.set(depId, [...(adjacency.get(depId) ?? []), d.id]);
      inDegree.set(d.id, (inDegree.get(d.id) ?? 0) + 1);
    }
  });

  const queue: string[] = [];
  const levels = new Map<string, number>();

  devices.forEach((d) => {
    if ((inDegree.get(d.id) ?? 0) === 0) {
      queue.push(d.id);
      levels.set(d.id, 0);
    }
  });

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = levels.get(currentId) ?? 0;
    const children = adjacency.get(currentId) ?? [];

    for (const childId of children) {
      const newDegree = (inDegree.get(childId) ?? 0) - 1;
      inDegree.set(childId, newDegree);
      if (newDegree === 0) {
        queue.push(childId);
        levels.set(childId, currentLevel + 1);
      }
    }
  }

  // Devices with remaining in-degree (part of cycle or unreachable) get level -1
  devices.forEach((d) => {
    if (!levels.has(d.id)) {
      levels.set(d.id, -1);
    }
  });

  return levels;
}

function calculateTiming(
  devices: PlacedDevice[],
  levels: Map<string, number>
): { startTimes: Map<string, number>; finishTimes: Map<string, number> } {
  const startTimes = new Map<string, number>();
  const finishTimes = new Map<string, number>();
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  // Process by level order
  const maxLevel = Math.max(...Array.from(levels.values()));
  for (let level = 0; level <= maxLevel; level++) {
    const levelDevices = devices.filter((d) => levels.get(d.id) === level);
    for (const device of levelDevices) {
      const deps = (device.bootDependsOn ?? []).filter((depId) => deviceMap.has(depId));
      const depFinishTimes = deps.map((depId) => finishTimes.get(depId) ?? 0);
      const maxDepFinish = depFinishTimes.length > 0 ? Math.max(...depFinishTimes) : 0;
      const delay = device.bootDelaySeconds ?? 0;
      const startTime = maxDepFinish + delay;
      startTimes.set(device.id, startTime);
      finishTimes.set(device.id, startTime + BOOT_DURATION_SECONDS);
    }
  }

  return { startTimes, finishTimes };
}

function findCriticalPath(devices: PlacedDevice[], finishTimes: Map<string, number>): string[] {
  if (devices.length === 0) return [];

  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const totalTime = Math.max(...Array.from(finishTimes.values()));

  // Find the device that finishes last
  const endDevices = devices.filter((d) => (finishTimes.get(d.id) ?? 0) === totalTime);
  if (endDevices.length === 0) return [];

  // Trace back from the end device with the longest path
  function traceBack(deviceId: string, visited: Set<string>): string[] {
    if (visited.has(deviceId)) return [];
    visited.add(deviceId);

    const device = deviceMap.get(deviceId);
    if (!device) return [deviceId];

    const deps = (device.bootDependsOn ?? []).filter((depId) => deviceMap.has(depId));
    if (deps.length === 0) return [deviceId];

    // Find dependency with latest finish time
    const depWithMaxFinish = deps.reduce((maxDep, depId) => {
      const maxFinish = finishTimes.get(maxDep) ?? 0;
      const depFinish = finishTimes.get(depId) ?? 0;
      return depFinish > maxFinish ? depId : maxDep;
    });

    return [...traceBack(depWithMaxFinish, visited), deviceId];
  }

  // Try all end devices and pick the longest path
  let longestPath: string[] = [];
  for (const endDevice of endDevices) {
    const path = traceBack(endDevice.id, new Set<string>());
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }

  return longestPath;
}

export function analyzeBootOrder(layout: RackLayout): BootAnalysis {
  const devices = layout.devices.filter(
    (d) => d.category !== 'blank' && d.category !== 'cable-management'
  );

  if (devices.length === 0) {
    return { sequence: [], levels: [], totalTime: 0, criticalPath: [], cycles: [] };
  }

  const cycles = detectCycles(devices);
  const levels = topologicalLevels(devices);
  const { startTimes, finishTimes } = calculateTiming(devices, levels);

  const sequence: BootNode[] = devices
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      level: levels.get(d.id) ?? -1,
      startTime: startTimes.get(d.id) ?? 0,
      finishTime: finishTimes.get(d.id) ?? 0,
      dependencies:
        d.bootDependsOn?.filter((depId) => devices.some((dev) => dev.id === depId)) ?? []
    }))
    .sort((a, b) => a.startTime - b.startTime || a.level - b.level);

  const maxLevel = Math.max(...sequence.map((n) => n.level));
  const levelsArray: BootNode[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    const levelNodes = sequence.filter((n) => n.level === i);
    if (levelNodes.length > 0) {
      levelsArray.push(levelNodes);
    }
  }

  // Include cycle nodes at the end
  const cycleNodeIds = new Set(cycles.flat());
  const cycleNodes = sequence.filter((n) => cycleNodeIds.has(n.deviceId) && n.level === -1);
  if (cycleNodes.length > 0) {
    levelsArray.push(cycleNodes);
  }

  const totalTime = Math.max(...Array.from(finishTimes.values()), 0);
  const criticalPath = cycles.length > 0 ? [] : findCriticalPath(devices, finishTimes);

  return {
    sequence,
    levels: levelsArray,
    totalTime,
    criticalPath,
    cycles
  };
}

export function formatBootTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
