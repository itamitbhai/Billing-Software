import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../api/tally.api';
import { 
  Building, 
  Users, 
  Receipt, 
  Package, 
  Calendar,
  ArrowUpRight,
  TrendingUp,
  FolderOpen
} from 'lucide-react';
import { formatRupees } from '../utils/format';

export default function GatewayPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: tallyApi.utilities.stats
  });

  const menuSections = [
    {
      title: 'Masters (Create/Alter)',
      items: [
        { name: 'Chart of Accounts', desc: 'Manage ledger groups and accounts hierarchy', href: '/accounts' },
        { name: 'Masters Inventory & Contacts', desc: 'Parties, Stock items, Units, Cost Centres', href: '/masters' }
      ]
    },
    {
      title: 'Transactions & Vouchers',
      items: [
        { name: 'Vouchers Entry', desc: 'Create Sales, Purchase, Payment, Journal entries', href: '/vouchers' },
        { name: 'Banking Portal', desc: 'Cheques register, statements and reconciliation', href: '/banking' }
      ]
    },
    {
      title: 'Display Reports',
      items: [
        { name: 'Balance Sheet', desc: 'Asset and liability statement with charts', href: '/reports/balance-sheet' },
        { name: 'Profit & Loss A/c', desc: 'Trading and income summary with charts', href: '/reports/profit-loss' },
        { name: 'Stock Summary', desc: 'Realtime inventory valuation summary', href: '/reports/stock-summary' },
        { name: 'More Reports', desc: 'Day Book, Outstanding, Trial Balance, Cash Flow', href: '/reports' },
        { name: 'GST Reports', desc: 'GST payable summary, GSTR-1 and GSTR-3B breakup', href: '/reports/gst' }
      ]
    },
    {
      title: 'Utilities & Configuration',
      items: [
        { name: 'System Utilities', desc: 'Audit trails, financial year setup, data backup', href: '/utilities' }
      ]
    }
  ];

  return (
    <div className="space-y-8">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Gateway of Tally</h2>
          <p className="text-gray-400 text-sm mt-1">Main controller dashboard for enterprise business activities</p>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Vouchers</p>
            <h3 className="text-2xl font-bold text-white mt-1.5">{isLoading ? '...' : stats?.data?.voucherCount || 0}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <Receipt className="h-5 w-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Registered Parties</p>
            <h3 className="text-2xl font-bold text-white mt-1.5">{isLoading ? '...' : stats?.data?.partyCount || 0}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock Items</p>
            <h3 className="text-2xl font-bold text-white mt-1.5">{isLoading ? '...' : stats?.data?.stockItemCount || 0}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="glass p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Financial Year</p>
            <h3 className="text-lg font-bold text-amber-500 mt-2 truncate">
              {isLoading ? '...' : stats?.data?.activeFinancialYear?.name || 'Not Configured'}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Gateway layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation lists (left & middle) */}
        <div className="lg:col-span-2 space-y-6">
          {menuSections.map((sec) => (
            <div key={sec.title} className="glass rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-3.5 bg-[#111827]/40 border-b border-gray-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">{sec.title}</h4>
              </div>
              <div className="divide-y divide-gray-800/40">
                {sec.items.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center justify-between p-5 hover:bg-[#111827]/30 transition-all duration-150 group"
                  >
                    <div>
                      <h5 className="font-semibold text-white group-hover:text-amber-500 transition-colors duration-150 text-sm">
                        {item.name}
                      </h5>
                      <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                    </div>
                    <ArrowUpRight className="h-4.5 w-4.5 text-gray-500 group-hover:text-amber-500 transition-colors duration-150" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Company Quick Summary Board (right) */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-xl border border-gray-800 space-y-5">
            <h4 className="text-sm font-bold text-white border-b border-gray-800 pb-3">Latest Activity</h4>
            
            {stats?.data?.lastSale ? (
              <div className="space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shrink-0">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Last GST Sale Invoice</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{stats.data.lastSale.invoiceNumber}</p>
                    <p className="text-[10px] text-amber-500/80 font-mono mt-0.5">{stats.data.lastSale.customer?.name} · {formatRupees(Number(stats.data.lastSale.totalAmount) * 100)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">
                No sale invoices created yet
              </div>
            )}
          </div>

          <div className="glass p-6 rounded-xl border border-gray-800 space-y-4">
            <h4 className="text-sm font-bold text-white border-b border-gray-800 pb-3">System Health</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">API Status</span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Isolated DB schema</span>
                <span className="font-semibold text-white">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
