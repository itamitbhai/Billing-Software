import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Loader2, Plus, Settings, Building, Users, Mail, Shield, ShieldCheck, Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function UtilitiesPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('company');

  // Modal & Form States for User Management
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });

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

  const company = companyRes?.data || { companyName: '', email: '', phone: '', address: '', gstin: '', state: '' };
  const usersList = usersRes?.data || [];

  // Company Profile Update State
  const [companyForm, setCompanyForm] = useState({ companyName: '', email: '', phone: '', address: '', gstin: '', state: '' });
  
  React.useEffect(() => {
    if (companyRes?.data) {
      setCompanyForm({
        companyName: companyRes.data.companyName || '',
        email: companyRes.data.email || '',
        phone: companyRes.data.phone || '',
        address: companyRes.data.address || '',
        gstin: companyRes.data.gstin || '',
        state: companyRes.data.state || ''
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
          { id: 'users', name: 'User Management', icon: Users, show: isAdmin }
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
    </div>
  );
}
