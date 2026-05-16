import type { CableType, RackLayout, Workspace } from '../types/rack';
import { normalizeWorkspace } from '../store/rackStore';
import { buildBom } from './bom';
import { getBaselineComparison } from './baseline';
import type { ChecklistSection } from './checklists';
import { summarizeChecklist } from './checklists';
import { exportChangeCalendarIcs, getChangeCalendarSummary } from './changeCalendar';
import { commissioningStatus, getCommissioningChecklist } from './commissioning';
import { DEFAULT_CABLE_COLORS } from './cableColors';
import { getDocumentationIssues } from './documentationAudit';
import { getMigrationSummary } from './migrationCalc';
import { getProcurementChecklist, getProcurementCategoryLabel, getProcurementStatusLabel } from './procurement';
import { formatCableLength, getDeviceSpatialZone, getDeviceXRange, isZeroU, RACK_SPECS } from './rackMath';
import { getReadinessChecklist } from './readinessChecklist';

const cableColors: Record<CableType, string> = DEFAULT_CABLE_COLORS;

export function downloadTextFile(filename: string, text: string, mimeType = 'application/json') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportLayoutJson(layout: RackLayout) {
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}.json`,
    JSON.stringify(layout, null, 2)
  );
}

export function exportRackPng(layout: RackLayout) {
  const unitHeight = 38;
  const rackWidth = RACK_SPECS[layout.rackType].visualWidthPx;
  const labelWidth = 52;
  const padding = 26;
  const width = rackWidth + labelWidth * 2 + padding * 2;
  const height = layout.heightU * unitHeight + padding * 2 + 56;
  const canvas = document.createElement('canvas');
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#0c0f14';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 18px Inter, sans-serif';
  ctx.fillText(layout.name, padding, 28);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U / ${layout.rackDepthMm}mm depth`, padding, 48);

  const rackX = padding + labelWidth;
  const rackY = padding + 48;
  ctx.fillStyle = '#111827';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.fillRect(rackX, rackY, rackWidth, layout.heightU * unitHeight);
  ctx.strokeRect(rackX, rackY, rackWidth, layout.heightU * unitHeight);

  for (let index = 0; index < layout.heightU; index += 1) {
    const unit = layout.heightU - index;
    const y = rackY + index * unitHeight;
    ctx.strokeStyle = '#243042';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rackX, y);
    ctx.lineTo(rackX + rackWidth, y);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`U${unit}`, padding + 10, y + unitHeight / 2 + 4);
    ctx.fillText(`U${unit}`, rackX + rackWidth + 14, y + unitHeight / 2 + 4);
  }

  layout.devices.forEach((device) => {
    if (isZeroU(device)) {
      const zone = getDeviceSpatialZone(device);
      const side = zone.includes('left') ? 'left' : 'right';
      const x = side === 'left' ? rackX - 34 : rackX + rackWidth + 12;
      const y = rackY + 3;
      const w = 22;
      const h = layout.heightU * unitHeight - 6;
      ctx.fillStyle = device.color;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(device.name, 0, 4);
      ctx.restore();
      return;
    }
    const topIndex = layout.heightU - (device.positionU + device.sizeU - 1);
    const y = rackY + topIndex * unitHeight;
    const h = device.sizeU * unitHeight;
    const range = getDeviceXRange(layout, device);
    const x = rackX + (range.x / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth;
    const w = (Math.min(range.width, RACK_SPECS[layout.rackType].usableWidthMm) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth;
    ctx.fillStyle = device.color;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x, y + 3, w, h - 6);
    ctx.globalAlpha = 1;
    ctx.strokeRect(x, y + 3, w, h - 6);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText(device.name, x + 10, y + Math.min(20, h - 8));
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${device.sizeU}U / ${device.depthMm}mm / ${device.powerW}W`, x + 10, y + Math.min(38, h - 8));
  });

  layout.cables.forEach((cable, index) => {
    const from = layout.devices.find((device) => device.id === cable.fromDeviceId);
    const to = layout.devices.find((device) => device.id === cable.toDeviceId);
    if (!from || !to) return;
    const fromRange = getDeviceXRange(layout, from);
    const toRange = getDeviceXRange(layout, to);
    const fromX = rackX + ((fromRange.x + fromRange.width) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth - 8;
    const toX = rackX + ((toRange.x + toRange.width) / RACK_SPECS[layout.rackType].usableWidthMm) * rackWidth - 8;
    const fromY = rackY + (layout.heightU - (from.positionU + from.sizeU / 2)) * unitHeight;
    const toY = rackY + (layout.heightU - (to.positionU + to.sizeU / 2)) * unitHeight;
    const routeX = rackX + rackWidth + 24 + (index % 3) * 10;
    ctx.strokeStyle = cable.color || cableColors[cable.type];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(routeX, fromY, routeX, toY, toX, toY);
    ctx.stroke();
  });

  const anchor = document.createElement('a');
  anchor.download = `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-diagram'}.png`;
  anchor.href = canvas.toDataURL('image/png');
  anchor.click();
}

export function exportBomCsv(layout: RackLayout) {
  const lines = buildBom(layout);
  const headers = ['Type', 'Length', 'Quantity', 'Slack', 'Service loop', 'Bend radius note'];
  const rows = lines.map((line) => [
    line.type,
    formatCableLength(line.lengthMm),
    String(line.count),
    line.slackMm > 0 ? formatCableLength(line.slackMm) : '',
    line.serviceLoopMm > 0 ? `${line.serviceLoopMm}mm` : '',
    line.bendRadiusMm > 0 ? `Keep >= ${line.bendRadiusMm}mm radius` : ''
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-bom.csv`,
    csv,
    'text/csv'
  );
}

export function exportBomText(layout: RackLayout) {
  const lines = buildBom(layout);
  const totalCables = lines.reduce((sum, line) => sum + line.count, 0);
  const textLines = [
    `Cable BOM: ${layout.name}`,
    `${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Total cable routes: ${totalCables}`,
    '',
    ...lines.map((line) => {
      const extras = [
        line.slackMm > 0 ? `slack ${formatCableLength(line.slackMm)}` : undefined,
        line.serviceLoopMm > 0 ? `service loop ${line.serviceLoopMm}mm` : undefined,
        line.bendRadiusMm > 0 ? `bend >= ${line.bendRadiusMm}mm` : undefined
      ].filter(Boolean);
      return `${line.type.padEnd(10)} ${formatCableLength(line.lengthMm).padStart(6)} × ${line.count}${extras.length ? `  (${extras.join(', ')})` : ''}`;
    }),
    '',
    'Generated by Homelab Rack Simulator'
  ];
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-bom.txt`,
    textLines.join('\n'),
    'text/plain'
  );
}

export function exportProcurementCsv(layout: RackLayout) {
  const items = getProcurementChecklist(layout);
  const headers = ['Category', 'Item', 'Quantity', 'Unit', 'Status', 'Notes'];
  const rows = items.map((item) => [
    getProcurementCategoryLabel(item.category),
    item.label,
    String(item.quantity),
    item.unit ?? '',
    getProcurementStatusLabel(item.status),
    item.notes ?? ''
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-procurement.csv`,
    csv,
    'text/csv'
  );
}

export function exportProcurementText(layout: RackLayout) {
  const items = getProcurementChecklist(layout);
  const lines = [
    `Procurement checklist: ${layout.name}`,
    `${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Items: ${items.length}`,
    '',
    ...items.map(
      (item) =>
        `[${getProcurementStatusLabel(item.status)}] ${getProcurementCategoryLabel(item.category)} / ${item.label} / ${item.quantity}${item.unit ? ` ${item.unit}` : ''}${item.notes ? ` / ${item.notes}` : ''}`
    ),
    '',
    'Generated by Homelab Rack Simulator'
  ];

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-procurement.txt`,
    lines.join('\n'),
    'text/plain'
  );
}

function checklistMarkdown(title: string, layout: RackLayout, sections: ChecklistSection[], headingLevel: '#' | '##' = '#') {
  const summary = summarizeChecklist(sections);
  return [
    `${headingLevel} ${title}`,
    '',
    `Layout: ${layout.name}`,
    `Rack: ${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `Summary: ${summary.passed}/${summary.total} passed, ${summary.pending} pending, ${summary.failed} failed, ${summary.skipped} skipped`,
    '',
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      '',
      ...section.items.map((item) => `- [${item.status === 'passed' ? 'x' : item.status === 'skipped' ? '~' : ' '}] ${item.title} — ${item.detail}${item.notes ? ` Notes: ${item.notes}` : ''}`),
      ''
    ]),
    'Generated by Homelab Rack Simulator'
  ].join('\n');
}

export function exportReadinessChecklistMarkdown(layout: RackLayout) {
  const sections = getReadinessChecklist(layout);
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-readiness-checklist.md`,
    checklistMarkdown('Rack Readiness Checklist', layout, sections),
    'text/markdown'
  );
}

export function exportCommissioningReportMarkdown(layout: RackLayout) {
  const sections = getCommissioningChecklist(layout);
  const markdown = [
    '# Rack Commissioning Report',
    '',
    `Layout: ${layout.name}`,
    `Rack: ${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Status: ${commissioningStatus(layout)}`,
    '',
    checklistMarkdown('Commissioning Checklist', layout, sections, '##'),
    '',
    '## Sign-Off',
    '',
    '- Operator:',
    '- Date:',
    '- Follow-up:',
    '',
    'Generated by Homelab Rack Simulator'
  ].join('\n');

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-commissioning-report.md`,
    markdown,
    'text/markdown'
  );
}

export function exportDocumentationAuditText(layout: RackLayout) {
  const issues = getDocumentationIssues(layout);
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const infos = issues.filter((issue) => issue.severity === 'info');
  const lines = [
    `Documentation audit: ${layout.name}`,
    `${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Warnings: ${warnings.length}`,
    `Info items: ${infos.length}`,
    '',
  ];

  if (issues.length === 0) {
    lines.push('No documentation gaps found.');
  } else {
    for (const issue of issues) {
      lines.push(`[${issue.severity.toUpperCase()}] ${issue.title}`);
      lines.push(`- ${issue.detail}`);
      if (issue.deviceIds.length > 0) {
        lines.push(`- Devices: ${issue.deviceIds.join(', ')}`);
      }
      if ((issue.cableIds ?? []).length > 0) {
        lines.push(`- Cables: ${issue.cableIds!.join(', ')}`);
      }
      lines.push('');
    }
  }

  lines.push('Generated by Homelab Rack Simulator');

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-documentation-audit.txt`,
    lines.join('\n'),
    'text/plain'
  );
}

export function exportMigrationPlanMarkdown(layout: RackLayout) {
  const summary = getMigrationSummary(layout);
  const markdown = [
    '# Rack Migration Plan',
    '',
    `Layout: ${layout.name}`,
    `Rack: ${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `Summary: ${summary.plannedDevices.length} planned devices, ${summary.decommissioningDevices.length} devices to remove, ${summary.plannedCables.length} planned cables, ${summary.decommissioningCables.length} cables to retire`,
    '',
    '## Install / Activate',
    '',
    ...(summary.plannedDevices.length > 0
      ? summary.plannedDevices.map((device) => `- Device: ${device.name} at U${device.positionU}${device.sizeU > 1 ? `-U${device.positionU + device.sizeU - 1}` : ''}`)
      : ['- None']),
    ...(summary.plannedCables.length > 0
      ? ['', ...summary.plannedCables.map((cable) => `- Cable: ${cable.type} ${cable.fromDeviceId} -> ${cable.toDeviceId}`)]
      : []),
    '',
    '## Remove / Retire',
    '',
    ...(summary.decommissioningDevices.length > 0
      ? summary.decommissioningDevices.map((device) => `- Device: ${device.name} at U${device.positionU}${device.sizeU > 1 ? `-U${device.positionU + device.sizeU - 1}` : ''}`)
      : ['- None']),
    ...(summary.decommissioningCables.length > 0
      ? ['', ...summary.decommissioningCables.map((cable) => `- Cable: ${cable.type} ${cable.fromDeviceId} -> ${cable.toDeviceId}`)]
      : []),
    '',
    '## Active Baseline',
    '',
    `- Devices remaining active: ${summary.activeDevices.length}`,
    `- Cables remaining active: ${summary.activeCables.length}`,
    '',
    'Generated by Homelab Rack Simulator',
  ].join('\n');

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-migration-plan.md`,
    markdown,
    'text/markdown'
  );
}

export function exportGoldenBaselineMarkdown(layout: RackLayout) {
  const baseline = layout.goldenBaseline;
  if (!baseline) return;
  const rows = getBaselineComparison(layout, baseline);
  const markdown = [
    '# Golden Layout Baseline',
    '',
    `Layout: ${layout.name}`,
    `Baseline: ${baseline.name}`,
    `Captured: ${baseline.capturedAt}`,
    '',
    '| Metric | Current | Baseline | Delta | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.label} | ${row.current} | ${row.baseline} | ${row.delta > 0 ? '+' : ''}${row.delta} | ${row.direction} |`),
    '',
    'Generated by Homelab Rack Simulator'
  ].join('\n');

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-golden-baseline.md`,
    markdown,
    'text/markdown'
  );
}

export function exportChangeCalendarText(layout: RackLayout) {
  const summary = getChangeCalendarSummary(layout);
  const lines = [
    `Rack change calendar: ${layout.name}`,
    `${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`,
    `Upcoming: ${summary.upcoming.length}`,
    `Overdue: ${summary.overdue.length}`,
    '',
    '## Events',
    '',
    ...((layout.changeEvents ?? []).length > 0
      ? (layout.changeEvents ?? []).map((event) => `- ${event.scheduledFor} | ${event.status} | ${event.riskLevel} | ${event.title}`)
      : ['- None']),
    '',
    '## Warnings',
    '',
    ...(summary.warnings.length > 0 ? summary.warnings.map((warning) => `- ${warning.detail}`) : ['- None']),
    '',
    'Generated by Homelab Rack Simulator'
  ];

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-change-calendar.txt`,
    lines.join('\n'),
    'text/plain'
  );
}

export function downloadChangeCalendarIcs(layout: RackLayout) {
  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-change-calendar.ics`,
    exportChangeCalendarIcs(layout),
    'text/calendar'
  );
}

export function exportWorkspaceJson(workspace: Workspace): string {
  return JSON.stringify(workspace, null, 2);
}

export function downloadWorkspaceJson(workspace: Workspace, filename?: string) {
  const name = filename || `${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workspace'}.json`;
  downloadTextFile(name, exportWorkspaceJson(workspace));
}

export function importWorkspaceJson(json: string): Workspace | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const workspace = parsed as Workspace;
    if (!Array.isArray(workspace.racks)) return null;
    if (typeof workspace.id !== 'string') return null;
    return normalizeWorkspace(workspace);
  } catch {
    return null;
  }
}

export function readJsonFile(file: File) {
  return new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function exportScenarioReportText(
  layout: RackLayout,
  results: import('./scenarioPlanner').ScenarioResult[],
  overall: { score: number; status: 'good' | 'warning' | 'critical'; failedAssumptionCount: number },
) {
  const lines: string[] = [];
  lines.push(`Scenario Resilience Report: ${layout.name}`);
  lines.push(`${RACK_SPECS[layout.rackType].label} / ${layout.heightU}U`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`## Overall readiness`);
  lines.push(`Score: ${overall.score}%`);
  lines.push(`Status: ${overall.status}`);
  lines.push(`Failed assumptions: ${overall.failedAssumptionCount}`);
  lines.push('');

  for (const result of results) {
    lines.push(`## ${result.presetLabel}`);
    lines.push(`_${result.presetDescription}_`);
    lines.push('');
    lines.push(`Summary: ${result.summary}`);
    lines.push(
      `Impacted: ${result.metrics.impactedCount} / ${result.metrics.totalDevices} ` +
        `· Survivors: ${result.metrics.survivorCount}` +
        (result.metrics.estimatedRuntimeMinutes !== undefined
          ? ` · Runtime: ${
              isFinite(result.metrics.estimatedRuntimeMinutes)
                ? `${Math.round(result.metrics.estimatedRuntimeMinutes)}m`
                : '∞'
            }`
          : ''),
    );
    lines.push('');

    if (result.failedAssumptions.length > 0) {
      lines.push(`### Assumptions`);
      for (const a of result.failedAssumptions) {
        const mark = a.status === 'pass' ? '✓' : a.status === 'fail' ? '✗' : '?';
        lines.push(`- ${mark} ${a.title} — ${a.detail}`);
      }
      lines.push('');
    }

    if (result.impactedDevices.length > 0) {
      lines.push(`### Impacted devices`);
      for (const d of result.impactedDevices) {
        lines.push(`- [${d.severity.toUpperCase()}] ${d.deviceName} — ${d.reason}`);
      }
      lines.push('');
    }

    if (result.survivingDevices.length > 0) {
      lines.push(`### Survivors`);
      for (const d of result.survivingDevices) {
        lines.push(`- ${d.deviceName} — ${d.reason}`);
      }
      lines.push('');
    }

    if (result.recommendations.length > 0) {
      lines.push(`### Recommendations`);
      for (const r of result.recommendations) {
        lines.push(`- [${r.priority.toUpperCase()}] ${r.title} — ${r.detail}`);
      }
      lines.push('');
    }

    lines.push('');
  }

  lines.push('Generated by Homelab Rack Simulator');

  downloadTextFile(
    `${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack-layout'}-scenario-report.txt`,
    lines.join('\n'),
    'text/plain',
  );
}
