import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Network, Zap, Layers, ShoppingCart, Clock, X, ChevronDown } from 'lucide-react';
import {
  portalApi,
  portalOrdersApi,
  OrderItem,
  OrderCatalog,
  OrderType,
  OrderStatus,
  PortItem,
} from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

const statusTone = (s: OrderStatus) =>
  s === 'completed'
    ? 'green'
    : s === 'rejected' || s === 'cancelled'
    ? 'red'
    : s === 'provisioning' || s === 'approved'
    ? 'amber'
    : 'gray';

const typeLabel: Record<OrderType, string> = {
  new_port: 'New Port',
  upgrade: 'Port Upgrade',
  addon: 'Add-on',
};

const PortalServices: React.FC = () => {
  const [catalog, setCatalog] = useState<OrderCatalog | null>(null);
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderType>('new_port');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // form fields
  const [location, setLocation] = useState('');
  const [speed, setSpeed] = useState('');
  const [portId, setPortId] = useState('');
  const [addon, setAddon] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const [c, p, o] = await Promise.all([
      portalOrdersApi.getCatalog(),
      portalApi.getPorts(),
      portalOrdersApi.list(),
    ]);
    if (c.success && c.data) {
      setCatalog(c.data);
      setLocation(c.data.locations[0]?.id || '');
      setSpeed(c.data.speeds[0] || '');
      setAddon(c.data.addons[0]?.id || '');
    }
    if (p.success && p.data) {
      setPorts(p.data);
      setPortId(p.data[0]?._id || '');
    }
    if (o.success && o.data) setOrders(o.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError('');
    const payload: any = { type: tab, notes };
    if (tab === 'new_port') {
      payload.location = location;
      payload.speed = speed;
    } else if (tab === 'upgrade') {
      payload.portId = portId;
      payload.speed = speed;
    } else {
      payload.addon = addon;
      if (portId) payload.portId = portId;
    }
    setSaving(true);
    const res = await portalOrdersApi.create(payload);
    setSaving(false);
    if (res.success) {
      setNotes('');
      load();
    } else {
      setError(res.error || 'Failed to submit order.');
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this order?')) return;
    await portalOrdersApi.cancel(id);
    load();
  };

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const TABS: { id: OrderType; label: string; icon: React.ElementType }[] = [
    { id: 'new_port', label: 'New Port', icon: Network },
    { id: 'upgrade', label: 'Upgrade', icon: Zap },
    { id: 'addon', label: 'Add-on', icon: Layers },
  ];

  return (
    <div>
      <PageHeading
        eyebrow="// Services"
        title="Services & Orders"
        subtitle="Order new ports, upgrade speeds and add services. MX-IX provisions via IXP Manager and you can track progress here."
      />

      {/* Order form */}
      <section className="bg-white border border-gray-200 mb-8">
        <div className="flex border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-4 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger relative ${
                tab === t.id ? 'text-ink' : 'text-gray-400 hover:text-ink'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              {tab === t.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#F20732]" />}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'new_port' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass}>
                  {catalog?.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.region})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Port speed</label>
                <select value={speed} onChange={(e) => setSpeed(e.target.value)} className={inputClass}>
                  {catalog?.speeds.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'upgrade' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Port to upgrade</label>
                {ports.length ? (
                  <select value={portId} onChange={(e) => setPortId(e.target.value)} className={inputClass}>
                    {ports.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — {p.location} ({p.speed})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 py-3">You have no ports to upgrade yet.</p>
                )}
              </div>
              <div>
                <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">New speed</label>
                <select value={speed} onChange={(e) => setSpeed(e.target.value)} className={inputClass}>
                  {catalog?.speeds.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'addon' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catalog?.addons.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAddon(a.id)}
                    className={`text-left p-4 border transition-colors hover-trigger ${
                      addon === a.id ? 'border-[#F20732] bg-[#F20732]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-sm text-ink">{a.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.description}</p>
                  </button>
                ))}
              </div>
              {ports.length > 0 && (
                <div>
                  <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Apply to port (optional)</label>
                  <select value={portId} onChange={(e) => setPortId(e.target.value)} className={inputClass}>
                    <option value="">— Not port-specific —</option>
                    {ports.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — {p.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything our provisioning team should know" className={inputClass} />
          </div>

          {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}

          <button
            onClick={submit}
            disabled={saving || (tab === 'upgrade' && !ports.length)}
            className="flex items-center gap-2 px-5 py-3 bg-[#F20732] text-white font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Submit Order
          </button>
        </div>
      </section>

      {/* Orders list */}
      <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3 flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-[#F20732]" /> My Orders
      </h3>
      {orders.length ? (
        <div className="space-y-3">
          {orders.map((o) => {
            const isOpen = expanded === o._id;
            const summary =
              o.type === 'new_port'
                ? `${o.speed} @ ${o.location}`
                : o.type === 'upgrade'
                ? `Upgrade to ${o.speed}`
                : (catalogAddonName(o.addon) || o.addon);
            return (
              <div key={o._id} className="bg-white border border-gray-200">
                <button
                  onClick={() => setExpanded(isOpen ? null : o._id)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 transition-colors hover-trigger"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {typeLabel[o.type]} <span className="text-gray-400 font-normal">· {summary}</span>
                      </p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString()} · #{o._id.slice(-6)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!['completed', 'rejected', 'cancelled'].includes(o.status) && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          cancel(o._id);
                        }}
                        className="font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-200 px-5 py-4">
                    {o.notes && <p className="text-sm text-gray-600 mb-3">Notes: {o.notes}</p>}
                    {o.adminNotes && <p className="text-sm text-gray-600 mb-3">MX-IX: {o.adminNotes}</p>}
                    <ol className="space-y-2">
                      {o.updates.map((u, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-mono text-label-sm uppercase tracking-mono text-ink">{u.status}</span>
                            {u.message && <span className="text-gray-500"> — {u.message}</span>}
                            <span className="block font-mono text-xs text-gray-400">
                              {new Date(u.at).toLocaleString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<ShoppingCart className="w-8 h-8" />} title="No orders yet" hint="Submit your first order above." />
      )}
    </div>
  );
};

// Resolve addon id → label from a static map (mirrors backend catalog).
const ADDON_NAMES: Record<string, string> = {
  cloud_connect: 'Cloud Connect',
  ddos: 'DDoS Protection',
  blackholing: 'Blackholing',
  vlan: 'Additional VLAN',
};
const catalogAddonName = (id?: string) => (id ? ADDON_NAMES[id] : undefined);

export default PortalServices;
