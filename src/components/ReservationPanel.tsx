import { BookmarkPlus, ChevronDown, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRackStore } from '../store/rackStore';
import type { RackReservationPurpose, ViewSide, WidthType } from '../types/rack';
import { RACK_SPECS } from '../utils/rackMath';

const PURPOSES: Array<{ value: RackReservationPurpose; label: string }> = [
  { value: 'future-device', label: 'Future device' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'patch-panel', label: 'Patch panel' },
  { value: 'ups', label: 'UPS' },
  { value: 'printed-mount', label: 'Printed mount' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'other', label: 'Other' }
];

const FIELD_CLASS = 'mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export function ReservationPanel() {
  const layout = useRackStore((state) => state.layout);
  const addReservation = useRackStore((state) => state.addReservation);
  const updateReservation = useRackStore((state) => state.updateReservation);
  const removeReservation = useRackStore((state) => state.removeReservation);
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState('Future expansion');
  const [positionU, setPositionU] = useState(1);
  const [sizeU, setSizeU] = useState(1);
  const [purpose, setPurpose] = useState<RackReservationPurpose>('future-device');
  const [mountSide, setMountSide] = useState<ViewSide>(layout.viewSide);
  const reservations = layout.reservations ?? [];
  const rackWidthMm = RACK_SPECS[layout.rackType].usableWidthMm;

  const reservedU = useMemo(() => {
    const used = new Set<number>();
    reservations.forEach((reservation) => {
      for (let unit = reservation.positionU; unit < reservation.positionU + reservation.sizeU; unit += 1) {
        if (unit >= 1 && unit <= layout.heightU) used.add(unit);
      }
    });
    return used.size;
  }, [layout.heightU, reservations]);

  function handleAddReservation() {
    addReservation({
      name,
      positionU,
      sizeU,
      mountSide,
      widthType: layout.rackType,
      purpose
    });
    setPositionU(Math.min(layout.heightU, positionU + sizeU));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-100/78 p-4 dark:border-slate-800 dark:bg-slate-900/78">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          <BookmarkPlus size={15} />
          Reservations
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            {reservations.length ? `${reservations.length} / ${reservedU}U` : 'None'}
          </span>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="space-y-3 overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
              Name
              <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Start U
              <input
                className={FIELD_CLASS}
                type="number"
                min={1}
                max={layout.heightU}
                value={positionU}
                onChange={(event) => setPositionU(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Size U
              <input
                className={FIELD_CLASS}
                type="number"
                min={1}
                max={layout.heightU}
                value={sizeU}
                onChange={(event) => setSizeU(Number(event.target.value))}
              />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Side
              <select className={FIELD_CLASS} value={mountSide} onChange={(event) => setMountSide(event.target.value as ViewSide)}>
                <option value="front">Front</option>
                <option value="rear">Rear</option>
              </select>
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Purpose
              <select className={FIELD_CLASS} value={purpose} onChange={(event) => setPurpose(event.target.value as RackReservationPurpose)}>
                {PURPOSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-cyan-500/35 bg-cyan-500/10 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-500/20 dark:text-cyan-100"
            type="button"
            onClick={handleAddReservation}
          >
            <BookmarkPlus size={14} />
            Reserve space
          </button>

          {reservations.length > 0 && (
            <div className="space-y-2">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-white">{reservation.name}</div>
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                        U{reservation.positionU}
                        {reservation.sizeU > 1 ? `-U${reservation.positionU + reservation.sizeU - 1}` : ''} / {reservation.mountSide} / {reservation.purpose}
                      </div>
                    </div>
                    <button
                      className="rounded border border-red-500/30 p-1 text-red-700 transition hover:bg-red-500/10 dark:text-red-200"
                      type="button"
                      title="Remove reservation"
                      onClick={() => removeReservation(reservation.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-slate-500 dark:text-slate-400">
                      Start U
                      <input
                        className={FIELD_CLASS}
                        type="number"
                        min={1}
                        max={layout.heightU}
                        value={reservation.positionU}
                        onChange={(event) => updateReservation(reservation.id, { positionU: Number(event.target.value) })}
                      />
                    </label>
                    <label className="text-slate-500 dark:text-slate-400">
                      Size U
                      <input
                        className={FIELD_CLASS}
                        type="number"
                        min={1}
                        max={layout.heightU}
                        value={reservation.sizeU}
                        onChange={(event) => updateReservation(reservation.id, { sizeU: Number(event.target.value) })}
                      />
                    </label>
                    <label className="text-slate-500 dark:text-slate-400">
                      Width
                      <select
                        className={FIELD_CLASS}
                        value={reservation.widthType}
                        onChange={(event) => updateReservation(reservation.id, { widthType: event.target.value as WidthType })}
                      >
                        <option value={layout.rackType}>Full rack</option>
                        <option value="shelf">Shelf width</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="text-slate-500 dark:text-slate-400">
                      X mm
                      <input
                        className={FIELD_CLASS}
                        type="number"
                        min={0}
                        max={rackWidthMm}
                        value={Math.round(reservation.xMm ?? 0)}
                        onChange={(event) => updateReservation(reservation.id, { xMm: Number(event.target.value) })}
                      />
                    </label>
                    {reservation.widthType === 'custom' && (
                      <label className="col-span-2 text-slate-500 dark:text-slate-400">
                        Custom width mm
                        <input
                          className={FIELD_CLASS}
                          type="number"
                          min={1}
                          max={rackWidthMm}
                          value={reservation.customWidthMm ?? Math.round(rackWidthMm / 2)}
                          onChange={(event) => updateReservation(reservation.id, { customWidthMm: Number(event.target.value) })}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
