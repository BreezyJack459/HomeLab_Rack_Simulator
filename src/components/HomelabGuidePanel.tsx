import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Download, Lightbulb, RotateCcw, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  exportReportMarkdown,
  generateReport,
  type HomelabAnswers,
  type HomelabGoal,
} from '../utils/homelabGuide';

const GOAL_OPTIONS: { value: HomelabGoal; label: string }[] = [
  { value: 'learn-networking', label: 'Learn networking' },
  { value: 'self-host-apps', label: 'Self-host apps' },
  { value: 'nas-storage', label: 'NAS / Storage' },
  { value: 'media-plex', label: 'Media / Plex' },
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'game-server', label: 'Game server' },
  { value: 'general', label: 'General purpose' },
];

const BUDGET_OPTIONS = [
  { value: 'hobby', label: 'Hobby (< $200)' },
  { value: 'enthusiast', label: 'Enthusiast ($500–1500)' },
  { value: 'serious', label: 'Serious ($2000+)' },
];

const NOISE_OPTIONS = [
  { value: 'silent', label: 'Silent / fanless only' },
  { value: 'low', label: 'Low noise acceptable' },
  { value: 'dont-care', label: "Don't care" },
];

const ROOM_OPTIONS = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'office', label: 'Office' },
  { value: 'closet', label: 'Closet' },
  { value: 'garage', label: 'Garage' },
  { value: 'basement', label: 'Basement' },
];

const EXISTING_OPTIONS = [
  { value: 'old-pc', label: 'Old PC / server' },
  { value: 'pi', label: 'Raspberry Pi / SBC' },
  { value: 'nothing', label: 'Nothing yet' },
];

const GROWTH_OPTIONS = [
  { value: 'incremental', label: 'Start small, grow over time' },
  { value: 'full-build', label: 'Build everything now' },
];

const KNOWLEDGE_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const POWER_OPTIONS = [
  { value: 'limited', label: 'Limited outlets / shared meter' },
  { value: 'ample', label: 'Ample power / dedicated circuit' },
];

interface Question {
  key: keyof HomelabAnswers;
  label: string;
  options: { value: string; label: string }[];
}

const QUESTIONS: Question[] = [
  { key: 'goal', label: 'What is your primary goal?', options: GOAL_OPTIONS },
  { key: 'budget', label: 'What is your budget tier?', options: BUDGET_OPTIONS },
  { key: 'noise', label: 'How much noise can you tolerate?', options: NOISE_OPTIONS },
  { key: 'room', label: 'Where will the rack live?', options: ROOM_OPTIONS },
  { key: 'existing', label: 'Do you have existing hardware to reuse?', options: EXISTING_OPTIONS },
  { key: 'growth', label: 'How do you want to build?', options: GROWTH_OPTIONS },
  { key: 'networkKnowledge', label: 'What is your networking knowledge level?', options: KNOWLEDGE_OPTIONS },
  { key: 'powerConstraint', label: 'Power situation?', options: POWER_OPTIONS },
];

