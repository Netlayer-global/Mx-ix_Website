import React from 'react';
import { ChevronLeft, ChevronRight, Loader2, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

/**
 * Shared primitives for the IXP fabric admin panels.
 *
 * The existing panels each hand-rolled their own header, inputs and tables. These
 * keep the new screens consistent and short. Dark `bg-gray-*` classes are used on
 * purpose: `index.css` remaps them to the light admin theme, so writing them here
 * gets the correct look for free.
 */

/** Shared input class. Matches the existing panels' `field` string. */
export const field =
  'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#F20732] transition-colors';

export const labelCls = 'block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5';

// ── Panel shell ──

export const PanelShell: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  embedded?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  /** Breadcrumb trail rendered under the title. */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ title, subtitle, icon: Icon, embedded, onBack, actions, breadcrumb, children, maxWidth = 'max-w-7xl' }) => (
  <div className="min-h-screen bg-gray-900 text-white admin-panel">
    <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4 sticky top-0 z-20">
      <div className={`${maxWidth} mx-auto`}>
        <div className="flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg" aria-label="Back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-gray-500 text-sm truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
        </div>
        {breadcrumb && <div className="mt-3">{breadcrumb}</div>}
      </div>
    </header>
    <main className={`${maxWidth} mx-auto px-4 sm:px-6 py-6 space-y-6`}>{children}</main>
  </div>
);

