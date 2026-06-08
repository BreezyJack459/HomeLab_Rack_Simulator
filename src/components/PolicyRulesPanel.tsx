import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Layers,
  Plus,
  Settings,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackPolicy, RackPolicyType } from '../types/rack';
import type { PolicyPresetName } from '../utils/policyEngine';
import {
  DEFAULT_POLICY_PARAMS,
  evaluatePolicies,
  getDefaultPolicies,
  getPolicyPreset,
  getPresetDescription,
  getPresetLabel,
  POLICY_PRESETS,
  policyDescription,
  policyLabel,
} from '../utils/policyEngine';

const severityConfig = {
  critical: { icon: AlertTriangle, colorClass: 'text-red-400', bgClass: 'bg-red-500/5 border-red-500/30' },
  warning: { icon: AlertTriangle, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/5 border-amber-500/30' },
  info: { icon: Info, colorClass: 'text-sky-400', bgClass: 'bg-sky-500/5 border-sky-500/30' },
};

function ViolationCard({ issue }: { issue: ReturnType<typeof evaluatePolicies>[number] }) {
  const config = severityConfig[issue.severity];
  const Icon = config.icon;
  return (
    <div className={`rounded-md border p-2.5 text-xs ${config.bgClass}`}>
      <div className="flex items-center gap-2">
        <Icon size={13} className={`shrink-0 ${config.colorClass}`} />
        <span className={`font-medium ${config.colorClass}`}>{issue.title}</span>
      </div>
      <div className="mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
        {issue.detail}
      </div>
    </div>
  );
}

function PolicyRow({
  policy,
  onToggle,
  onSeverityChange,
  onParamChange,
  onRemove,
  violationCount,
}: {
  policy: RackPolicy;
  onToggle: () => void;
  onSeverityChange: (severity: 'warning' | 'critical') => void;
  onParamChange: (key: string, value: number) => void;
  onRemove: () => void;
  violationCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const params = policy.params;
  const paramKeys = Object.keys(params);

  return (
    <div
      className="rounded-md border"
      style={{
        backgroundColor: policy.enabled ? 'var(--theme-bg-primary)' : 'transparent',
        borderColor: policy.enabled ? 'var(--theme-border)' : 'var(--theme-border)',
        opacity: policy.enabled ? 1 : 0.7,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={onToggle} className="shrink-0">
          {policy.enabled ? (
            <ToggleRight size={18} className="text-emerald-400" />
          ) : (
            <ToggleLeft size={18} style={{ color: 'var(--theme-text-muted)' }} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>
              {policyLabel(policy.type)}
            </span>
            {violationCount > 0 && policy.enabled && (
              <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                {violationCount}
              </span>
            )}
          </div>
          <div className="truncate text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
            {policyDescription(policy.type)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded p-1 transition hover:bg-white/5"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 transition hover:bg-red-500/10"
        >
          <Trash2 size={13} className="text-red-400/70" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t px-3 py-2" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
              Severity
            </span>
            <div className="flex gap-1">
              {(['warning', 'critical'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => onSeverityChange(sev)}
                  className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] transition ${
                    policy.severity === sev
                      ? sev === 'critical'
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : ''
                  }`}
                  style={policy.severity !== sev ? { borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' } : {}}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {paramKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {paramKeys.map((key) => (
                <div key={key}>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                    {key}
                  </label>
                  <input
                    type="number"
                    value={Number(params[key])}
                    onChange={(e) => onParamChange(key, Number(e.target.value))}
                    className="w-full rounded-md border bg-transparent px-2 py-1 text-xs outline-none"
                    style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PolicyRulesPanel() {
  const layout = useRackStore((state) => state.layout);
  const addPolicy = useRackStore((state) => state.addPolicy);
  const updatePolicy = useRackStore((state) => state.updatePolicy);
  const removePolicy = useRackStore((state) => state.removePolicy);

  const [isOpen, setIsOpen] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PolicyPresetName | ''>('');

  const policies = layout.policies ?? [];
  const violations = useMemo(() => evaluatePolicies(layout), [layout]);

  const enabledPolicies = policies.filter((p) => p.enabled);
  const enabledViolationCount = violations.length;

  function handleAddPolicy(type: RackPolicyType) {
    addPolicy({
      type,
      enabled: true,
      severity: 'warning',
      params: { ...DEFAULT_POLICY_PARAMS[type] },
    });
    setShowAddMenu(false);
  }

  function handleResetDefaults() {
    const defaults = getDefaultPolicies();
    for (const policy of defaults) {
      addPolicy(policy);
    }
  }

  function handleApplyPreset() {
    if (!selectedPreset) return;
    const presetPolicies = getPolicyPreset(selectedPreset);
    // Remove all existing policies first, then add preset policies
    for (const policy of policies) {
      removePolicy(policy.id);
    }
    for (const policy of presetPolicies) {
      addPolicy(policy);
    }
    setSelectedPreset('');
  }

  const violationByPolicy = new Map<string, number>();
  for (const issue of violations) {
    const policyId = issue.id.replace('policy-', '').replace(/-.+$/, '');
    // The issue id format is `policy-{type}-{policyId}`
    // Extract policyId from the end
    const match = issue.id.match(/^policy-[^-]+-(.+)$/);
    if (match) {
      const pid = match[1];
      violationByPolicy.set(pid, (violationByPolicy.get(pid) ?? 0) + 1);
    }
  }

  const availableTypes = (Object.keys(DEFAULT_POLICY_PARAMS) as RackPolicyType[]).filter(
    (type) => !policies.some((p) => p.type === type)
  );

  return (
    <section
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] transition"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <div className="flex items-center gap-2">
          <Shield size={15} />
          Policy Rules
        </div>
        <div className="flex items-center gap-2">
          {enabledPolicies.length > 0 && (
            <span
              className="rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: enabledViolationCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                color: enabledViolationCount > 0 ? '#f87171' : '#34d399',
              }}
            >
              {enabledPolicies.length} enabled
              {enabledViolationCount > 0 ? ` · ${enabledViolationCount} violation${enabledViolationCount === 1 ? '' : 's'}` : ' · clean'}
            </span>
          )}
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-3">
          {/* Preset selector */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
              Preset Templates
            </div>
            <div className="flex gap-2">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value as PolicyPresetName | '')}
                className="flex-1 rounded-md border bg-transparent px-2 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
              >
                <option value="">Select a preset…</option>
                {POLICY_PRESETS.map((name) => (
                  <option key={name} value={name}>
                    {getPresetLabel(name)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleApplyPreset}
                disabled={!selectedPreset}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
              >
                <Layers size={13} />
                Apply
              </button>
            </div>
            {selectedPreset && (
              <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                {getPresetDescription(selectedPreset)}
              </div>
            )}
          </div>

          {/* Violations summary */}
          {violations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                Violations ({violations.length})
              </div>
              {violations.map((issue) => (
                <ViolationCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {/* Policy list */}
          {policies.length > 0 ? (
            <div className="space-y-2">
              {policies.map((policy) => (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  onToggle={() => updatePolicy(policy.id, { enabled: !policy.enabled })}
                  onSeverityChange={(severity) => updatePolicy(policy.id, { severity })}
                  onParamChange={(key, value) =>
                    updatePolicy(policy.id, { params: { ...policy.params, [key]: value } })
                  }
                  onRemove={() => removePolicy(policy.id)}
                  violationCount={violationByPolicy.get(policy.id) ?? 0}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-md border p-3 text-center text-xs"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <Settings size={16} className="mx-auto mb-1" style={{ color: 'var(--theme-text-muted)' }} />
              No policies configured. Add rules to enforce layout standards.
            </div>
          )}

          {/* Add policy */}
          <div className="relative">
            {showAddMenu ? (
              <div
                className="rounded-md border p-2"
                style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                    Add Policy
                  </span>
                  <button type="button" onClick={() => setShowAddMenu(false)} className="rounded p-1 transition hover:bg-white/5">
                    <X size={13} style={{ color: 'var(--theme-text-muted)' }} />
                  </button>
                </div>
                {availableTypes.length > 0 ? (
                  <div className="space-y-1">
                    {availableTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAddPolicy(type)}
                        className="w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition hover:bg-white/5"
                        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                      >
                        <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{policyLabel(type)}</div>
                        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{policyDescription(type)}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>All policy types are already added.</div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMenu(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-white/5"
                  style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                >
                  <Plus size={13} />
                  Add Policy
                </button>
                {policies.length === 0 && (
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-white/5"
                    style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
                  >
                    <Settings size={13} />
                    Defaults
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
