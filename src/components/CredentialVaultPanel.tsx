import {
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { DeviceCredential } from '../types/rack';
import {
  decryptValue,
  encryptValue,
  exportCredentialsMarkdown,
  getCredentialTypeLabel,
  getDeviceCredentials,
  isVaultUnlocked,
  lockVault,
  summarizeCredentials,
  unlockVault,
  validateCredentials,
} from '../utils/credentialVault';

const credentialTypeOptions: { value: DeviceCredential['type']; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'url', label: 'URL' },
  { value: 'text', label: 'Text' },
  { value: 'ssh-key', label: 'SSH Key' },
  { value: 'snmp', label: 'SNMP' },
];

function CredentialRow({
  credential,
  password,
  onUpdate,
  onRemove,
}: {
  credential: DeviceCredential;
  password: string;
  onUpdate: (patch: Partial<DeviceCredential>) => void;
  onRemove: () => void;
}) {
  const [showValue, setShowValue] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(credential.label);
  const [editType, setEditType] = useState<DeviceCredential['type']>(credential.type);

  async function reveal() {
    if (decrypted) {
      setShowValue(!showValue);
      return;
    }
    try {
      const value = await decryptValue(password, credential.value);
      setDecrypted(value);
      setShowValue(true);
    } catch {
      setDecrypted('[decryption failed]');
      setShowValue(true);
    }
  }

  async function copyToClipboard() {
    const value = decrypted ?? (await decryptValue(password, credential.value).catch(() => null));
    if (value) {
      await navigator.clipboard.writeText(value);
    }
  }

  function saveEdit() {
    onUpdate({ label: editLabel.trim(), type: editType });
    setIsEditing(false);
  }

  return (
    <div
      className="rounded-md border text-sm"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="flex items-center gap-2 p-2.5">
        <KeyRound size={13} className="shrink-0 opacity-60" />
        {isEditing ? (
          <>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="flex-1 rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value as DeviceCredential['type'])}
              className="rounded border px-1.5 py-0.5 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {credentialTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveEdit}
              className="rounded bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditLabel(credential.label);
                setEditType(credential.type);
                setIsEditing(false);
              }}
              className="rounded border px-2 py-0.5 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 truncate font-medium">{credential.label}</span>
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px]">
              {getCredentialTypeLabel(credential.type)}
            </span>
            <button
              type="button"
              onClick={reveal}
              className="opacity-60 transition hover:opacity-100"
              style={{ color: 'var(--theme-text-muted)' }}
              title={showValue ? 'Hide' : 'Reveal'}
            >
              {showValue ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="opacity-60 transition hover:opacity-100"
              style={{ color: 'var(--theme-text-muted)' }}
              title="Copy to clipboard"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="opacity-60 transition hover:opacity-100"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Shield size={13} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="opacity-60 transition hover:opacity-100"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {showValue && decrypted && !isEditing && (
        <div
          className="border-t px-3 py-2 text-xs font-mono"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {decrypted}
        </div>
      )}
    </div>
  );
}

function DeviceCredentialSection({
  deviceId,
  deviceName,
  allCredentials,
  password,
  onUpdate,
}: {
  deviceId: string;
  deviceName: string;
  allCredentials: DeviceCredential[];
  password: string;
  onUpdate: (deviceId: string, credentials: DeviceCredential[]) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<DeviceCredential['type']>('password');
  const [formValue, setFormValue] = useState('');

  const credentials = getDeviceCredentials(deviceId, allCredentials);

  async function addCredential() {
    if (!formLabel.trim() || !formValue.trim()) return;
    const encrypted = await encryptValue(password, formValue);
    const newCredential: DeviceCredential = {
      id: `cred-${Date.now()}`,
      deviceId,
      label: formLabel.trim(),
      value: encrypted,
      type: formType,
    };
    onUpdate(deviceId, [...credentials, newCredential]);
    setFormLabel('');
    setFormValue('');
    setFormType('password');
    setShowAdd(false);
  }

  function updateCredential(id: string, patch: Partial<DeviceCredential>) {
    onUpdate(
      deviceId,
      credentials.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function removeCredential(id: string) {
    onUpdate(
      deviceId,
      credentials.filter((c) => c.id !== id)
    );
  }

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{deviceName}</div>
        <div className="text-[10px] opacity-60">{credentials.length} credential(s)</div>
      </div>

      <div className="space-y-1">
        {credentials.map((c) => (
          <CredentialRow
            key={c.id}
            credential={c}
            password={password}
            onUpdate={(patch) => updateCredential(c.id, patch)}
            onRemove={() => removeCredential(c.id)}
          />
        ))}
      </div>

      {showAdd ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (e.g. Admin Password)"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as DeviceCredential['type'])}
              className="rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-secondary)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {credentialTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Value (will be encrypted)"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            className="w-full rounded border px-2 py-1 text-xs font-mono"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-secondary)',
              color: 'var(--theme-text-primary)',
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addCredential}
              className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              Add Credential
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded border px-2 py-1 text-[11px]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] opacity-70 transition hover:opacity-100"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
            backgroundColor: 'var(--theme-bg-secondary)',
          }}
        >
          <Plus size={11} />
          Add credential
        </button>
      )}
    </div>
  );
}

