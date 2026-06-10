import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Megaphone, Send } from 'lucide-react';
import { adminSystemApi, AnnouncementItem } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const AnnouncementsPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'info' as 'info' | 'maintenance' | 'incident',
    inApp: true,
    email: false,
    audience: 'active' as 'all' | 'active',
  });

  const load = useCallback(async () => {
    const res = await adminSystemApi.listAnnouncements();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    setError('');
    setDone('');
    if (!form.title || !form.body) { setError('Title and body are required.'); return; }
    setBusy(true);
    const res = await adminSystemApi.createAnnouncement({
      title: form.title,
      body: form.body,
      type: form.type,
      channels: { inApp: form.inApp, email: form.email },
      audience: form.audience,
    });
    setBusy(false);
    if (res.success && res.data) {
      setDone(`Broadcast to ${res.data.recipients} member(s).`);
      setForm({ ...form, title: '', body: '' });
      load();
    } else setError(res.error || 'Failed to broadcast.');
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Megaphone className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Announcements</h1><p className="text-gray-400 text-sm">Broadcast to members (in-app + email)</p></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className={field} />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} placeholder="Message" className={field} />
          <div className="flex flex-wrap items-center gap-4">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
              <option value="info">Info</option><option value="maintenance">Maintenance</option><option value="incident">Incident</option>
            </select>
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as any })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
              <option value="active">Active members</option><option value="all">All members</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.inApp} onChange={(e) => setForm({ ...form, inApp: e.target.checked })} /> In-app</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Email subscribers</label>
            <button onClick={send} disabled={busy} className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Broadcast
            </button>
          </div>
          {error && <p className="text-[#F20732] text-sm">{error}</p>}
          {done && <p className="text-green-400 text-sm">{done}</p>}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400">Recent broadcasts</h2>
          {items.map((a) => (
            <div key={a._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="font-bold">{a.title}</span>
                <span className="text-[10px] uppercase text-gray-500">{a.type}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{a.body}</p>
              <p className="text-xs text-gray-500 mt-2">{a.recipients} recipients · {a.sentBy} · {new Date(a.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {!items.length && <p className="text-gray-500 text-sm py-6">No announcements yet.</p>}
        </section>
      </main>
    </div>
  );
};

export default AnnouncementsPanel;
