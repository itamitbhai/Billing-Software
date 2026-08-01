import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard,
  BookOpen,
  FolderTree,
  Receipt,
  PiggyBank,
  BarChart3,
  Settings,
  LogOut,
  User,
  Building,
  Menu,
  X,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

export default function AppShell({ children }) {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: 'Gateway of Tally', href: '/', icon: LayoutDashboard },
    { name: 'Chart of Accounts', href: '/accounts', icon: FolderTree },
    { name: 'Masters Management', href: '/masters', icon: BookOpen },
    { name: 'Sales & GST Bills', href: '/sales', icon: FileText },
    { name: 'Vouchers (Entries)', href: '/vouchers', icon: Receipt },
    { name: 'Banking Portal', href: '/banking', icon: PiggyBank },
    { name: 'Display Reports', href: '/reports', icon: BarChart3 },
    { name: 'System Utilities', href: '/utilities', icon: Settings },
  ];

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#0a0e1a]">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-68 md:flex-col fixed inset-y-0 left-0 bg-[#111827] border-r border-[#1f2937] z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-[#1f2937]">
          <Building className="h-6 w-6 text-amber-500" />
          <span className="font-bold text-lg text-white tracking-wide">Tally Gateway</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                    : 'text-gray-400 hover:bg-[#1f2937] hover:text-white border border-transparent'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-amber-500' : 'text-gray-400 group-hover:text-white'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#1f2937]">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/5 hover:text-red-300 rounded-lg transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Logout System
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-[#111827] h-full z-50">
            <div className="flex items-center justify-between px-6 h-16 border-b border-[#1f2937]">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-amber-500" />
                <span className="font-bold text-white">Tally Gateway</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                      isActive 
                        ? 'bg-amber-500/10 text-amber-500' 
                        : 'text-gray-400 hover:bg-[#1f2937]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#1f2937]">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/5 rounded-lg"
              >
                <LogOut className="h-5 w-5" />
                Logout System
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-68 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#111827]/80 backdrop-blur-md border-b border-[#1f2937] sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-gray-400 hover:text-white">
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-gray-300">
                {user?.company?.name || 'Tally Enterprise'}
              </h1>
              <p className="text-xs text-gray-500">Active Database Server</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-amber-500 tracking-wider">FY 2025-26</span>
            </div>
            <div className="flex items-center gap-2.5 pl-4 border-l border-[#1f2937]">
              <div className="h-8 w-8 rounded-full bg-[#1f2937] flex items-center justify-content justify-center border border-gray-700">
                <User className="h-4 w-4 text-amber-500" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-white">{user?.name || 'Administrator'}</p>
                <p className="text-[10px] text-gray-500 capitalize">{user?.role || 'CEO'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic View container */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
