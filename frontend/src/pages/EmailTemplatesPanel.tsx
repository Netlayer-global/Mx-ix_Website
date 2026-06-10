import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Mail, Save, Plus, Trash2 } from 'lucide-react';
import { adminSystemApi, EmailTemplateItem } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const PRESETS = [
  { key: 'password_reset', name: 'Password reset', variables: ['name', 'link'] },
  { key: 'weekly_digest', name: 'Weekly digest', variables: ['name', 'ports', 'openOrders', 'openTickets'] },
  { key: 'announcement', name: 'Announcement', variables: ['title', 'body'] },
  { key: 'order_update', name: 'Order update', variables: ['type', 'status'] },
];

const EmailTemplatesPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [items, setItems] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EmailTemplateItem> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminSystemApi.listTemplates();
    if (res.success && res.data) setItems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.key || !editing?.name) return;
    setBusy(true);
    await adminSystemApi.upsertTemplate(editing);
    setBusy(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => { if (!confirm('Delete template?')) return; await adminSystemApi.deleteTemplate(id); load(); };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Mail className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Email Templates</h1><p className="text-gray-400 text-sm">Manage transactional email content</p></div>
          </div>
          <button onClick={() => setEditing({ key: '', name: '', subject: '', body: '', enabled: true, variables: [] })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628]"><Plus className="w-4 h-4" /> New</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {editing && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={editing.key || ''}
                onChange={(e) => {
                  const p = PRESETS.find((x) => x.key === e.target.value);
                  setEditing({ ...editing, key: e.target.value, name: editing.name || p?.name || '', variables: p?.variables || editing.variables });
                }}
                className={field}
              >
                <option value="">— Select key —</option>
                {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
              </select>
              <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Template name" className={field} />
            </div>
            <input value={editing.subject || ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Subject" className={field} />
            <textarea value={editing.body || ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={6} placeholder="Body (supports {{variables}})" className={field} />
            {editing.variables?.length ? <p className="text-xs text-gray-400 font-mono">Variables: {editing.variables.map((v) => `{{${v}}}`).join(' ')}</p> : null}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={save} disabled={busy || !editing.key} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          {items.map((t) => (
            <div key={t._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{t.name} <span className="text-xs text-gray-500 font-mono">{t.key}</span></div>
                <div className="text-xs text-gray-400 truncate">{t.subject || 'No subject'}</div>
              </div>
              <button onClick={() => setEditing(t)} className="text-xs font-mono uppercase text-gray-400 hover:text-white">Edit</button>
              <button onClick={() => remove(t._id)} className="p-2 text-gray-400 hover:text-[#F20732]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!items.length && <p className="text-gray-500 text-sm text-center py-8">No templates yet. Defaults are used until you add one.</p>}
        </section>
      </main>
    </div>
  );
};

export default EmailTemplatesPanel;
