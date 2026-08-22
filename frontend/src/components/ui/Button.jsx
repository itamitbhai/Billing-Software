import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const VARIANTS = {
  primary:
    'bg-gradient-to-b from-amber-400 to-amber-500 text-[#0a0e14] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-8px_rgba(245,158,11,0.55)] hover:from-amber-300 hover:to-amber-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_14px_30px_-8px_rgba(245,158,11,0.65)]',
  secondary:
    'bg-white/[0.04] border border-white/10 text-gray-200 hover:bg-white/[0.08] hover:border-white/20',
  ghost:
    'text-gray-400 hover:text-white hover:bg-white/5',
  danger:
    'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300',
};

const SIZES = {
  sm: 'text-xs px-3 py-2 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2 font-semibold',
  lg: 'text-sm px-5 py-3.5 rounded-xl gap-2 font-semibold',
};

const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, className, children, icon: Icon, type = 'button', ...props },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </motion.button>
  );
});

export default Button;
