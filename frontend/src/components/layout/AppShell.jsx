import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/auth.store';
import { tallyApi } from '../../api/tally.api';
import {
  LayoutDashboard,
  BookOpen,
  FolderTree,
  Receipt,
  PackagePlus,
  Wallet,
  PiggyBank,
  BarChart3,
  Settings,
  LogOut,
  User,
  Building2,
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

  const { data: stats } = useQuery({ queryKey: ['system-stats'], queryFn: tallyApi.utilities.stats });
  const activeFyName = stats?.data?.activeFinancialYear?.name;

  const navigation = [
    { name: 'Gateway of Tally', href: '/', icon: LayoutDashboard },
    { name: 'Chart of Accounts', href: '/accounts', icon: FolderTree },
    { name: 'Masters Management', href: '/masters', icon: BookOpen },
    { name: 'Sales & GST Bills', href: '/sales', icon: FileText },
    { name: 'Purchases (Stock IN)', href: '/purchases', icon: PackagePlus },
    { name: 'Payments & Receipts', href: '/payments', icon: Wallet },
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

  const initials = (user?.name || 'A')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const NavLinks = ({ onNavigate }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'text-amber-400 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="nav-active-bar"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-amber-400 shadow-[0_0_10px_rgba(242,181,68,0.7)]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-gray-200'} transition-colors`} />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#05060b]">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-68 md:flex-col fixed inset-y-0 left-0 bg-[#0a0d17]/95 backdrop-blur-xl border-r border-white/[0.06] z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/[0.06]">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-b from-amber-400/25 to-amber-500/5 flex items-center justify-center border border-amber-500/25">
            <Building2 className="h-4 w-4 text-amber-400" />
          </div>
          <span className="font-bold text-[15px] text-white tracking-tight font-display">Tally Gateway</span>
        </div>
        <nav className="flex-1 px-3.5 py-6 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-3.5 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-rose-400/90 hover:bg-rose-500/[0.07] hover:text-rose-300 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout System
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative flex flex-col w-64 bg-[#0a0d17] h-full z-50 border-r border-white/[0.06]"
            >
              <div className="flex items-center justify-between px-6 h-16 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-5 w-5 text-amber-400" />
                  <span className="font-bold text-white font-display">Tally Gateway</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="p-3.5 border-t border-white/[0.06]">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-400/90 hover:bg-rose-500/[0.07] rounded-xl cursor-pointer"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                  Logout System
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-68 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#0a0d17]/70 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-gray-400 hover:text-white cursor-pointer">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-gray-200 leading-tight">
                {user?.company?.name || 'Tally Enterprise'}
              </h1>
              <p className="text-[11px] text-gray-500">Active Database Server</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/[0.08] border border-amber-500/15 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-xs font-semibold text-amber-400/90 tracking-wide">{activeFyName || 'No Active FY'}</span>
            </div>
            <div className="flex items-center gap-2.5 pl-4 border-l border-white/[0.06]">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400/30 to-indigo-500/20 flex items-center justify-center border border-white/10 text-[11px] font-bold text-amber-300">
                {initials || <User className="h-4 w-4 text-amber-400" />}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-white leading-tight">{user?.name || 'Administrator'}</p>
                <p className="text-[10px] text-gray-500 capitalize">{user?.role || 'CEO'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic View container */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
