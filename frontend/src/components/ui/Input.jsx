import React from 'react';
import clsx from 'clsx';

const Input = React.forwardRef(function Input(
  { label, icon: Icon, error, hint, className, containerClassName, ...props },
  ref
) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 group-focus-within:text-amber-500 transition-colors duration-200">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-black/25 border border-white/[0.08] focus:border-amber-500/50 focus:bg-black/35 focus:ring-4 focus:ring-amber-500/10 rounded-xl py-3 text-white placeholder-gray-600 outline-none transition-all duration-200',
            Icon ? 'pl-11 pr-4' : 'px-4',
            error && 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/10',
            className
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-[11px] text-rose-400 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
});

export default Input;
