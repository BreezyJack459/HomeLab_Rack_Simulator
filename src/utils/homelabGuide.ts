export type HomelabGoal =
  | 'learn-networking'
  | 'self-host-apps'
  | 'nas-storage'
  | 'media-plex'
  | 'kubernetes'
  | 'game-server'
  | 'general';

export type BudgetTier = 'hobby' | 'enthusiast' | 'serious';
export type NoiseTolerance = 'silent' | 'low' | 'dont-care';
export type RoomLocation = 'bedroom' | 'office' | 'closet' | 'garage' | 'basement';
export type ExistingHardware = 'old-pc' | 'pi' | 'nothing';
export type GrowthApproach = 'incremental' | 'full-build';
export type NetworkKnowledge = 'beginner' | 'intermediate' | 'advanced';
export type PowerConstraint = 'limited' | 'ample';

export interface HomelabAnswers {
  goal: HomelabGoal;
  budget: BudgetTier;
  noise: NoiseTolerance;
  room: RoomLocation;
  existing: ExistingHardware;
  growth: GrowthApproach;
  networkKnowledge: NetworkKnowledge;
  powerConstraint: PowerConstraint;
}

export interface DeviceRecommendation {
  category: string;
  name: string;
  reason: string;
  newOrUsed: 'new' | 'used' | 'either';
  estimatedCostUsd: number;
}

export interface GrowthPhase {
  phase: number;
  name: string;
  devices: string[];
  stopAndEnjoy: string;
}

export interface HomelabReport {
  rackType: '10in' | '19in';
  rackSizeU: number;
  rackDepthMm: number;
  summary: string;
  warnings: string[];
  starterDevices: DeviceRecommendation[];
  growthPhases: GrowthPhase[];
  sampleLayoutName: string;
}

const GOAL_LABELS: Record<HomelabGoal, string> = {
  'learn-networking': 'Learn networking',
  'self-host-apps': 'Self-host apps',
  'nas-storage': 'NAS / Storage',
  'media-plex': 'Media / Plex',
  kubernetes: 'Kubernetes',
  'game-server': 'Game server',
  general: 'General purpose',
};

