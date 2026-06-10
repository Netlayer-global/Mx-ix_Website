import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, Server, FileCode, UploadCloud, X, Copy, Check } from 'lucide-react';
import { adminRouteServersApi, RouteServerItem } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const emptyForm = {
  name: '', group: '', backend: 'birdwatcher' as 'birdwatcher' | 'gobgp',
  apiUrl: '', birdwatcherType: 'multi_table', asn: '', ipv4: '', ipv6: '', location: '', order: 0,
};

const RouteServersAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [servers, setServers] = useState<RouteServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configText, setConfigText] = useState<string | null>(null);
  const [applyInfo, setApplyInfo] = useState<{ configured: boolean; path: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

  const load = useCallback(async () => {
    const res = await adminRouteServersApi.list();
    if (res.success && res.data) setServers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setError('');
    if (!form.name || !form.apiUrl) { setError('Name and API URL are required.'); return; }
    setBusy(true);
    const res = await adminRouteServersApi.create({
      ...form,
      asn: form.asn ? Number(form.asn) : undefined,
      order: Number(form.order) || 0,
    });
    setBusy(false);
    if (res.success) { setForm({ ...emptyForm }); setShowForm(false); load(); }
    else setError(res.error || 'Failed to create.');
  };

  const toggle = async (s: RouteServerItem) => { await adminRouteServersApi.update(s._id, { enabled: !s.enabled }); load(); };
  const remove = async (id: string) => { if (!confirm('Delete this route server?')) return; await adminRouteServersApi.remove(id); load(); };

  const preview = async () => {
    const res = await adminRouteServersApi.config();
    if (res.success && res.data) {
      setConfigText(res.data.config);
      setApplyInfo({ configured: res.data.applyConfigured, path: res.data.path });
    }
  };

  const apply = async () => {
    setApplyMsg('');
    const res = await adminRouteServersApi.apply();
    if (res.success && res.data?.applied) setApplyMsg('Applied & reloaded Alice-LG successfully.');
    else {
      setApplyMsg(res.error || 'Apply not configured — copy the config manually.');
      if (res.data?.config) setConfigText(res.data.config);
    }
  };

  const copy = async () => {
    if (!configText) return;
    await navigator.clipboard.writeText(configText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Server className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Route Servers</h1><p className="text-gray-400 text-sm">Alice-LG sources &amp; config</p></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={preview} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600 transition-colors"><FileCode className="w-4 h-4" /> Generate config</button>
            <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors"><Plus className="w-4 h-4" /> Add RS</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {showForm && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Add route server source</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. rs1.del (IPv4))" className={field} />
              <input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Group / location (e.g. Delhi)" className={field} />
              <select value={form.backend} onChange={(e) => setForm({ ...form, backend: e.target.value as any })} className={field}>
                <option value="birdwatcher">birdwatcher (BIRD)</option>
                <option value="gobgp">gobgp</option>
              </select>
              {form.backend === 'birdwatcher' && (
                <select value={form.birdwatcherType} onChange={(e) => setForm({ ...form, birdwatcherType: e.target.value })} className={field}>
                  <option value="multi_table">multi_table</option>
                  <option value="single_table">single_table</option>
                </select>
              )}
              <input value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="API URL (birdwatcher/gobgp endpoint)" className={`${field} md:col-span-2`} />
              <input value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} placeholder="RS ASN (optional)" className={field} />
              <input value={form.ipv4} onChange={(e) => setForm({ ...form, ipv4: e.target.value })} placeholder="IPv4 (optional)" className={field} />
              <input value={form.ipv6} onChange={(e) => setForm({ ...form, ipv6: e.target.value })} placeholder="IPv6 (optional)" className={field} />
              <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} placeholder="Order" className={field} />
            </div>
            {error && <p className="text-[#F20732] text-sm mt-3">{error}</p>}
            <div className="flex justify-end mt-4">
              <button onClick={add} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          {servers.map((s) => (
            <div key={s._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{s.name} {!s.enabled && <span className="text-[10px] uppercase text-gray-500 ml-1">disabled</span>}</div>
                <div className="text-xs text-gray-400">{s.group || '—'} · {s.backend} · {s.apiUrl}</div>
              </div>
              <button onClick={() => toggle(s)} className="text-xs font-mono uppercase text-gray-400 hover:text-white">{s.enabled ? 'Disable' : 'Enable'}</button>
              <button onClick={() => remove(s._id)} className="p-2 text-gray-400 hover:text-[#F20732]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!servers.length && <p className="text-gray-500 text-sm text-center py-8">No route servers yet. Add one, then generate the Alice-LG config.</p>}
        </section>

        {configText !== null && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold flex items-center gap-2"><FileCode className="w-4 h-4" /> Generated alice.conf</h2>
              <div className="flex items-center gap-2">
                <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded text-xs font-bold hover:bg-gray-600">{copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copy</button>
                <button onClick={apply} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F20732] rounded text-xs font-bold hover:bg-[#C00628]"><UploadCloud className="w-3.5 h-3.5" /> Apply &amp; reload</button>
              </div>
            </div>
            {applyInfo && (
              <p className="text-xs text-gray-400 mb-2">
                {applyInfo.configured ? `Apply will write to ${applyInfo.path} and reload Alice-LG.` : 'Apply is not configured on the backend host — copy the config to your alice.conf manually.'}
              </p>
            )}
            {applyMsg && <p className="text-sm mb-2 text-amber-400">{applyMsg}</p>}
            <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300 overflow-x-auto max-h-96 whitespace-pre-wrap">{configText}</pre>
          </section>
        )}
      </main>
    </div>
  );
};

export default RouteServersAdminPanel;
