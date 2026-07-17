'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/** Meridian springy entrance shared by the floating panels. */
export const panelMotion = {
  initial: { opacity: 0, y: 8, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.24, ease: [0.3, 1.04, 0.35, 1] as const },
};

/**
 * Meridian card surface for the HUD: warm espresso card at slight
 * translucency so space glows through, hairline border, pop shadow.
 */
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
      {...panelMotion}
      className={`pointer-events-auto overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-card)_94%,transparent)] shadow-[var(--shadow-pop)] backdrop-blur-xl ${className}`}
    >
      {title !== undefined ? (
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2.5">
          <h2 className="text-[12px] font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--text-muted)]">
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
      className={`inline-flex h-[var(--control-h-sm)] min-w-[var(--control-h-sm)] items-center justify-center rounded-[var(--radius-sm)] px-2 text-[13px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] ${
        active
          ? 'border border-[var(--accent-subtle-border)] bg-[var(--accent-subtle)] text-[var(--text-link)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]'
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
      className={`relative h-5 w-9 shrink-0 rounded-[var(--radius-full)] transition-colors duration-[160ms] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] ${
        checked ? 'bg-[var(--brand-500)]' : 'bg-[var(--surface-sunken)]'
      }`}
    >
      <span
        className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--sand-50)] shadow-sm transition-transform duration-[160ms]"
        style={{
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transitionTimingFunction: 'cubic-bezier(.3,1.04,.35,1)',
        }}
      />
    </button>
  );
}
