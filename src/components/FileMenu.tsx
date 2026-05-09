import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FileText,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import type { RackLayout } from '../types/rack';

interface FileMenuProps {
  layout: RackLayout;
  onNew: () => void;
  onDuplicate: () => void;
  onSaveLocal: () => void;
  onLoadLocal: () => void;
  onImportFile: (file: File) => void;
  onExportJson: (layout: RackLayout) => void;
  onExportPng: (layout: RackLayout) => void;
}

export function FileMenu({
  layout,
  onNew,
  onDuplicate,
  onSaveLocal,
  onLoadLocal,
  onImportFile,
  onExportJson,
  onExportPng,
}: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      onImportFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const items = [
    { icon: RotateCcw, label: 'New', action: onNew },
    { icon: Copy, label: 'Duplicate', action: onDuplicate },
    { icon: Save, label: 'Save local', action: onSaveLocal },
    { icon: Upload, label: 'Load local', action: onLoadLocal },
    null, // separator
    { icon: FileJson, label: 'Export JSON', action: () => onExportJson(layout) },
    { icon: Upload, label: 'Import JSON', action: () => fileInputRef.current?.click() },
    { icon: Download, label: 'Export PNG', action: () => onExportPng(layout) },
  ] as const;

  return (
    <div ref={menuRef} className="relative">
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 hover:opacity-80"
        style={{
          backgroundColor: 'var(--theme-bg-input)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <FileText size={15} />
        File
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border shadow-lg"
          style={{
            backgroundColor: 'var(--theme-bg-secondary)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {items.map((item, index) => {
            if (item === null) {
              return (
                <div
                  key={`sep-${index}`}
                  className="my-1 h-px"
                  style={{ backgroundColor: 'var(--theme-border)' }}
                />
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:opacity-80"
                style={{ color: 'var(--theme-text-secondary)' }}
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
                type="button"
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
      />
    </div>
  );
}
