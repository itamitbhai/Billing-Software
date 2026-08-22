import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { tallyApi } from '../api/tally.api';
import {
  Users,
  Receipt,
  Package,
  Calendar,
  ArrowUpRight,
  FolderOpen,
  Wifi,
  Database
} from 'lucide-react';
import { formatRupees } from '../utils/format';
import { Card, CardHeader } from '../components/ui/Card';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function StatCard({ label, value, icon: Icon, tint }) {
  return (
    <motion.div variants={item}>
      <Card hover className="p-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-bold text-white mt-1.5 font-display">{value}</h3>
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
      </Card>
    </motion.div>
  );
}

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
        { name: 'Sales & GST Bills', desc: 'Bill customers and print GST invoices', href: '/sales' },
        { name: 'Purchases (Stock IN)', desc: 'Record supplier bills and receive stock', href: '/purchases' },
        { name: 'Payments & Receipts', desc: 'Pay suppliers or receive from customers', href: '/payments' },
        { name: 'Vouchers Entry', desc: 'Journal, Contra, Credit/Debit Note entries', href: '/vouchers' },
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
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">Gateway of Tally</h2>
          <p className="text-gray-500 text-sm mt-1">Main controller dashboard for enterprise business activities</p>
        </div>
      </div>

      {/* Grid Stats */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Vouchers"
          value={isLoading ? '···' : stats?.data?.voucherCount || 0}
          icon={Receipt}
          tint="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
        />
        <StatCard
          label="Registered Parties"
          value={isLoading ? '···' : stats?.data?.partyCount || 0}
          icon={Users}
          tint="bg-amber-500/10 border-amber-500/20 text-amber-400"
        />
        <StatCard
          label="Stock Items"
          value={isLoading ? '···' : stats?.data?.stockItemCount || 0}
          icon={Package}
          tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        />
        <motion.div variants={item}>
          <Card hover className="p-5 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Financial Year</p>
              <h3 className="text-lg font-bold text-amber-400 mt-1.5 truncate font-display">
                {isLoading ? '···' : stats?.data?.activeFinancialYear?.name || 'Not Configured'}
              </h3>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Gateway layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation lists (left & middle) */}
        <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-2 space-y-6">
          {menuSections.map((sec) => (
            <motion.div key={sec.title} variants={item}>
              <Card className="overflow-hidden">
                <CardHeader className="bg-white/[0.015]">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">{sec.title}</h4>
                </CardHeader>
                <div className="divide-y divide-white/[0.05]">
                  {sec.items.map((it) => (
                    <Link
                      key={it.name}
                      to={it.href}
                      className="flex items-center justify-between p-5 hover:bg-white/[0.025] transition-colors duration-150 group"
                    >
                      <div>
                        <h5 className="font-semibold text-white group-hover:text-amber-400 transition-colors duration-150 text-sm">
                          {it.name}
                        </h5>
                        <p className="text-xs text-gray-500 mt-1">{it.desc}</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0 ml-3" />
                    </Link>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Company Quick Summary Board (right) */}
        <div className="space-y-6">
          <Card className="p-6 space-y-5">
            <h4 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 font-display">Latest Activity</h4>

            {stats?.data?.lastSale ? (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Last GST Sale Invoice</p>
                  <p className="text-sm font-semibold text-white mt-0.5 truncate">{stats.data.lastSale.invoiceNumber}</p>
                  <p className="text-[11px] text-amber-400/80 font-mono mt-0.5 truncate">{stats.data.lastSale.customer?.name} · {formatRupees(Number(stats.data.lastSale.totalAmount) * 100)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-500 flex flex-col items-center gap-2">
                <FolderOpen className="h-6 w-6 text-gray-700" />
                No sale invoices created yet
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h4 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 font-display">System Health</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-2"><Wifi className="h-3.5 w-3.5" /> API Status</span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Isolated DB schema</span>
                <span className="font-semibold text-gray-200">Active</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
