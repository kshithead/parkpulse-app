import React from 'react';

const SIZES = {
  xs: 'px-2 py-0.5 text-[11px]',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm'
};

// tone -> [pill classes, dot color]
const TONES = {
  green: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-emerald-500'],
  red: ['bg-rose-50 text-rose-700 border-rose-200', 'bg-rose-500'],
  amber: ['bg-amber-50 text-amber-700 border-amber-200', 'bg-amber-500'],
  blue: ['bg-blue-50 text-blue-700 border-blue-200', 'bg-blue-500'],
  purple: ['bg-purple-50 text-purple-700 border-purple-200', 'bg-purple-500'],
  indigo: ['bg-indigo-50 text-indigo-700 border-indigo-200', 'bg-indigo-500'],
  slate: ['bg-slate-100 text-slate-700 border-slate-200', 'bg-slate-400']
};

const VARIANT_TONE = {
  available: 'green',
  success: 'green',
  resolved: 'green',
  occupied: 'red',
  danger: 'red',
  warning_issued: 'red',
  reserved: 'purple',
  maintenance: 'amber',
  warning: 'amber',
  pending: 'amber',
  investigating: 'blue',
  primary: 'blue',
  admin: 'indigo',
  dismissed: 'slate',
  user: 'slate',
  default: 'slate'
};

export const Badge = ({ variant = 'default', tone, children, size = 'sm', dot = true, className = '' }) => {
  const [pill, dotColor] = TONES[tone || VARIANT_TONE[variant] || 'slate'];
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap ${SIZES[size] || SIZES.sm} ${pill} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {children}
    </span>
  );
};
