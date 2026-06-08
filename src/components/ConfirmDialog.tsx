interface ConfirmDialogProps {
  type: 'new' | 'sample' | 'import' | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ type, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!type) return null;

  const titles: Record<string, string> = {
    new: 'Start a new layout?',
    sample: 'Load sample layout?',
    import: 'Import layout file?',
  };

  const messages: Record<string, string> = {
    new: 'This will clear all devices and cables.',
    sample: 'This will replace your current rack with the selected sample.',
    import: 'This will replace your current rack with the imported layout.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-80 rounded-lg border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--theme-bg-secondary)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
          {titles[type] ?? 'Confirm action'}
        </div>
        <div className="mb-4 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          {messages[type] ?? 'This action cannot be undone.'}
        </div>
        <div className="flex gap-2">
          <button
            className="h-9 flex-1 rounded-md border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-100 hover:bg-red-500/20"
            onClick={onConfirm}
            type="button"
          >
            Confirm
          </button>
          <button
            className="h-9 flex-1 rounded-md border text-sm hover:opacity-80"
            style={{
              backgroundColor: 'var(--theme-bg-input)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
