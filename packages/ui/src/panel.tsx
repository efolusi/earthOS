'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Shared glass surface. Every floating EarthOS panel sits on this. */
export function GlassPanel({
  children,
  className = '',
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/40 backdrop-blur-xl ${className}`}
    >
      {title !== undefined ? (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {title}
          </h2>
          {actions}
        </div>
      ) : null}
      {children}
    </motion.div>
  );
}

export function IconButton({
  label,
  onClick,
  active = false,
  children,
  className = '',
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${
        active ? 'bg-sky-500/25 text-sky-200' : 'text-slate-300 hover:bg-white/10 hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-sky-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4.5 left-0' : 'left-0.5'
        }`}
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  );
}
