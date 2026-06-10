import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, Edit2, Users, Save, X } from 'lucide-react';
import { membersApi, MemberItem, MemberType, MemberPolicy } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const TYPES: MemberType[] = ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];
const POLICIES: MemberPolicy[] = ['Open', 'Selective', 'Restrictive'];

const emptyForm = {
  name: '', asn: '', logo: '', website: '',
  type: 'ISP' as MemberType, peeringPolicy: 'Open' as MemberPolicy,
  capacity: '', joinedDate: '',
  locations: '', featured: false, order: 0, isActive: true,
};

const MembersAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    const res = await membersApi.adminGetAll();
    if (res.success && res.data) setMembers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ ...emptyForm }); setEditingId(null); };

  const startEdit = (m: MemberItem) => {
    setEditingId(m._id);
    setForm({
      name: m.name, asn: m.asn ? String(m.asn) : '', logo: m.logo || '', website: m.website || '',
      type: m.type, peeringPolicy: m.peeringPolicy,
      capacity: m.capacity || '', joinedDate: m.joinedDate ? String(m.joinedDate).slice(0, 10) : '',
      locations: (m.locations || []).join(', '), featured: m.featured, order: m.order, isActive: m.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      asn: form.asn ? Number(form.asn) : undefined,
      logo: form.logo.trim(),
      website: form.website.trim(),
      type: form.type,
      peeringPolicy: form.peeringPolicy,
      capacity: form.capacity.trim(),
      joinedDate: form.joinedDate ? new Date(form.joinedDate).toISOString() : null,
      locations: form.locations.split(',').map((s) => s.trim()).filter(Boolean),
      featured: form.featured,
      order: Number(form.order) || 0,
      isActive: form.isActive,
    };
    const res = editingId ? await membersApi.update(editingId, payload) : await membersApi.create(payload);
    setSaving(false);
    if (res.success) { resetForm(); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this member?')) return;
    await membersApi.delete(id);
    load();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  }

  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div>
              <h1 className="text-xl font-bold">Members</h1>
              <p className="text-gray-400 text-sm">Manage the public member directory</p>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold">{members.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Members</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* form */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{editingId ? 'Edit member' : 'Add member'}</h2>
            {editingId && <button onClick={resetForm} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"><X className="w-4 h-4" /> Cancel</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Network name *" className={field} />
            <input value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} placeholder="ASN (e.g. 15169)" className={field} />
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website URL" className={field} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MemberType })} className={field}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.peeringPolicy} onChange={(e) => setForm({ ...form, peeringPolicy: e.target.value as MemberPolicy })} className={field}>
              {POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Locations (comma separated: Delhi, Mumbai)" className={field} />
            <input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Capacity (e.g. 100G, 2×10G)" className={field} />
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-mono mb-1">Member since</label>
              <input type="date" value={form.joinedDate} onChange={(e) => setForm({ ...form, joinedDate: e.target.value })} className={field} />
            </div>
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} placeholder="Order" className={field} />
          </div>
          <div className="flex flex-wrap items-center gap-5 mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured (show on homepage)</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (visible publicly)</label>
            <button onClick={save} disabled={saving} className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
              {editingId ? 'Save changes' : 'Add member'}
            </button>
          </div>
        </section>

        {/* list */}
        <section className="space-y-2">
          {members.map((m) => (
            <div key={m._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{m.name} {m.featured && <span className="text-[9px] text-[#F20732] uppercase ml-1">★ featured</span>} {!m.isActive && <span className="text-[9px] text-gray-500 uppercase ml-1">hidden</span>}</div>
                <div className="text-xs text-gray-400">{m.asn ? `AS${m.asn} · ` : ''}{m.type} · {m.peeringPolicy}{m.locations?.length ? ` · ${m.locations.join(', ')}` : ''}</div>
              </div>
              <button onClick={() => startEdit(m)} className="p-2 text-gray-400 hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => remove(m._id)} className="p-2 text-gray-400 hover:text-[#F20732] transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {!members.length && <p className="text-gray-500 text-sm text-center py-8">No members yet. Add your first member above.</p>}
        </section>
      </main>
    </div>
  );
};

export default MembersAdminPanel;