export function CredentialVaultPanel() {
  const layout = useRackStore((state) => state.layout);
  const updateRack = useRackStore((state) => state.updateRack);
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(isVaultUnlocked());
  const [showExport, setShowExport] = useState(false);

  const allCredentials = layout.credentials ?? [];

  const devicesWithCredentials = useMemo(() => {
    const credentialDeviceIds = new Set(allCredentials.map((c) => c.deviceId));
    return layout.devices.filter((d) => credentialDeviceIds.has(d.id) || d.category !== 'blank');
  }, [layout.devices, allCredentials]);

  const summary = useMemo(() => summarizeCredentials(allCredentials), [allCredentials]);
  const issues = useMemo(() => validateCredentials(allCredentials, layout.devices), [allCredentials, layout.devices]);

  function doUnlock() {
    if (!password.trim()) return;
    unlockVault(password.trim());
    setUnlocked(true);
  }

  function doLock() {
    lockVault();
    setPassword('');
    setUnlocked(false);
    setShowExport(false);
  }

  function updateDeviceCredentials(deviceId: string, credentials: DeviceCredential[]) {
    const otherCreds = allCredentials.filter((c) => c.deviceId !== deviceId);
    const newCredentials = credentials.length > 0 ? [...otherCreds, ...credentials] : otherCreds;
    updateRack({ credentials: newCredentials.length > 0 ? newCredentials : undefined });
  }

  async function handleExport() {
    if (!unlocked) return;
    const vaultPassword = password;
    const md = await exportCredentialsMarkdown(allCredentials, layout.devices, vaultPassword);
    const blob = new Blob([md], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credentials-export.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <Shield size={15} />
          Credential Vault
        </div>
        {unlocked ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <Download size={11} />
              Export
            </button>
            <button
              type="button"
              onClick={doLock}
              className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-red-700 dark:text-red-300"
            >
              <Lock size={11} />
              Lock
            </button>
          </div>
        ) : (
          <span className="text-[10px] opacity-60">Locked</span>
        )}
      </div>

      {/* Unlock form */}
      {!unlocked && (
        <div className="mb-3 rounded-md border p-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="mb-2 text-xs opacity-70">
            Enter your master password to unlock the vault. Credentials are encrypted client-side
            with AES-GCM.
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doUnlock();
              }}
              className="flex-1 rounded border px-2 py-1 text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-primary)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <button
              type="button"
              onClick={doUnlock}
              className="rounded bg-cyan-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-cyan-700"
            >
              <Unlock size={12} className="inline mr-1" />
              Unlock
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalDevices}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Devices
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-slate-900 dark:text-white">{summary.totalCredentials}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Credentials
          </div>
        </div>
        <div
          className="rounded-md border p-2 text-center"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {issues.filter((i) => i.severity === 'critical').length}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
            Issues
          </div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-3 space-y-1">
          {issues.slice(0, 3).map((issue) => (
            <div
              key={issue.id}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                issue.severity === 'critical'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              <span className="font-medium">{issue.title}:</span> {issue.detail}
            </div>
          ))}
          {issues.length > 3 && (
            <div className="text-center text-[10px] opacity-60">+{issues.length - 3} more issues</div>
          )}
        </div>
      )}

      {/* Device sections */}
      {unlocked && (
        <div className="space-y-3">
          {devicesWithCredentials.map((device) => (
            <DeviceCredentialSection
              key={device.id}
              deviceId={device.id}
              deviceName={device.name}
              allCredentials={allCredentials}
              password={password}
              onUpdate={updateDeviceCredentials}
            />
          ))}
        </div>
      )}

      {unlocked && devicesWithCredentials.length === 0 && (
        <div
          className="rounded-md border p-3 text-center text-xs opacity-60"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
        >
          No devices with credentials yet. Add credentials to any device to get started.
        </div>
      )}
    </section>
  );
}
