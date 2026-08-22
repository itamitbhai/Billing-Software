import React from 'react';
import clsx from 'clsx';

export function Card({ className, children, hover = false, ...props }) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-xl',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.35)]',
        hover && 'transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04] hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={clsx('px-5 py-4 border-b border-white/[0.06]', className)} {...props}>
      {children}
    </div>
  );
}
