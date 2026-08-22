import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';
import { Building2, User, Mail, Lock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
    state: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { companyName, name, email, password, state } = formData;
    if (!companyName || !name || !email || !password || !state) {
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
    <div className="min-h-screen flex items-center justify-center bg-[#05060b] px-4 relative overflow-hidden bg-grid-dots py-12">
      <div className="absolute top-[-10%] left-[8%] w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-[110px]" />
      <div className="absolute bottom-[-15%] right-[8%] w-[28rem] h-[28rem] bg-indigo-500/10 rounded-full blur-[110px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md glass bg-noise p-8 rounded-2xl tally-border tally-glow relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-13 w-13 rounded-2xl bg-gradient-to-b from-amber-400/20 to-amber-500/5 flex items-center justify-center border border-amber-500/25 mb-5 shadow-[0_0_30px_-8px_rgba(242,181,68,0.5)]">
            <Building2 className="h-6 w-6 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-gradient-gold tracking-tight">Register Enterprise</h2>
          <p className="text-gray-500 text-sm mt-1.5">Deploy New Company &amp; Database</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            icon={Building2}
            name="companyName"
            required
            value={formData.companyName}
            onChange={handleChange}
            placeholder="E.g., Apex Solutions Pvt Ltd"
          />

          <Input
            label="CEO / Owner Name"
            icon={User}
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="Amit Yadav"
          />

          <Input
            label="Company State (GST Region)"
            icon={MapPin}
            name="state"
            required
            value={formData.state}
            onChange={handleChange}
            placeholder="E.g., Jharkhand"
            hint="Used to auto-decide CGST+SGST vs IGST on your GST invoices — you can still edit it later under Utilities."
          />

          <Input
            label="Email Address"
            icon={Mail}
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="ceo@company.com"
          />

          <Input
            label="Password"
            icon={Lock}
            type="password"
            name="password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="Min. 8 characters"
          />

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            {loading ? 'Deploying…' : 'Deploy Company Database'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
