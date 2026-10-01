import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './header';
import { LayoutDashboard, MessageSquare, Mic, Monitor, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { path: '/', label: 'Home', icon: LayoutDashboard },
    { path: '/chat', label: 'Chat', icon: MessageSquare },
    { path: '/voice', label: 'Voice', icon: Mic },
    { path: '/system', label: 'System', icon: Monitor },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-screen w-screen flex bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        navigation={navigation}
        location={location}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}