export function generateReport(answers: HomelabAnswers): HomelabReport {
  const warnings: string[] = [];

  // Rack sizing
  let rackType: '10in' | '19in' = '19in';
  let rackSizeU = 12;
  let rackDepthMm = 600;

  if (answers.budget === 'hobby') {
    rackType = '10in';
    rackSizeU = 9;
    rackDepthMm = 400;
  } else if (answers.budget === 'serious') {
    rackType = '19in';
    rackSizeU = 24;
    rackDepthMm = 1000;
  }

  if (answers.room === 'bedroom' && answers.noise !== 'silent') {
    warnings.push('Bedroom + non-silent gear = potential noise complaints. Consider fanless switches or closet placement.');
  }
  if (answers.room === 'closet' && answers.powerConstraint === 'limited') {
    warnings.push('Closets often have limited ventilation and power outlets. Monitor heat closely.');
  }
  if (answers.growth === 'full-build' && answers.budget === 'hobby') {
    warnings.push('Full-build on a hobby budget often leads to buying cheap gear that gets replaced quickly. Incremental is usually more cost-effective.');
  }

  // Starter devices
  const starterDevices: DeviceRecommendation[] = [];

  // Always start with router
  starterDevices.push({
    category: 'router',
    name: answers.budget === 'hobby' ? 'Used EdgeRouter X or ISP router' : answers.budget === 'enthusiast' ? 'UDM Pro / pfSense box' : 'Enterprise router / OPNSense',
    reason: 'Network foundation — everything depends on this',
    newOrUsed: answers.budget === 'hobby' ? 'used' : 'either',
    estimatedCostUsd: answers.budget === 'hobby' ? 50 : answers.budget === 'enthusiast' ? 200 : 400,
  });

  // Switch
  starterDevices.push({
    category: 'switch',
    name: answers.noise === 'silent' ? 'Fanless 8-port gigabit switch' : answers.budget === 'hobby' ? 'Used 8-port managed switch' : '16/24-port managed PoE switch',
    reason: 'Connects all devices. PoE if you plan APs or cameras.',
    newOrUsed: answers.budget === 'hobby' ? 'used' : 'either',
    estimatedCostUsd: answers.budget === 'hobby' ? 30 : answers.budget === 'enthusiast' ? 100 : 250,
  });

  // NAS if storage/plex/general
  if (answers.goal === 'nas-storage' || answers.goal === 'media-plex' || answers.goal === 'general') {
    starterDevices.push({
      category: 'nas',
      name: answers.budget === 'hobby' ? 'Used Synology 2-bay or old PC + TrueNAS' : answers.budget === 'enthusiast' ? 'Synology DS920+ or TrueNAS Mini' : 'TrueNAS Scale build or Synology DS1821+',
      reason: 'Central storage for media, backups, and app data',
      newOrUsed: answers.goal === 'nas-storage' ? 'new' : 'either',
      estimatedCostUsd: answers.budget === 'hobby' ? 100 : answers.budget === 'enthusiast' ? 400 : 800,
    });
  }

  // Mini PC / server for apps/k8s/game
  if (answers.goal === 'self-host-apps' || answers.goal === 'kubernetes' || answers.goal === 'game-server' || answers.goal === 'general') {
    starterDevices.push({
      category: 'server',
      name: answers.budget === 'hobby' ? 'Used Dell OptiPlex SFF or old PC' : answers.budget === 'enthusiast' ? 'Lenovo ThinkCentre mini or Dell T340' : 'Dell R720 / custom whitebox server',
      reason: 'Compute for apps, VMs, or containers',
      newOrUsed: answers.budget === 'hobby' ? 'used' : answers.budget === 'enthusiast' ? 'either' : 'used',
      estimatedCostUsd: answers.budget === 'hobby' ? 80 : answers.budget === 'enthusiast' ? 300 : 600,
    });
  }

  // Access point if needed
  if (answers.networkKnowledge !== 'advanced' || answers.room !== 'closet') {
    starterDevices.push({
      category: 'access-point',
      name: answers.budget === 'hobby' ? 'Used UniFi AP-AC-Lite' : 'UniFi 6 Lite / Pro',
      reason: 'Reliable Wi-Fi coverage',
      newOrUsed: answers.budget === 'hobby' ? 'used' : 'new',
      estimatedCostUsd: answers.budget === 'hobby' ? 40 : 120,
    });
  }

  // Growth phases
  const growthPhases: GrowthPhase[] = [
    {
      phase: 1,
      name: 'Network Foundation',
      devices: ['Router', 'Switch', 'Access Point'],
      stopAndEnjoy: 'Get stable internet and Wi-Fi before adding complexity.',
    },
    {
      phase: 2,
      name: 'Storage',
      devices: answers.goal === 'nas-storage' || answers.goal === 'media-plex' ? ['NAS', 'Hard drives'] : ['NAS or shared storage'],
      stopAndEnjoy: 'Set up backups and media sharing. Test restore before continuing.',
    },
    {
      phase: 3,
      name: 'Compute',
      devices: ['Server / Mini PC', 'Docker or VMs'],
      stopAndEnjoy: 'Run a few lightweight services. Learn monitoring and logging.',
    },
    {
      phase: 4,
      name: 'Advanced',
      devices: answers.goal === 'kubernetes' ? ['K3s cluster', 'CI/CD'] : ['VLANs', 'Monitoring stack', 'Automation'],
      stopAndEnjoy: 'Document everything. Add redundancy where it matters.',
    },
  ];

  const sampleLayoutName =
    answers.budget === 'hobby'
      ? answers.room === 'bedroom'
        ? 'Budget Bedroom Starter'
        : 'Hobby Closet Starter'
      : answers.budget === 'enthusiast'
        ? 'Enthusiast Office Grower'
        : 'Serious Basement Lab';

  return {
    rackType,
    rackSizeU,
    rackDepthMm,
    summary: `Based on your goal (${GOAL_LABELS[answers.goal]}), budget (${answers.budget}), and room (${answers.room}), a ${rackType} ${rackSizeU}U rack (${rackDepthMm}mm deep) is recommended. Start with ${answers.growth === 'incremental' ? 'Phase 1 only' : 'Phases 1–2'}.`,
    warnings,
    starterDevices,
    growthPhases,
    sampleLayoutName,
  };
}

export function exportReportMarkdown(answers: HomelabAnswers, report: HomelabReport): string {
  const lines: string[] = [
    '# Zero-to-Homelab Guide Report',
    '',
    `**Goal:** ${GOAL_LABELS[answers.goal]}`,
    `**Budget:** ${answers.budget} · **Room:** ${answers.room} · **Noise tolerance:** ${answers.noise}`,
    '',
    `## Recommended Rack`,
    `**Type:** ${report.rackType} · **Size:** ${report.rackSizeU}U · **Depth:** ${report.rackDepthMm}mm`,
    '',
    `## Starter Devices`,
    '',
  ];

  for (const d of report.starterDevices) {
    lines.push(`### ${d.name}`, `**Category:** ${d.category} · **Cost:** ~$${d.estimatedCostUsd} · **Buy:** ${d.newOrUsed}`, `**Why:** ${d.reason}`, '');
  }

  lines.push('## Growth Phases', '');
  for (const p of report.growthPhases) {
    lines.push(`### Phase ${p.phase}: ${p.name}`, `**Devices:** ${p.devices.join(', ')}`, `**Checkpoint:** ${p.stopAndEnjoy}`, '');
  }

  if (report.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const w of report.warnings) {
      lines.push(`- ⚠️ ${w}`);
    }
    lines.push('');
  }

  lines.push('---', '', '*Generated by Homelab Rack Simulator*', '');
  return lines.join('\n');
}
