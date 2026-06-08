import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Flame,
  Home,
  Info,
  MapPin,
  Maximize2,
  Move,
  Ruler,
  Thermometer,
  Volume2,
  Weight,
  Wind,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackLayout } from '../types/rack';
import {
  analyzeRoomPlacement,
  getDefaultRoomParams,
  type FloorType,
  type RackPosition,
  type RoomParams,
  type RoomPlacementIssue,
  type RoomType,
} from '../utils/roomPlacement';

const roomTypeLabels: Record<RoomType, string> = {
  bedroom: 'Bedroom',
  office: 'Office',
  closet: 'Closet',
  garage: 'Garage',
  basement: 'Basement',
};

const floorTypeLabels: Record<FloorType, string> = {
  wood: 'Wood',
  concrete: 'Concrete',
  tile: 'Tile',
  carpet: 'Carpet',
};

const rackPositionLabels: Record<RackPosition, string> = {
  'against-wall': 'Against Wall',
  center: 'Center',
  corner: 'Corner',
};

function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'text-emerald-600 dark:text-emerald-400';
  let bgClass = 'bg-emerald-500/10 border-emerald-500/30';
  let label = 'Excellent';
  if (score < 70) {
    colorClass = 'text-red-600 dark:text-red-400';
    bgClass = 'bg-red-500/10 border-red-500/30';
    label = 'Poor';
  } else if (score < 90) {
    colorClass = 'text-amber-600 dark:text-amber-400';
    bgClass = 'bg-amber-500/10 border-amber-500/30';
    label = 'Fair';
  }
  return (
    <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${bgClass}`}>
      <span className={`font-bold ${colorClass}`}>{score}</span>
      <span className={`font-medium ${colorClass}`}>{label}</span>
    </div>
  );
}

function IssueCard({ issue }: { issue: RoomPlacementIssue }) {
  const severityConfig = {
    critical: { icon: AlertTriangle, colorClass: 'text-red-400', borderClass: 'border-red-500/30', bgClass: 'bg-red-500/5' },
    warning: { icon: AlertTriangle, colorClass: 'text-amber-400', borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/5' },
    info: { icon: Info, colorClass: 'text-sky-400', borderClass: 'border-sky-500/30', bgClass: 'bg-sky-500/5' },
  };
  const config = severityConfig[issue.severity];
  const Icon = config.icon;
  return (
    <div className={`rounded-md border p-2.5 text-xs ${config.bgClass} ${config.borderClass}`}>
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

function NumberInput({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </label>
      <div className="flex items-center rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--theme-border)' }}>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: 'var(--theme-text-primary)' }}
        />
        <span className="ml-1 shrink-0 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{suffix}</span>
      </div>
    </div>
  );
}

function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-primary)' }}
      >
        {(Object.entries(options) as [string, string][]).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
}

export function RoomPlacementPanel() {
  const layout = useRackStore((state) => state.layout);
  const [isOpen, setIsOpen] = useState(true);
  const [params, setParams] = useState<RoomParams>(getDefaultRoomParams());

  const result = useMemo(() => analyzeRoomPlacement(layout, params), [layout, params]);

  function updateParam<K extends keyof RoomParams>(key: K, value: RoomParams[K]) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

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
          <Home size={15} />
          Room Placement
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={result.score} />
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden space-y-4">
          {/* Room parameters */}
          <div className="rounded-md border p-3 space-y-3" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
              Room Parameters
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="Width" value={params.roomWidthMm} onChange={(v) => updateParam('roomWidthMm', v)} suffix="mm" />
              <NumberInput label="Depth" value={params.roomDepthMm} onChange={(v) => updateParam('roomDepthMm', v)} suffix="mm" />
              <NumberInput label="Height" value={params.roomHeightMm} onChange={(v) => updateParam('roomHeightMm', v)} suffix="mm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectInput label="Room Type" value={params.roomType} options={roomTypeLabels} onChange={(v) => updateParam('roomType', v)} />
              <SelectInput label="Floor" value={params.floorType} options={floorTypeLabels} onChange={(v) => updateParam('floorType', v)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectInput label="Rack Position" value={params.rackPosition} options={rackPositionLabels} onChange={(v) => updateParam('rackPosition', v)} />
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--theme-border)' }}>
                  <input
                    type="checkbox"
                    checked={params.hasAc}
                    onChange={(e) => updateParam('hasAc', e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <Wind size={13} style={{ color: 'var(--theme-text-muted)' }} />
                  <span style={{ color: 'var(--theme-text-secondary)' }}>Has AC</span>
                </label>
              </div>
            </div>
          </div>

          {/* Rack footprint */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center justify-center gap-1">
                <Ruler size={11} /> Width
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                {(result.rackFootprint.widthMm / 1000).toFixed(2)}m
              </div>
            </div>
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center justify-center gap-1">
                <Maximize2 size={11} /> Depth
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                {(result.rackFootprint.depthMm / 1000).toFixed(2)}m
              </div>
            </div>
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center justify-center gap-1">
                <Move size={11} /> Height
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                {(result.rackFootprint.heightMm / 1000).toFixed(2)}m
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center gap-1">
                <Weight size={11} /> Total Weight
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                {result.totalWeightKg.toFixed(1)} kg
              </div>
            </div>
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center gap-1">
                <MapPin size={11} /> Floor Loading
              </div>
              <div className={`mt-1 font-semibold ${result.floorLoadingKgPerM2 > 500 ? 'text-red-400' : result.floorLoadingKgPerM2 > 150 ? 'text-amber-400' : ''}`}>
                {result.floorLoadingKgPerM2.toFixed(0)} kg/m²
              </div>
            </div>
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center gap-1">
                <Flame size={11} /> Heat Output
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                {result.heatOutputW} W
              </div>
            </div>
            <div className="rounded-md border p-2" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
              <div style={{ color: 'var(--theme-text-muted)' }} className="flex items-center gap-1">
                <Volume2 size={11} /> Est. Noise
              </div>
              <div className={`mt-1 font-semibold ${result.estimatedNoiseDb > 55 ? 'text-amber-400' : result.estimatedNoiseDb > 45 ? 'text-sky-400' : ''}`}>
                {result.estimatedNoiseDb > 0 ? `${result.estimatedNoiseDb} dB` : '—'}
              </div>
            </div>
          </div>

          {/* Minimum room requirements */}
          <div className="rounded-md border p-3" style={{ backgroundColor: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border)' }}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
              Minimum Requirements
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-secondary)' }}>Room width</span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {(result.minRoomWidthMm / 1000).toFixed(2)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-secondary)' }}>Room depth</span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {(result.minRoomDepthMm / 1000).toFixed(2)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-secondary)' }}>Front clearance</span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {(result.requiredFrontClearanceMm / 1000).toFixed(2)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-secondary)' }}>Rear clearance</span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {(result.requiredRearClearanceMm / 1000).toFixed(2)}m
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--theme-text-secondary)' }}>Side clearance</span>
                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {(result.requiredSideClearanceMm / 1000).toFixed(2)}m
                </span>
              </div>
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                Issues ({result.issues.length})
              </div>
              {result.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--theme-text-muted)' }}>
                Recommendations
              </div>
              {result.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md border p-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-secondary)',
                  }}
                >
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {result.issues.length === 0 && result.recommendations.length === 0 && (
            <div
              className="rounded-md border p-3 text-xs text-center"
              style={{
                backgroundColor: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <CheckCircle2 size={16} className="mx-auto mb-1 text-emerald-400" />
              No placement concerns for this configuration.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
