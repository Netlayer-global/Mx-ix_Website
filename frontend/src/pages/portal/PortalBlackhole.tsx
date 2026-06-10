import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldOff, Plus, Trash2, AlertCircle } from 'lucide-react';
import { portalBlackholeApi, BlackholeItem } from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

const PortalBlackhole: React.FC = () => {
  const [items, setItems] = useState<BlackholeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await portalBlackholeApi.list();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError('');
    if (!prefix.trim()) {
      setError('Enter a prefix.');
      return;
    }
    setBusy(true);
    const res = await portalBlackholeApi.create({
      prefix: prefix.trim(),
      description: description.trim(),
      expiresAt: expiresAt || undefined,
    });
    setBusy(false);
    if (res.success) {
      setPrefix('');
      setDescription('');
      setExpiresAt('');
      load();
    } else {
      setError(res.error || 'Failed to add prefix.');
    }
  };

  const toggle = async (b: BlackholeItem) => {
    await portalBlackholeApi.update(b._id, { active: !b.active });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Withdraw this blackhole?')) return;
    await portalBlackholeApi.remove(id);
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

  return (
    <div>
      <PageHeading
        eyebrow="// Security"
        title="Blackholing"
        subtitle="Announce blackhole routes to drop traffic to a prefix under attack. Applied via the MX-IX route servers (RTBH community)."
      />

      <div className="border border-amber-500/30 bg-amber-500/10 px-5 py-3 mb-6 flex items-start gap-2 text-sm text-gray-600">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        Blackholed prefixes are dropped at the exchange. Use /32 (IPv4) or /128 (IPv6) for single hosts. Withdraw as soon
        as the attack subsides.
      </div>

      <section className="bg-white border border-gray-200 p-5 mb-6">
        <h3 className="font-mono text-label tracking-label uppercase text-ink mb-4">Announce a blackhole</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix (e.g. 203.0.113.5/32)" className={inputClass} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={inputClass} />
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-[#F20732] font-mono text-xs mt-3">{error}</p>}
        <div className="flex justify-end mt-4">
          <button onClick={add} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Announce
          </button>
        </div>
      </section>

      {items.length ? (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {items.map((b) => (
            <div key={b._id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-sm text-ink truncate">{b.prefix}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {b.description || 'No description'}
                  {b.expiresAt ? ` · expires ${new Date(b.expiresAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <Badge tone={b.active ? 'red' : 'gray'}>{b.active ? 'announced' : 'withdrawn'}</Badge>
              <button onClick={() => toggle(b)} className="font-mono text-label-sm uppercase tracking-mono text-gray-400 hover:text-ink transition-colors hover-trigger">
                {b.active ? 'Withdraw' : 'Re-announce'}
              </button>
              <button onClick={() => remove(b._id)} className="p-1.5 text-gray-400 hover:text-[#F20732] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ShieldOff className="w-10 h-10" />} title="No blackholes" hint="Announce a prefix to drop attack traffic at the exchange." />
      )}
    </div>
  );
};

export default PortalBlackhole;
