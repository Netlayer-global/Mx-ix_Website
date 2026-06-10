import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, ShoppingCart, Clock, Save } from 'lucide-react';
import { adminOrdersApi, OrderItem, OrderStatus } from '../services/api';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const STATUSES: OrderStatus[] = [
  'submitted',
  'reviewing',
  'approved',
  'provisioning',
  'completed',
  'rejected',
  'cancelled',
];

const badge = (s: OrderStatus) => {
  const map: Record<OrderStatus, string> = {
    submitted: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    reviewing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    approved: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    provisioning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    completed: 'bg-green-500/15 text-green-400 border-green-500/30',
    rejected: 'bg-[#F20732]/15 text-[#F20732] border-[#F20732]/30',
    cancelled: 'bg-gray-600/20 text-gray-400 border-gray-600/40',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ${map[s]}`}>
      {s}
    </span>
  );
};

const typeLabel: Record<string, string> = { new_port: 'New Port', upgrade: 'Upgrade', addon: 'Add-on' };

const OrdersAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>('reviewing');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await adminOrdersApi.list();
    if (res.success && res.data) setOrders(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openOrder = (o: OrderItem) => {
    if (expanded === o._id) {
      setExpanded(null);
      return;
    }
    setExpanded(o._id);
    setDraftStatus(o.status);
    setDraftMessage('');
    setDraftNotes(o.adminNotes || '');
  };

  const apply = async (id: string) => {
    setSaving(true);
    await adminOrdersApi.update(id, { status: draftStatus, message: draftMessage, adminNotes: draftNotes });
    setSaving(false);
    setDraftMessage('');
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const openCount = orders.filter((o) => !['completed', 'rejected', 'cancelled'].includes(o.status)).length;
  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Orders</h1>
              <p className="text-gray-400 text-sm">Port, upgrade &amp; add-on requests</p>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold">{openCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Open</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', ...STATUSES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          {filtered.map((o) => {
            const isOpen = expanded === o._id;
            const summary =
              o.type === 'new_port'
                ? `${o.speed} @ ${o.location}`
                : o.type === 'upgrade'
                ? `Upgrade to ${o.speed}`
                : o.addon;
            return (
              <div key={o._id} className="bg-gray-800 border border-gray-700 rounded-lg">
                <button onClick={() => openOrder(o)} className="w-full p-4 flex items-center gap-4 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate">{o.orgName}</span>
                      {o.orgAsn ? <span className="text-xs text-gray-400">AS{o.orgAsn}</span> : null}
                      {badge(o.status)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {typeLabel[o.type]} · {summary} · {new Date(o.createdAt).toLocaleDateString()} · #{o._id.slice(-6)}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    {o.notes && <p className="text-sm text-gray-300">Member notes: {o.notes}</p>}

                    {/* timeline */}
                    <ol className="space-y-1.5">
                      {o.updates.map((u, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>
                            <span className="uppercase text-gray-300">{u.status}</span>
                            {u.message ? ` — ${u.message}` : ''} · {new Date(u.at).toLocaleString()}
                            {u.by ? ` · ${u.by}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>

                    {/* actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as OrderStatus)} className={field}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        placeholder="Update message (optional)"
                        className={`${field} md:col-span-2`}
                      />
                    </div>
                    <textarea
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Internal admin notes (shown to member)"
                      rows={2}
                      className={field}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => apply(o._id)}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Update order
                      </button>
                    </div>
                    {o.ixpManagerRef && (
                      <p className="text-xs text-green-400">IXP Manager ref: {o.ixpManagerRef}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!filtered.length && (
            <p className="text-gray-500 text-sm text-center py-12">No orders{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default OrdersAdminPanel;
