import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';
import { Building2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      return toast.error('Please enter both email and password');
    }

    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      setAuth(data.token, data.refreshToken, data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060b] px-4 relative overflow-hidden bg-grid-dots">
      {/* Ambient glow orbs */}
      <div className="absolute top-[-10%] left-[8%] w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-[110px]" />
      <div className="absolute bottom-[-15%] right-[8%] w-[28rem] h-[28rem] bg-indigo-500/10 rounded-full blur-[110px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#05060b]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md glass bg-noise p-8 sm:p-9 rounded-2xl tally-border tally-glow relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-13 w-13 rounded-2xl bg-gradient-to-b from-amber-400/20 to-amber-500/5 flex items-center justify-center border border-amber-500/25 mb-5 shadow-[0_0_30px_-8px_rgba(242,181,68,0.5)]">
            <Building2 className="h-6 w-6 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-gradient-gold tracking-tight">Tally Gateway</h2>
          <p className="text-gray-500 text-sm mt-1.5">Enterprise ERP Management Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email Address"
            icon={Mail}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />

          <Input
            label="Password"
            icon={Lock}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" loading={loading} size="lg" className="w-full mt-1">
            {loading ? 'Verifying…' : 'Access Gateway'}
          </Button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-600 mt-7">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-600" />
          Access is admin-provisioned only. Contact your administrator for a login.
        </div>
      </motion.div>
    </div>
  );
}
