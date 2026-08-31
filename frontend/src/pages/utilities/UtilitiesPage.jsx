import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Loader2, Plus, Settings, Building, Users, Mail, Shield, ShieldCheck, Lock, UserPlus, ScrollText, ChevronLeft, ChevronRight, FileText, Eye, Printer, X, ExternalLink } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/format';
import { toast } from 'sonner';

const INVOICE_STATUS_STYLES = {
  PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PARTIALLY_PAID: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  UNPAID: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function UtilitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('company');

  // Modal & Form States for User Management
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });

  // Audit Log pagination
  const [auditPage, setAuditPage] = useState(1);

  // Audit Log — clicked entry detail (what exactly was created/edited)
  const [auditDetail, setAuditDetail] = useState(null); // { log, loading, error, data }

  // Sale Invoices pagination
  const [invoicePage, setInvoicePage] = useState(1);

  // ── Queries ───────────────────────────────────────────────────
  const { data: companyRes, isLoading: companyLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: tallyApi.utilities.company.get
  });

  const { data: usersRes, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['system-users'],
    queryFn: authApi.listUsers,
    enabled: activeTab === 'users' && isAdmin
  });

  const { data: auditRes, isLoading: auditLoading, error: auditError } = useQuery({
    queryKey: ['audit-logs', auditPage],
    queryFn: () => tallyApi.utilities.auditLogs({ page: auditPage, limit: 25 }),
    enabled: activeTab === 'audit' && isAdmin
  });

  const { data: invoicesRes, isLoading: invoicesLoading, error: invoicesError } = useQuery({
    queryKey: ['sales', invoicePage],
    queryFn: () => tallyApi.billing.sales.list({ page: invoicePage, limit: 15 }),
    enabled: activeTab === 'invoices' && isAdmin
  });

  const company = companyRes?.data || { companyName: '', email: '', phone: '', address: '', gstin: '', state: '' };
  const usersList = usersRes?.data || [];
  const auditLogs = auditRes?.data || [];
  const auditTotalPages = auditRes?.totalPages || 1;
  const invoicesList = invoicesRes?.data || [];
  const invoiceTotalPages = invoicesRes?.totalPages || 1;

  // Company Profile Update State
  const [companyForm, setCompanyForm] = useState({
    companyName: '', email: '', phone: '', address: '', gstin: '', state: '',
    dlNumber: '', bankName: '', accountNo: '', ifscCode: ''
  });

  React.useEffect(() => {
    if (companyRes?.data) {
      setCompanyForm({
        companyName: companyRes.data.companyName || companyRes.data.name || '',
        email: companyRes.data.email || '',
        phone: companyRes.data.phone || '',
        address: companyRes.data.address || '',
        gstin: companyRes.data.gstin || '',
        state: companyRes.data.state || '',
        dlNumber: companyRes.data.dlNumber || '',
        bankName: companyRes.data.bankName || '',
        accountNo: companyRes.data.accountNo || '',
        ifscCode: companyRes.data.ifscCode || ''
      });
    }
  }, [companyRes]);

  // ── Mutations ─────────────────────────────────────────────────
  const updateCompanyMut = useMutation({
    mutationFn: tallyApi.utilities.company.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      toast.success('Company settings updated successfully!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating settings')
  });

  const registerUserMut = useMutation({
    mutationFn: authApi.registerEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('User added successfully!');
      setUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'STAFF' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add user')
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateCompanyMut.mutate(companyForm);
  };

  const handleUserSubmit = (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password) {
      return toast.error('All fields are required');
    }
    if (userForm.password.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    registerUserMut.mutate(userForm);
  };

  // Clicking an audit log row opens the actual record that was created/edited/deleted,
  // so the admin can see exactly what the user did — not just the raw log line.
  const handleOpenAuditEntity = async (log) => {
    if (!log.entityId) return;

    if (log.entityType === 'Sale') {
      window.open(`/sales/${log.entityId}/invoice`, '_blank');
      return;
    }

    setAuditDetail({ log, loading: true, error: null, data: null });
    try {
      let data = null;
      if (log.entityType === 'Purchase') data = (await tallyApi.billing.purchases.get(log.entityId)).data;
      else if (log.entityType === 'Payment') data = (await tallyApi.billing.payments.get(log.entityId)).data;
      else if (log.entityType === 'Voucher') data = (await tallyApi.vouchers.get(log.entityId)).data;
      else if (log.entityType === 'Party') data = (await tallyApi.parties.get(log.entityId)).data;
      setAuditDetail({ log, loading: false, error: null, data });
    } catch (err) {
      setAuditDetail({
        log,
        loading: false,
        error: err.response?.data?.message || 'This record could not be loaded — it may have been deleted since this action.',
        data: null,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">System Utilities & Setup</h2>
        <p className="text-gray-400 text-xs mt-1">Configure company profiles, view audit logs, and manage staff credentials</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { id: 'company', name: 'Company Profile', icon: Building, show: true },
          { id: 'users', name: 'User Management', icon: Users, show: isAdmin },
          { id: 'invoices', name: 'Sale Invoices', icon: FileText, show: isAdmin },
          { id: 'audit', name: 'Audit Log', icon: ScrollText, show: isAdmin }
        ].filter(t => t.show).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border-b-2 ${
                activeTab === t.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Views */}
      <div className="glass rounded-xl border border-gray-800 p-6">
        {activeTab === 'company' && (
          <div>
            {companyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Registered Company Name</label>
                  <input type="text" required value={companyForm.companyName} onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-medium" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GSTIN Number</label>
                    <input type="text" required value={companyForm.gstin} onChange={e => setCompanyForm({ ...companyForm, gstin: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">State (GST Region)</label>
                    <input type="text" required value={companyForm.state} onChange={e => setCompanyForm({ ...companyForm, state: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Official Email</label>
                    <input type="email" value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Contact Number</label>
                    <input type="text" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Address Location</label>
                  <textarea rows={3} value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Drug License No. (DL No.)</label>
                  <input type="text" value={companyForm.dlNumber} onChange={e => setCompanyForm({ ...companyForm, dlNumber: e.target.value })} placeholder="JH-RN7-153721/153722" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">Bank Details (printed on GST invoices)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Bank Name &amp; Branch</label>
                      <input type="text" value={companyForm.bankName} onChange={e => setCompanyForm({ ...companyForm, bankName: e.target.value })} placeholder="IOB CC A/C, Bariatu Branch" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Account Number</label>
                      <input type="text" value={companyForm.accountNo} onChange={e => setCompanyForm({ ...companyForm, accountNo: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">IFSC Code</label>
                    <input type="text" value={companyForm.ifscCode} onChange={e => setCompanyForm({ ...companyForm, ifscCode: e.target.value })} className="w-full md:w-1/2 bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                  </div>
                </div>

                <button type="submit" disabled={updateCompanyMut.isPending} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold px-4 py-2.5 rounded-lg text-xs transition cursor-pointer disabled:opacity-50">
                  {updateCompanyMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-white">System Users & Access Control</h4>
                <p className="text-xs text-gray-500 mt-1">Manage logins, passwords, and permissions for accountants and staff</p>
              </div>
              <button 
                onClick={() => setUserModal(true)} 
                className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded border border-amber-500/20 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Accountant / Staff
              </button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : usersError ? (
              <div className="text-center py-12 text-rose-500 text-sm">Failed to load system users. Please try again.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Name</div>
                  <div>Email Address</div>
                  <div>Role Level</div>
                  <div className="text-right">Status</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {usersList.map(u => (
                    <div key={u.id} className="grid grid-cols-4 py-3.5 items-center text-sm">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                      <div className="text-gray-400 font-mono text-xs">{u.email}</div>
                      <div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          u.role === 'ADMIN' 
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                            : u.role === 'ACCOUNTANT'
                            ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                            : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          u.isActive 
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        }`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white">Sale Invoices</h4>
              <p className="text-xs text-gray-500 mt-1">Every GST invoice ever raised in the system, newest first</p>
            </div>

            {invoicesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : invoicesError ? (
              <div className="text-center py-12 text-rose-500 text-sm">Failed to load sale invoices. Please try again.</div>
            ) : invoicesList.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">No sale invoices raised yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 font-bold uppercase border-b border-gray-800">
                        <th className="pb-3">Invoice No.</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Customer</th>
                        <th className="pb-3 text-right">Total</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-sm">
                      {invoicesList.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#111827]/20">
                          <td className="py-3 font-semibold text-white font-mono">{inv.invoiceNumber}</td>
                          <td className="py-3 text-gray-400">{formatDate(inv.saleDate)}</td>
                          <td className="py-3 text-gray-300 font-medium">{inv.customer?.name || '-'}</td>
                          <td className="py-3 text-right font-mono font-semibold text-white">₹{formatCurrency(inv.totalAmount)}</td>
                          <td className="py-3">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${INVOICE_STATUS_STYLES[inv.status] || INVOICE_STATUS_STYLES.UNPAID}`}>
                              {inv.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-3 text-gray-400">
                              <button
                                onClick={() => navigate(`/sales/${inv.id}/invoice`)}
                                title="View Invoice"
                                className="hover:text-sky-400 transition cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => window.open(`/sales/${inv.id}/invoice`, '_blank')}
                                title="Print GST Invoice"
                                className="hover:text-amber-500 transition cursor-pointer"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invoiceTotalPages > 1 && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                      disabled={invoicePage <= 1}
                      className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-400">Page {invoicePage} of {invoiceTotalPages}</span>
                    <button
                      onClick={() => setInvoicePage(p => Math.min(invoiceTotalPages, p + 1))}
                      disabled={invoicePage >= invoiceTotalPages}
                      className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white">Security Audit Trail</h4>
              <p className="text-xs text-gray-500 mt-1">Every create, update, delete, and login event recorded across the system</p>
            </div>

            {auditLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : auditError ? (
              <div className="text-center py-12 text-rose-500 text-sm">Failed to load audit log. Please try again.</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">No audit events recorded yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-800">
                        <th className="text-left pb-3 pr-4">Timestamp</th>
                        <th className="text-left pb-3 pr-4">User</th>
                        <th className="text-left pb-3 pr-4">Action</th>
                        <th className="text-left pb-3 pr-4">Entity</th>
                        <th className="text-left pb-3">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {auditLogs.map(log => (
                        <tr
                          key={log.id}
                          onClick={() => handleOpenAuditEntity(log)}
                          title={log.entityId ? 'Click to view what was created/edited' : undefined}
                          className={`text-xs ${log.entityId ? 'cursor-pointer hover:bg-[#111827]/40' : ''}`}
                        >
                          <td className="py-3 pr-4 text-gray-400 font-mono whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">
                            {log.user ? `${log.user.name} (${log.user.role})` : 'System'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center font-bold px-2 py-0.5 rounded border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 font-mono">
                            <span className={log.entityId ? 'inline-flex items-center gap-1 text-amber-500 hover:underline' : ''}>
                              {log.entityType || '-'}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                              {log.entityId && <Eye className="h-3 w-3" />}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500 font-mono">{log.ipAddress || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      disabled={auditPage <= 1}
                      className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-400">Page {auditPage} of {auditTotalPages}</span>
                    <button
                      onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                      disabled={auditPage >= auditTotalPages}
                      className="p-1.5 rounded border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {userModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" /> Register Team Member
            </h3>
            
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">User Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={userForm.name} 
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })} 
                  placeholder="E.g., Rahul Sharma" 
                  className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input 
                    type="email" 
                    required 
                    value={userForm.email} 
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })} 
                    placeholder="E.g., rahul@vsarogya.com" 
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 pl-10 text-white placeholder-gray-600 outline-none text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Login Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input 
                    type="password" 
                    required 
                    value={userForm.password} 
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })} 
                    placeholder="At least 6 characters" 
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 pl-10 text-white placeholder-gray-600 outline-none text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Access Role Level</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                    <Shield className="h-4 w-4" />
                  </span>
                  <select 
                    value={userForm.role} 
                    onChange={e => setUserForm({ ...userForm, role: e.target.value })} 
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 pl-10 text-white outline-none text-sm font-semibold"
                  >
                    <option value="STAFF">STAFF (Billing Clerk)</option>
                    <option value="ACCOUNTANT">ACCOUNTANT (Data Entry & Vouchers)</option>
                    <option value="ADMIN">ADMIN (Full System Control)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button 
                  type="button" 
                  onClick={() => setUserModal(false)} 
                  className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={registerUserMut.isPending} 
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {registerUserMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Audit Entity Detail Modal (click-through from Audit Log) ── */}
      {auditDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setAuditDetail(null)}
        >
          <div
            className="glass max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 rounded-xl border border-gray-800 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">{auditDetail.log.action.replace(/_/g, ' ')}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {auditDetail.log.user ? `${auditDetail.log.user.name} (${auditDetail.log.user.role})` : 'System'}
                  {' · '}{new Date(auditDetail.log.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <button onClick={() => setAuditDetail(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {auditDetail.loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : auditDetail.error ? (
              <div className="text-center py-6 text-rose-500 text-sm">{auditDetail.error}</div>
            ) : !auditDetail.data ? (
              <div className="text-center py-6 text-gray-500 text-sm">No detail view available for "{auditDetail.log.entityType}" records.</div>
            ) : (
              <div className="space-y-4 text-xs">
                {auditDetail.log.entityType === 'Purchase' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-gray-500">Bill No.</p><p className="font-semibold text-white font-mono mt-0.5">{auditDetail.data.billNumber}</p></div>
                      <div><p className="text-gray-500">Date</p><p className="font-semibold text-white mt-0.5">{formatDate(auditDetail.data.purchaseDate)}</p></div>
                      <div><p className="text-gray-500">Supplier</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.supplier?.name || '-'}</p></div>
                      <div><p className="text-gray-500">Total</p><p className="font-semibold text-white mt-0.5">₹{formatCurrency(auditDetail.data.totalAmount)}</p></div>
                    </div>
                    <div className="border-t border-gray-800 pt-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Items</p>
                      {auditDetail.data.items?.map((it, idx) => (
                        <div key={it.id || idx} className="flex justify-between text-gray-300">
                          <span>{it.batch?.product?.name || '-'} ({it.batch?.batchNumber})</span>
                          <span className="font-mono">{it.qty} × ₹{formatCurrency(it.rate)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => navigate('/purchases')} className="text-amber-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Open Purchases module
                    </button>
                  </>
                )}

                {auditDetail.log.entityType === 'Payment' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-gray-500">Amount</p><p className="font-semibold text-white mt-0.5">₹{formatCurrency(auditDetail.data.amount)}</p></div>
                      <div><p className="text-gray-500">Date</p><p className="font-semibold text-white mt-0.5">{formatDate(auditDetail.data.paymentDate)}</p></div>
                      <div><p className="text-gray-500">Party</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.party?.name || '-'}</p></div>
                      <div><p className="text-gray-500">Method</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.method?.replace('_', ' ')}</p></div>
                      <div><p className="text-gray-500">Reference</p><p className="font-semibold text-white mt-0.5 font-mono">{auditDetail.data.referenceNumber || '-'}</p></div>
                      <div><p className="text-gray-500">Linked Invoice</p><p className="font-semibold text-white mt-0.5 font-mono">{auditDetail.data.sale?.invoiceNumber || '-'}</p></div>
                    </div>
                    <button onClick={() => navigate('/payments')} className="text-amber-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Open Payments module
                    </button>
                  </>
                )}

                {auditDetail.log.entityType === 'Voucher' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-gray-500">Voucher No.</p><p className="font-semibold text-white font-mono mt-0.5">{auditDetail.data.voucherNumber}</p></div>
                      <div><p className="text-gray-500">Date</p><p className="font-semibold text-white mt-0.5">{formatDate(auditDetail.data.date)}</p></div>
                      <div><p className="text-gray-500">Type</p><p className="font-semibold text-amber-500 mt-0.5">{auditDetail.data.type}</p></div>
                      <div><p className="text-gray-500">Party</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.party?.name || 'General Journal'}</p></div>
                    </div>
                    <div className="border-t border-gray-800 pt-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ledger Lines</p>
                      {auditDetail.data.lines?.map((line, idx) => (
                        <div key={line.id || idx} className="flex justify-between text-gray-300">
                          <span>{line.type === 'DEBIT' ? 'Dr' : 'Cr'} {line.ledger?.name}</span>
                          <span className="font-mono text-white">₹{formatCurrency(line.amount)}</span>
                        </div>
                      ))}
                    </div>
                    {auditDetail.data.narration && <p className="text-gray-400 italic">"{auditDetail.data.narration}"</p>}
                    <button onClick={() => navigate('/vouchers')} className="text-amber-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Open Vouchers module
                    </button>
                  </>
                )}

                {auditDetail.log.entityType === 'Party' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-gray-500">Name</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.name}</p></div>
                    <div><p className="text-gray-500">Type</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.type}</p></div>
                    <div><p className="text-gray-500">GSTIN</p><p className="font-semibold text-white mt-0.5 font-mono">{auditDetail.data.gstin || '-'}</p></div>
                    <div><p className="text-gray-500">Phone</p><p className="font-semibold text-white mt-0.5">{auditDetail.data.phone || '-'}</p></div>
                  </div>
                )}
              </div>
            )}

            {auditDetail.log.metadata && (
              <div className="border-t border-gray-800 mt-4 pt-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Recorded at the time of this action</p>
                <pre className="text-[10px] text-gray-400 font-mono bg-[#0d1224] rounded-lg p-2.5 overflow-x-auto">{JSON.stringify(auditDetail.log.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
