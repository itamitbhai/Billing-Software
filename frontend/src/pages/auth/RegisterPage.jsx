import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';
import { Building, User, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [formData, setFormData] = useState({
    companyName: '',
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { companyName, name, email, password } = formData;
    if (!companyName || !name || !email || !password) {
      return toast.error('All fields are required');
    }

    setLoading(true);
    try {
      const data = await authApi.registerCeo(formData);
      setAuth(data.token, data.refreshToken, data.user);
      toast.success('Company and CEO registered successfully! Default ledgers seeded.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4 relative overflow-hidden py-12">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md glass p-8 rounded-2xl border border-gray-800 tally-border tally-glow relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-4">
            <Building className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Register Enterprise</h2>
          <p className="text-gray-400 text-sm mt-1">Deploy New Company & Database</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Company Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Building className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                name="companyName"
                required
                value={formData.companyName}
                onChange={handleChange}
                placeholder="E.g., Apex Solutions Pvt Ltd"
                className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-gray-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">CEO / Owner Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <User className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Amit Yadav"
                className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-gray-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="ceo@company.com"
                className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-gray-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-gray-600 outline-none transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50 mt-6"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Deploy Company Database'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-amber-500 hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
