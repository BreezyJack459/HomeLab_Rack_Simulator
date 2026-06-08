import type { RackLayout } from '../types/rack';

const FOLDER_PERMISSION = 'readwrite' as const;
const LAYOUT_EXTENSION = '.json';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function requestFolderAccess(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. Use Chrome, Edge, or another Chromium-based browser.');
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: FOLDER_PERMISSION });
    // Verify we actually have write permission
    if ((await handle.queryPermission({ mode: FOLDER_PERMISSION })) !== 'granted') {
      const permission = await handle.requestPermission({ mode: FOLDER_PERMISSION });
      if (permission !== 'granted') {
        throw new Error('Permission to access the folder was denied.');
      }
    }
    return handle;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if ((await handle.queryPermission({ mode: FOLDER_PERMISSION })) === 'granted') {
    return true;
  }
  const permission = await handle.requestPermission({ mode: FOLDER_PERMISSION });
  return permission === 'granted';
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rack-layout';
}

function isFileHandle(handle: FileSystemHandle): handle is FileSystemFileHandle {
  return handle.kind === 'file';
}

export async function saveLayoutToFolder(
  handle: FileSystemDirectoryHandle,
  layout: RackLayout
): Promise<string> {
  const filename = `${sanitizeFilename(layout.name)}${LAYOUT_EXTENSION}`;
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  const content = JSON.stringify(layout, null, 2);
  await writable.write(content);
  await writable.close();
  return filename;
}

export async function loadLayoutsFromFolder(
  handle: FileSystemDirectoryHandle
): Promise<Array<{ name: string; layout: RackLayout }>> {
  const results: Array<{ name: string; layout: RackLayout }> = [];
  for await (const entry of handle.values()) {
    if (isFileHandle(entry) && entry.name.endsWith(LAYOUT_EXTENSION)) {
      try {
        const file = await entry.getFile();
        const text = await file.text();
        const layout = JSON.parse(text) as RackLayout;
        results.push({ name: entry.name, layout });
      } catch {
        // Skip files that aren't valid JSON layouts
      }
    }
  }
  return results;
}

export async function importLayoutFromFilePicker(): Promise<RackLayout | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON Layout Files',
          accept: { 'application/json': ['.json'] }
        }
      ]
    });
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as RackLayout;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}
