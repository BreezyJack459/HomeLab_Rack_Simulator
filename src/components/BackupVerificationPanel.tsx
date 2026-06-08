import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  HardDrive,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { BackupRecord, PlacedDevice } from '../types/rack';
import {
  DAYS_UNTIL_RESTORE_ALERT,
  daysSince,
  deviceBackupHealth,
  exportBackupReport,
  formatBackupDate,
  isBackupStale,
  isRestoreOverdue,
  summarizeBackups,
} from '../utils/backupTracking';

function BackupRow({
  backup,
  onUpdate,
  onRemove,
}: {
  backup: BackupRecord;
  onUpdate: (patch: Partial<BackupRecord>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overdue = isRestoreOverdue(backup);
  const stale = isBackupStale(backup, backup.rpoHours);

  return (
    <div className="rounded-md border text-sm" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="opacity-70 transition hover:opacity-100"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <HardDrive size={14} className="shrink-0 opacity-70" />
        <span className="flex-1 truncate font-medium">{backup.destination}</span>
        {overdue && (
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            Restore overdue
          </span>
        )}
        {stale && !overdue && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            Stale
          </span>
        )}
        {backup.lastRestoreTestResult === 'pass' && !overdue && (
          <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
        )}
        {backup.lastRestoreTestResult === 'fail' && (
          <AlertTriangle size={13} className="shrink-0 text-red-500" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t px-3 py-2.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-60">Last backup</div>
              <input
                type="date"
                value={backup.lastBackupDate ? backup.lastBackupDate.slice(0, 10) : ''}
                onChange={(e) => onUpdate({ lastBackupDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-60">Size (GB)</div>
              <input
                type="number"
                value={backup.backupSizeGb ?? ''}
                onChange={(e) => onUpdate({ backupSizeGb: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-60">Last restore test</div>
              <input
                type="date"
                value={backup.lastRestoreTestDate ? backup.lastRestoreTestDate.slice(0, 10) : ''}
                onChange={(e) => onUpdate({ lastRestoreTestDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-60">Test result</div>
              <select
                value={backup.lastRestoreTestResult ?? ''}
                onChange={(e) => onUpdate({ lastRestoreTestResult: e.target.value as BackupRecord['lastRestoreTestResult'] })}
                className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
              >
                <option value="">Untested</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-60">Target RPO (hours)</div>
              <input
                type="number"
                value={backup.rpoHours ?? ''}
                onChange={(e) => onUpdate({ rpoHours: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
              />
            </div>
          </div>
          <textarea
            placeholder="Notes"
            value={backup.notes ?? ''}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={2}
            className="w-full rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
          />
        </div>
      )}
    </div>
  );
}

function DeviceBackupCard({
  device,
  onUpdate,
}: {
  device: PlacedDevice;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [destination, setDestination] = useState('');
  const health = deviceBackupHealth(device);
  const backups = device.backups ?? [];

  function addBackup() {
    if (!destination.trim()) return;
    const newBackup: BackupRecord = {
      id: `backup-${Date.now()}`,
      destination: destination.trim(),
      lastBackupDate: new Date().toISOString(),
      rpoHours: 24,
    };
    onUpdate({ backups: [...backups, newBackup] });
    setDestination('');
    setShowForm(false);
  }

  function updateBackup(id: string, patch: Partial<BackupRecord>) {
    onUpdate({
      backups: backups.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  }

  function removeBackup(id: string) {
    onUpdate({ backups: backups.filter((b) => b.id !== id) });
  }

  return (
    <div className="rounded-md border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
      <div className="flex items-center gap-2 p-2.5">
        {health === 'good' && <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />}
        {health === 'warning' && <AlertTriangle size={14} className="shrink-0 text-amber-500" />}
        {health === 'critical' && <AlertTriangle size={14} className="shrink-0 text-red-500" />}
        {health === 'unknown' && <HardDrive size={14} className="shrink-0 opacity-50" />}
        <span className="flex-1 text-sm font-medium">{device.name}</span>
        <span className="text-[10px] opacity-60">{backups.length} backup{backups.length === 1 ? '' : 's'}</span>
      </div>
      {backups.length > 0 && (
        <div className="space-y-1 border-t px-2 pb-2 pt-1" style={{ borderColor: 'var(--theme-border)' }}>
          {backups.map((backup) => (
            <BackupRow
              key={backup.id}
              backup={backup}
              onUpdate={(patch) => updateBackup(backup.id, patch)}
              onRemove={() => removeBackup(backup.id)}
            />
          ))}
        </div>
      )}
      {showForm ? (
        <div className="flex gap-2 border-t p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <input
            type="text"
            placeholder="Destination (e.g. NAS-01, B2, USB)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="flex-1 rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
          />
          <button
            type="button"
            onClick={addBackup}
            className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded border px-2 py-1 text-[11px]"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-1 border-t py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Plus size={11} />
          Add backup record
        </button>
      )}
    </div>
  );
}

export function BackupVerificationPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateDevice = useRackStore((state) => state.updateDevice);
  const devices = layout.devices;
  const summary = useMemo(() => summarizeBackups(devices), [devices]);

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-text-muted)' }}>
          <HardDrive size={15} />
          Backup Verification
        </div>
        <button
          type="button"
          onClick={() => {
            const report = exportBackupReport(devices);
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'backup-report.md';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <Download size={11} />
          Export
        </button>
      </div>

      {/* Summary */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.devicesWithBackups}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Tracked</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalBackups}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Backups</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.passRate}%</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Pass rate</div>
        </div>
        <div className="rounded-md border p-2 text-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.overdueRestoreCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>Overdue</div>
        </div>
      </div>

      {summary.overdueRestoreCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-100">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{summary.overdueRestoreCount} backup record(s) have not been restore-tested in {DAYS_UNTIL_RESTORE_ALERT}+ days.</span>
        </div>
      )}

      <div className="space-y-2">
        {devices.map((device) => (
          <DeviceBackupCard
            key={device.id}
            device={device}
            onUpdate={(patch) => updateDevice(device.id, patch)}
          />
        ))}
      </div>
    </section>
  );
}
