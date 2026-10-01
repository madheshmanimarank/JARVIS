import { Sun, Moon, Monitor, Minimize, Maximize, X, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSettings, useWindowControls } from '../hooks/useElectron';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { settings, updateSettings } = useSettings();
  const { minimize, maximize, close } = useWindowControls();
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');

  useEffect(() => {
    if (settings) {
      setTheme(settings.ui.theme);
    }
  }, [settings]);

  const toggleTheme = () => {
    const themes: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
    updateSettings({ ui: { ...settings!.ui, theme: nextTheme } });
    document.documentElement.classList.remove('dark', 'light');
    if (nextTheme === 'dark' || (nextTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  };

  return (
    <header className="h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">J.A.R.V.I.S.</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'light' ? <Sun className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>
        <button onClick={minimize} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors" aria-label="Minimize">
          <Minimize className="w-5 h-5" />
        </button>
        <button onClick={maximize} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors" aria-label="Maximize">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={close} className="p-2 rounded-lg hover:bg-red-900/50 text-slate-300 hover:text-red-400 transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}