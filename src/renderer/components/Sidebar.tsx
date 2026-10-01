import { NavLink, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  open: boolean;
  navigation: NavItem[];
  location: ReturnType<typeof useLocation>;
}

export function Sidebar({ open, navigation, location }: SidebarProps) {
  if (!open) {
    return (
      <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col h-full transition-all duration-300">
        <div className="p-4 border-b border-slate-800">
          <div className="w-8 h-8 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">J</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full transition-all duration-300">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <div>
            <h1 className="font-semibold text-white">J.A.R.V.I.S.</h1>
            <p className="text-xs text-slate-400">v1.0.0</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs text-slate-300">Local Mode</span>
        </div>
      </div>
    </div>
  );
}