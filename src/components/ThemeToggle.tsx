import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <button
      className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm hover:opacity-80"
      style={{
        backgroundColor: 'var(--theme-bg-input)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-secondary)'
      }}
      onClick={toggleTheme}
      type="button"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
