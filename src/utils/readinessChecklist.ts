import type { RackLayout } from '../types/rack';
import { buildBom } from './bom';
import { getDocumentationIssues } from './documentationAudit';
import { getMigrationSummary } from './migrationCalc';
import { getProcurementChecklist } from './procurement';
import { calculateUpsRuntimes } from './upsRuntime';
import { mergeChecklistRecords, type ChecklistSection } from './checklists';
import { getCableStrainRisks, getFrontRearCollisions, getHeavyOverLightIssues } from './serviceability';

function listNames(names: string[]) {
  if (names.length === 0) return 'none';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

export function getReadinessChecklist(layout: RackLayout): ChecklistSection[] {
  const procurement = getProcurementChecklist(layout);
  const migration = getMigrationSummary(layout);
  const documentationIssues = getDocumentationIssues(layout);
  const upsRuntimes = calculateUpsRuntimes(layout);
  const bom = buildBom(layout);
  const cableStrainRisks = getCableStrainRisks(layout);
  const frontRearCollisions = getFrontRearCollisions(layout);
  const heavyDevices = layout.devices.filter((device) => device.weightKg >= 12).map((device) => device.name);
  const hardwareItems = procurement.filter((item) =>
    ['rack-hardware', 'rack-accessory', 'power', 'printed-part'].includes(item.category)
  );
  const labelItems = procurement.filter((item) => item.category === 'label');
  const backupsNeeded = layout.devices.filter((device) =>
    ['firewall', 'router', 'switch', 'nas', 'server', 'mini-pc'].includes(device.category)
  );
  const readinessRecords = layout.readinessChecks;

  return [
    {
      id: 'build-kit',
      title: 'Build Kit',
      items: mergeChecklistRecords(
        [
          {
            id: 'readiness-tools',
            title: 'Stage tools, driver bits, and lifting support',
            detail:
              heavyDevices.length > 0
                ? `Heavy devices need support on build day: ${listNames(heavyDevices)}.`
                : 'Gather screwdrivers, cage-nut tool, labels, and cable tester before touching the rack.'
          },
          {
            id: 'readiness-hardware',
            title: 'Confirm rack hardware, shelves, rails, and printed parts are on hand',
            detail:
              hardwareItems.length > 0
                ? `${hardwareItems.length} supporting hardware item(s) still need staging from the build planner.`
                : 'No extra rack hardware is currently flagged, but do a quick fastener count before the window starts.'
          }
        ],
        readinessRecords
      )
    },
    {
      id: 'labels-cables',
      title: 'Labels And Cabling',
      items: mergeChecklistRecords(
        [
          {
            id: 'readiness-labels',
            title: 'Print labels and patch references for planned work',
            detail:
              labelItems.length > 0
                ? `${labelItems.reduce((sum, item) => sum + item.quantity, 0)} label(s) are in the procurement checklist; documentation audit currently shows ${documentationIssues.length} documentation issue(s).`
                : documentationIssues.length > 0
                  ? `${documentationIssues.length} documentation issue(s) remain; clear them before build day if they affect the touched devices.`
                  : 'Current layout has no obvious label debt, but print endpoint labels for any changed cables.'
          },
          {
            id: 'readiness-cables',
            title: 'Pull cable inventory with slack and service-loop allowance',
            detail:
              bom.length > 0
                ? `${bom.reduce((sum, line) => sum + line.count, 0)} cable route(s) are modeled; ${cableStrainRisks.length} serviceability risk(s) need extra slack validation.`
                : 'No cable BOM exists yet; confirm whether this change can proceed without adding or rerouting cables.'
          }
        ],
        readinessRecords
      )
    },
    {
      id: 'change-window',
      title: 'Change Window',
      items: mergeChecklistRecords(
        [
          {
            id: 'readiness-backups',
            title: 'Capture config backups and rollback snapshots',
            detail:
              backupsNeeded.length > 0
                ? `Take fresh exports or snapshots for ${backupsNeeded.length} backup-relevant device(s): ${listNames(backupsNeeded.map((device) => device.name))}.`
                : 'No obvious config-bearing devices were found, but keep the current layout JSON export as the rollback baseline.'
          },
          {
            id: 'readiness-shutdown',
            title: 'Review shutdown order and outage timing',
            detail:
              upsRuntimes.length > 0
                ? `${upsRuntimes.length} UPS model(s) exist; ${upsRuntimes.filter((runtime) => runtime.warnings.length > 0).length} require attention before the maintenance window.`
                : migration.decommissioningDevices.length > 0
                  ? `There are ${migration.decommissioningDevices.length} device(s) marked for decommissioning; write the shutdown order before removal starts.`
                  : 'No UPS runtime plan is modeled yet; define outage order manually if this work touches power or storage.'
          },
          {
            id: 'readiness-install-order',
            title: 'Walk through install order from bottom to top',
            detail:
              migration.plannedDevices.length > 0
                ? `${migration.plannedDevices.length} planned device(s) are queued: ${listNames(migration.plannedDevices.map((device) => device.name))}.`
                : 'No devices are marked as planned, so this checklist mostly serves maintenance or cleanup work.'
          }
        ],
        readinessRecords
      )
    },
    {
      id: 'risk-checks',
      title: 'Risk Checks',
      items: mergeChecklistRecords(
        [
          {
            id: 'readiness-serviceability',
            title: 'Re-check weight, depth, and access risks before touching hardware',
            detail: `${getHeavyOverLightIssues(layout).length} heavy-over-light issue(s), ${frontRearCollisions.length} front/rear collision(s), and ${cableStrainRisks.length} short-cable service risk(s) are currently modeled.`
          },
          {
            id: 'readiness-smoke-tests',
            title: 'Write the post-change smoke test list',
            detail:
              layout.devices.length > 0
                ? 'Include power-up, uplink, storage, management, and backup-path checks for every changed device.'
                : 'Create a minimal smoke test list anyway so the maintenance window has a clean exit criterion.'
          }
        ],
        readinessRecords
      )
    },
    {
      id: 'closeout',
      title: 'Closeout',
      items: mergeChecklistRecords(
        [
          {
            id: 'readiness-cleanup',
            title: 'Reserve cleanup time for labels, photos, and leftover parts',
            detail:
              documentationIssues.length > 0
                ? `Documentation still has ${documentationIssues.length} issue(s); budget time for final photos and layout updates after the physical work is done.`
                : 'Plan a final pass for cable dressing, label verification, and updated rack photos before ending the window.'
          }
        ],
        readinessRecords
      )
    }
  ];
}
