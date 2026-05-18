import {
  Building2,
  FileDown,
  Globe,
  Image,
  LayoutGrid,
  Map,
  Network,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { useMemo } from 'react';
import type { PortfolioLens } from '../types/appShell';
import type { RackLayout, Workspace } from '../types/rack';

interface PortfolioWorkbenchProps {
  workspace: Workspace;
  layout: RackLayout;
  currentLens: PortfolioLens;
  onSelectLens: (lens: PortfolioLens) => void;
}

const lensMeta: Record<
  PortfolioLens,
  {
    label: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  overview: {
    label: 'Overview',
    icon: <LayoutGrid size={14} />,
    description: 'Manage racks, switch between labs and export your workspace.',
  },
  rooms: {
    label: 'Rooms',
    icon: <Building2 size={14} />,
    description: 'Visualise room layouts and position racks in physical space.',
  },
  interconnect: {
    label: 'Interconnect',
    icon: <Network size={14} />,
    description: 'Map cross-rack cabling, fibre runs and trunk links.',
  },
  data: {
    label: 'Data',
    icon: <FileDown size={14} />,
    description: 'Import from DCIM tools and export portfolio reports.',
  },
  policy: {
    label: 'Policy',
    icon: <ShieldCheck size={14} />,
    description: 'Define compliance rules, naming conventions and standards.',
  },
  guide: {
    label: 'Guide',
    icon: <BookOpen size={14} />,
    description: 'Homelab setup wizard, documentation and rack photos.',
  },
};

function LensChip({
  lens,
  active,
  onClick,
}: {
  lens: PortfolioLens;
  active: boolean;
  onClick: () => void;
}) {
  const meta = lensMeta[lens];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {meta.icon}
      {meta.label}
    </button>
  );
}

function SnapshotCard({
  title,
  value,
  detail,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  tone: 'default' | 'warn' | 'danger';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
      : tone === 'warn'
        ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-200 bg-white/85 text-slate-700 dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:brightness-95 dark:hover:brightness-110 ${toneClass}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-80">{detail}</div>
    </button>
  );
}

export function PortfolioWorkbench({
  workspace,
  layout,
  currentLens,
  onSelectLens,
}: PortfolioWorkbenchProps) {
  const totalDevices = useMemo(
    () => workspace.racks.reduce((sum, r) => sum + r.devices.length, 0),
    [workspace.racks]
  );

  const totalRoomRacks = useMemo(
    () => workspace.racks.reduce((sum, r) => sum + (r.roomRacks?.length ?? 0), 0),
    [workspace.racks]
  );

  const interRackCableCount = workspace.interRackCables?.length ?? 0;
  const photoCount = layout.photos?.length ?? 0;
  const policyCount = layout.policies?.length ?? 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            Portfolio hub
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{lensMeta[currentLens].label}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {lensMeta[currentLens].description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(lensMeta) as PortfolioLens[]).map((lens) => (
            <LensChip key={lens} lens={lens} active={lens === currentLens} onClick={() => onSelectLens(lens)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotCard
          title="Racks"
          value={`${workspace.racks.length}`}
          detail="Racks in this workspace"
          tone="default"
          onClick={() => onSelectLens('overview')}
        />
        <SnapshotCard
          title="Devices"
          value={`${totalDevices}`}
          detail="Total devices across all racks"
          tone="default"
          onClick={() => onSelectLens('overview')}
        />
        <SnapshotCard
          title="Inter-rack cables"
          value={`${interRackCableCount}`}
          detail="Cross-rack fibre, copper and trunk links"
          tone={interRackCableCount > 0 ? 'default' : 'warn'}
          onClick={() => onSelectLens('interconnect')}
        />
        <SnapshotCard
          title="Room racks"
          value={`${totalRoomRacks}`}
          detail="Racks placed in room layouts"
          tone={totalRoomRacks > 0 ? 'default' : 'warn'}
          onClick={() => onSelectLens('rooms')}
        />
        <SnapshotCard
          title="Photos"
          value={`${photoCount}`}
          detail="Rack photos and documentation images"
          tone="default"
          onClick={() => onSelectLens('guide')}
        />
        <SnapshotCard
          title="Policies"
          value={`${policyCount}`}
          detail="Active compliance and naming rules"
          tone="default"
          onClick={() => onSelectLens('policy')}
        />
      </div>
    </section>
  );
}
