import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, ShieldCheck, UserPlus } from 'lucide-react';
import { adminUsersApi, AdminUser, AdminRole } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const ROLES: AdminRole[] = ['super-admin', 'admin', 'noc', 'billing', 'support', 'editor'];

const AdminUsersPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'support' as AdminRole });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await adminUsersApi.list();
    if (res.success && res.data) setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) { setError('All fields required.'); return; }
    setBusy(true);
    const res = await adminUsersApi.create(form);
    setBusy(false);
    if (res.success) { setForm({ name: '', email: '', password: '', role: 'support' }); load(); }
    else setError(res.error || 'Failed to create admin.');
  };

  const changeRole = async (u: AdminUser, role: AdminRole) => { await adminUsersApi.update(u.id, { role }); load(); };
  const toggle = async (u: AdminUser) => { await adminUsersApi.update(u.id, { isActive: !u.isActive }); load(); };
  const remove = async (id: string) => { if (!confirm('Delete this admin?')) return; await adminUsersApi.remove(id); load(); };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Admin Users</h1><p className="text-gray-400 text-sm">Role-based admin access</p></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add admin</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={field} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={field} />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className={field} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} className={field}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && <p className="text-[#F20732] text-sm mt-3">{error}</p>}
          <div className="flex justify-end mt-4">
            <button onClick={add} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add admin
            </button>
          </div>
        </section>

        <section className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{u.name} {!u.isActive && <span className="text-[10px] uppercase text-gray-500 ml-1">disabled</span>}</div>
                <div className="text-xs text-gray-400">{u.email}</div>
              </div>
              <select value={u.role} onChange={(e) => changeRole(u, e.target.value as AdminRole)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs uppercase">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={() => toggle(u)} className="text-xs font-mono uppercase text-gray-400 hover:text-white">{u.isActive ? 'Disable' : 'Enable'}</button>
              <button onClick={() => remove(u.id)} className="p-2 text-gray-400 hover:text-[#F20732]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default AdminUsersPanel;