export function HomelabGuidePanel() {
  const [answers, setAnswers] = useState<Partial<HomelabAnswers>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [showReport, setShowReport] = useState(false);

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== undefined);

  const report = useMemo(() => {
    if (!allAnswered) return null;
    return generateReport(answers as HomelabAnswers);
  }, [answers, allAnswered]);

  function selectAnswer(value: string) {
    const q = QUESTIONS[currentQ];
    setAnswers((prev) => ({ ...prev, [q.key]: value }));
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ((i) => i + 1);
    }
  }

  function goBack() {
    if (currentQ > 0) setCurrentQ((i) => i - 1);
  }

  function reset() {
    setAnswers({});
    setCurrentQ(0);
    setShowReport(false);
  }

  const q = QUESTIONS[currentQ];
  const currentValue = answers[q.key];

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
          <BookOpen size={15} />
          Zero-to-Homelab Guide
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em] transition hover:bg-cyan-500/10"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {!showReport && (
        <>
          {/* Progress */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
              Question {currentQ + 1} of {QUESTIONS.length}
            </span>
            <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: 'var(--theme-bg-primary)' }}>
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                {q.label}
              </span>
              {currentQ > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 text-[11px] transition hover:opacity-70"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <ChevronLeft size={13} />
                  Back
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {q.options.map((opt) => {
                const selected = currentValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectAnswer(opt.value)}
                    className="w-full rounded border px-3 py-2 text-left text-sm transition"
                    style={{
                      borderColor: selected ? '#0891b2' : 'var(--theme-border)',
                      backgroundColor: selected ? 'rgba(8,145,178,0.08)' : 'var(--theme-bg-primary)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt.label}</span>
                      {selected && <ArrowRight size={14} className="text-cyan-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {allAnswered && (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="inline-flex w-full items-center justify-center gap-1 rounded bg-cyan-600 py-2 text-[12px] font-medium text-white transition hover:bg-cyan-700"
            >
              <Lightbulb size={14} />
              Generate My Guide
            </button>
          )}
        </>
      )}

      {showReport && report && (
        <div className="space-y-4">
          {/* Summary */}
          <div
            className="rounded-md border p-3 text-sm"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className="mb-1 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
              Recommended Rack
            </div>
            <div style={{ color: 'var(--theme-text-secondary)' }}>
              {report.rackType} {report.rackSizeU}U · {report.rackDepthMm}mm deep
            </div>
            <div className="mt-2 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
              {report.summary}
            </div>
          </div>

          {/* Warnings */}
          {report.warnings.length > 0 && (
            <div className="space-y-1.5">
              {report.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border p-2 text-xs"
                  style={{
                    borderColor: 'rgba(234,179,8,0.4)',
                    backgroundColor: 'rgba(234,179,8,0.08)',
                  }}
                >
                  <Lightbulb size={13} className="mt-0.5 shrink-0 text-yellow-500" />
                  <span style={{ color: 'var(--theme-text-secondary)' }}>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Starter devices */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              Starter Devices
            </div>
            <div className="space-y-2">
              {report.starterDevices.map((d, i) => (
                <div
                  key={i}
                  className="rounded-md border p-2.5 text-sm"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                      {d.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                      ~${d.estimatedCostUsd}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                    {d.reason}
                  </div>
                  <div className="mt-1 flex gap-2 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5">{d.category}</span>
                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5">Buy {d.newOrUsed}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Growth phases */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              Growth Phases
            </div>
            <div className="space-y-2">
              {report.growthPhases.map((p) => (
                <div
                  key={p.phase}
                  className="rounded-md border p-2.5 text-sm"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: '#0891b2' }}
                    >
                      {p.phase}
                    </span>
                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                      {p.name}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                    {p.devices.join(' → ')}
                  </div>
                  <div className="mt-1 text-[10px] italic" style={{ color: 'var(--theme-text-muted)' }}>
                    Stop: {p.stopAndEnjoy}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample layout hint */}
          <div
            className="rounded-md border p-2.5 text-xs"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-primary)' }}
          >
            <div className="flex items-center gap-2">
              <Wrench size={13} style={{ color: 'var(--theme-text-muted)' }} />
              <span style={{ color: 'var(--theme-text-secondary)' }}>
                Suggested starter layout: <strong style={{ color: 'var(--theme-text-primary)' }}>{report.sampleLayoutName}</strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const md = exportReportMarkdown(answers as HomelabAnswers, report);
                const blob = new Blob([md], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'homelab-guide.md';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <Download size={12} />
              Export MD
            </button>
            <button
              type="button"
              onClick={() => setShowReport(false)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border py-1.5 text-[11px] font-medium transition hover:bg-cyan-500/10"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
            >
              <ChevronLeft size={12} />
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