/** Clickable breadcrumb trail — the spine of the fabric drill-down. */
export const Breadcrumb: React.FC<{
  items: Array<{ label: string; onClick?: () => void }>;
}> = ({ items }) => (
  <nav className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] uppercase tracking-wider">
    {items.map((item, i) => {
      const last = i === items.length - 1;
      return (
        <React.Fragment key={`${item.label}-${i}`}>
          {i > 0 && <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />}
          {item.onClick && !last ? (
            <button onClick={item.onClick} className="text-gray-400 hover:text-[#F20732] transition-colors">
              {item.label}
            </button>
          ) : (
            <span className={last ? 'text-white' : 'text-gray-400'}>{item.label}</span>
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

// ── Buttons ──

export const Btn: React.FC<{
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ElementType;
  children?: React.ReactNode;
  title?: string;
  type?: 'button' | 'submit';
}> = ({ onClick, variant = 'ghost', size = 'md', disabled, busy, icon: Icon, children, title, type = 'button' }) => {
  const base =
    'inline-flex items-center gap-2 font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const variants = {
    primary: 'bg-[#F20732] text-white hover:bg-[#C00628]',
    ghost: 'bg-gray-700 text-white hover:bg-gray-600',
    danger: 'bg-transparent text-gray-400 hover:text-[#F20732]',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} title={title} className={`${base} ${sizes} ${variants}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
};

// ── Feedback ──

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
    <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
    {label && <p className="text-sm text-gray-500">{label}</p>}
  </div>
);

export type NoteTone = 'error' | 'warning' | 'info' | 'success';

const NOTE_STYLES: Record<NoteTone, { cls: string; Icon: React.ElementType }> = {
  error: { cls: 'border-[#F20732]/40 bg-[#F20732]/10 text-[#F20732]', Icon: AlertTriangle },
  warning: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-500', Icon: AlertTriangle },
  info: { cls: 'border-gray-600 bg-gray-800 text-gray-300', Icon: Info },
  success: { cls: 'border-green-500/40 bg-green-500/10 text-green-500', Icon: CheckCircle2 },
};

export const Note: React.FC<{ tone?: NoteTone; children: React.ReactNode; onDismiss?: () => void }> = ({
  tone = 'info',
  children,
  onDismiss,
}) => {
  const { cls, Icon } = NOTE_STYLES[tone];
  return (
    <div className={`flex items-start gap-3 border rounded-lg px-4 py-3 text-sm ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 leading-relaxed">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/**
 * Collapsible list of build/deploy warnings.
 *
 * Route-server builds routinely produce a dozen warnings; showing them all
 * inline drowns the screen, hiding them entirely loses the point.
 */
export const WarningList: React.FC<{ warnings: string[]; max?: number }> = ({ warnings, max = 4 }) => {
  const [open, setOpen] = React.useState(false);
  if (!warnings?.length) return null;
  const shown = open ? warnings : warnings.slice(0, max);
  return (
    <Note tone="warning">
      <p className="font-bold mb-1.5">
        {warnings.length} warning{warnings.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-1 list-disc pl-4">
        {shown.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
      {warnings.length > max && (
        <button onClick={() => setOpen((v) => !v)} className="mt-2 underline font-mono text-xs uppercase tracking-wider">
          {open ? 'Show less' : `Show ${warnings.length - max} more`}
        </button>
      )}
    </Note>
  );
};

export const EmptyState: React.FC<{ icon?: React.ElementType; title: string; hint?: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  hint,
  action,
}) => (
  <div className="border border-dashed border-gray-700 rounded-lg py-14 flex flex-col items-center justify-center text-center px-6">
    {Icon && <Icon className="w-10 h-10 text-gray-600 mb-4" />}
    <p className="font-mono text-sm uppercase tracking-wider text-gray-400">{title}</p>
    {hint && <p className="text-sm text-gray-500 mt-2 max-w-md">{hint}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// ── Data display ──

export type Tone = 'green' | 'amber' | 'orange' | 'red' | 'gray' | 'blue';

const TONE_CLS: Record<Tone, string> = {
  green: 'bg-green-500/10 text-green-500 border-green-500/30',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  red: 'bg-[#F20732]/10 text-[#F20732] border-[#F20732]/30',
  gray: 'bg-gray-700/50 text-gray-400 border-gray-600',
  blue: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; title?: string }> = ({
  tone = 'gray',
  children,
  title,
}) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded font-mono text-[10px] uppercase tracking-wider whitespace-nowrap ${TONE_CLS[tone]}`}
  >
    {children}
  </span>
);

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
}> = ({ label, value, hint, tone, onClick }) => {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-gray-800 border border-gray-700 rounded-lg p-4 text-left ${
        onClick ? 'hover:border-gray-500 transition-colors w-full' : ''
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${tone ? TONE_CLS[tone].split(' ')[1] : 'text-white'}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </Wrapper>
  );
};

/** Utilisation bar. Turns amber then red as a pool fills up. */
export const UtilBar: React.FC<{ percent: number; label?: string }> = ({ percent, label }) => {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const colour = pct >= 90 ? 'bg-[#F20732]' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="min-w-[120px]">
      {label && (
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${colour} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>{children}</section>
);

export const CardHeader: React.FC<{ title: string; hint?: string; actions?: React.ReactNode }> = ({
  title,
  hint,
  actions,
}) => (
  <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-700">
    <div className="min-w-0">
      <h2 className="font-bold">{title}</h2>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

/** Simple table with a monospace header row. */
export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode; dense?: boolean }> = ({
  head,
  children,
  dense,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-700">
          {head.map((h, i) => (
            <th
              key={i}
              className={`text-left font-mono text-[10px] uppercase tracking-wider text-gray-500 px-4 ${
                dense ? 'py-2' : 'py-3'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-700/60">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<{ children?: React.ReactNode; className?: string; colSpan?: number }> = ({
  children,
  className = '',
  colSpan,
}) => (
  <td colSpan={colSpan} className={`px-4 py-3 align-middle ${className}`}>
    {children}
  </td>
);

// ── Modal ──

export const Modal: React.FC<{
  title: string;
  hint?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, hint, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 z-[90] bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
    <div
      className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} bg-gray-800 border border-gray-700 rounded-xl my-8 shadow-2xl`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-700">
        <div>
          <h2 className="font-bold">{title}</h2>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-5 py-5 space-y-4">{children}</div>
      {footer && <div className="px-5 py-4 border-t border-gray-700 flex justify-end gap-2">{footer}</div>}
    </div>
  </div>
);

// ── Form helpers ──

export const Fld: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  span?: boolean;
}> = ({ label, hint, children, span }) => (
  <div className={span ? 'md:col-span-2' : ''}>
    <label className={labelCls}>{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
  </div>
);

/**
 * Form grid. Column classes are spelled out rather than interpolated, because
 * Tailwind only ships classes it can see in the source — `md:grid-cols-${n}`
 * would be purged from the build.
 */
export const Grid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 }> = ({ children, cols = 2 }) => {
  const cls = cols === 4 ? 'md:grid-cols-4' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return <div className={`grid grid-cols-1 ${cls} gap-4`}>{children}</div>;
};

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  checked,
  onChange,
  label,
  hint,
}) => (
  <label className="flex items-start gap-3 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-4 h-4 accent-[#F20732] flex-shrink-0"
    />
    <span className="min-w-0">
      <span className="text-sm">{label}</span>
      {hint && <span className="block text-[11px] text-gray-500 mt-0.5">{hint}</span>}
    </span>
  </label>
);

// ── Formatting ──

/** Mbit/s → human ("10G", "2 x 100G" handled by the caller). */
export const fmtSpeed = (mbps?: number): string => {
  if (!mbps) return '—';
  if (mbps >= 1000 && mbps % 1000 === 0) return `${mbps / 1000}G`;
  return `${mbps}M`;
};

export const fmtNumber = (n?: number): string => (n === undefined || n === null ? '—' : n.toLocaleString());

export const fmtDate = (d?: string | null): string => {
  if (!d) return 'never';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

/** "3 minutes ago" style relative time, for deploy freshness. */
export const fmtRelative = (d?: string | null): string => {
  if (!d) return 'never';
  const then = new Date(d).getTime();
  if (Number.isNaN(then)) return '—';
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const rsModeTone = (mode: string): Tone =>
  mode === 'normal' ? 'green' : mode === 'passive' ? 'amber' : 'gray';

export const portStatusTone = (status: string): Tone => {
  switch (status) {
    case 'free':
      return 'green';
    case 'assigned':
      return 'blue';
    case 'reserved':
      return 'amber';
    case 'faulty':
      return 'red';
    default:
      return 'gray';
  }
};
