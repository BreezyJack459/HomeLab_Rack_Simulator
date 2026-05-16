import type { RackLayout } from '../types/rack';
import { mergeChecklistRecords, summarizeChecklist, type ChecklistSection } from './checklists';
import { getDocumentationIssues } from './documentationAudit';
import { getMigrationSummary } from './migrationCalc';
import { buildPowerChains } from './powerChain';
import { calculateUpsRuntimes } from './upsRuntime';
import { getServiceabilityIssues } from './serviceability';

function countDevices(layout: RackLayout, categories: string[]) {
  return layout.devices.filter((device) => categories.includes(device.category)).length;
}

export function getCommissioningChecklist(layout: RackLayout): ChecklistSection[] {
  const migration = getMigrationSummary(layout);
  const documentationIssues = getDocumentationIssues(layout);
  const serviceabilityIssues = getServiceabilityIssues(layout);
  const upsRuntimes = calculateUpsRuntimes(layout);
  const powerChains = buildPowerChains(layout);
  const targetDevices = migration.plannedDevices.length > 0 ? migration.plannedDevices : migration.activeDevices;
  const commissioningRecords = layout.commissioningChecks;

  return [
    {
      id: 'physical',
      title: 'Physical Install',
      items: mergeChecklistRecords(
        [
          {
            id: 'commissioning-physical',
            title: 'Verify devices are secure, aligned, and serviceable',
            detail: `${targetDevices.length} device(s) are in scope for this commissioning pass; ${serviceabilityIssues.length} serviceability issue(s) are still open.`
          }
        ],
        commissioningRecords
      )
    },
    {
      id: 'labels-power',
      title: 'Labels And Power',
      items: mergeChecklistRecords(
        [
          {
            id: 'commissioning-labels',
            title: 'Confirm rack labels, endpoint labels, and patch references',
            detail:
              documentationIssues.length > 0
                ? `${documentationIssues.length} documentation issue(s) still need review before the layout can be treated as fully commissioned.`
                : 'Documentation audit is currently clean; verify that field labels match the model one last time.'
          },
          {
            id: 'commissioning-power',
            title: 'Run UPS, outlet, and power-path checks',
            detail:
              upsRuntimes.length > 0
                ? `${upsRuntimes.length} UPS runtime plan(s) are modeled and ${upsRuntimes.filter((runtime) => runtime.warnings.length > 0).length} include warnings.`
                : `${powerChains.length} modeled power chain(s) exist; validate each changed feed manually because no UPS runtime model is available.`
          }
        ],
        commissioningRecords
      )
    },
    {
      id: 'network-backup',
      title: 'Network And Backup',
      items: mergeChecklistRecords(
        [
          {
            id: 'commissioning-network',
            title: 'Validate link state, uplinks, and management reachability',
            detail: `${countDevices(layout, ['switch', 'router', 'firewall', 'access-point', 'patch-panel'])} network-facing device(s) need post-change path validation.`
          },
          {
            id: 'commissioning-backup',
            title: 'Prove restore or config-backup posture for stateful systems',
            detail: `${countDevices(layout, ['nas', 'server', 'mini-pc', 'router', 'firewall', 'switch'])} device(s) should have a restore test, config export, or rollback snapshot captured.`
          }
        ],
        commissioningRecords
      )
    },
    {
      id: 'monitoring-docs',
      title: 'Monitoring And Documentation',
      items: mergeChecklistRecords(
        [
          {
            id: 'commissioning-monitoring',
            title: 'Check monitoring, alerting, and runtime telemetry after the change',
            detail:
              upsRuntimes.length > 0
                ? 'Verify UPS telemetry, power alerts, and any critical host checks after the maintenance window closes.'
                : 'Verify management access, dashboard freshness, and alert paths even if no UPS telemetry is modeled.'
          },
          {
            id: 'commissioning-docs',
            title: 'Export updated layout, photos, and notes',
            detail: 'Capture front/rear photos, update the JSON export, and attach any field notes or serial/asset changes from the work.'
          }
        ],
        commissioningRecords
      )
    },
    {
      id: 'rollback',
      title: 'Rollback Verification',
      items: mergeChecklistRecords(
        [
          {
            id: 'commissioning-rollback',
            title: 'Record rollback readiness and close out the change',
            detail:
              migration.plannedDevices.length > 0 || migration.decommissioningDevices.length > 0
                ? `Planned devices: ${migration.plannedDevices.length}; decommissioning devices: ${migration.decommissioningDevices.length}. Note what was changed and what would be restored first.`
                : 'Even for maintenance-only work, note the restored-good state and any follow-up checks that remain open.'
          }
        ],
        commissioningRecords
      )
    }
  ];
}

export function commissioningStatus(layout: RackLayout) {
  const summary = summarizeChecklist(getCommissioningChecklist(layout));
  if (summary.failed > 0) return 'failed';
  if (summary.pending > 0) return 'in-progress';
  if (summary.passed > 0 && summary.pending === 0) return 'passed';
  return 'not-started';
}
