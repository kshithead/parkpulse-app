import React from 'react';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  className = '',
  onClick
}) => {
  const colorMap = {
    green: {
      bg: 'bg-emerald-500/10 text-emerald-600',
      border: 'border-emerald-200/80',
      badge: 'text-emerald-700 bg-emerald-50',
      glow: 'hover:border-emerald-300'
    },
    red: {
      bg: 'bg-rose-500/10 text-rose-600',
      border: 'border-rose-200/80',
      badge: 'text-rose-700 bg-rose-50',
      glow: 'hover:border-rose-300'
    },
    blue: {
      bg: 'bg-blue-500/10 text-blue-600',
      border: 'border-blue-200/80',
      badge: 'text-blue-700 bg-blue-50',
      glow: 'hover:border-blue-300'
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-600',
      border: 'border-amber-200/80',
      badge: 'text-amber-700 bg-amber-50',
      glow: 'hover:border-amber-300'
    },
    purple: {
      bg: 'bg-purple-500/10 text-purple-600',
      border: 'border-purple-200/80',
      badge: 'text-purple-700 bg-purple-50',
      glow: 'hover:border-purple-300'
    },
    default: {
      bg: 'bg-slate-100 text-slate-600',
      border: 'border-slate-200',
      badge: 'text-slate-700 bg-slate-50',
      glow: 'hover:border-slate-300'
    }
  };

  const style = colorMap[variant] || colorMap.default;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      className={`bg-white rounded-2xl p-3.5 sm:p-5 border shadow-sm min-w-0 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${style.border} ${style.glow} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 leading-tight">
            {title}
          </p>
          <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
            <h4 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {value}
            </h4>
            {trend && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                {trend}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 font-normal pt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`hidden min-[420px]:flex p-2 sm:p-3 rounded-xl items-center justify-center shrink-0 ${style.bg}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

