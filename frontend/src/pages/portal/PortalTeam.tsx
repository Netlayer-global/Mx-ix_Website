import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, UserPlus, Trash2, ShieldCheck, X } from 'lucide-react';
import { portalTeamApi, TeamMember, PortalUserInfo, PortalRole } from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

interface Props {
  user: PortalUserInfo;
}

const ROLES: PortalRole[] = ['admin', 'viewer', 'billing'];
const ROLE_TONE: Record<PortalRole, 'red' | 'gray' | 'amber'> = { admin: 'red', viewer: 'gray', billing: 'amber' };

const PortalTeam: React.FC<Props> = ({ user }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' as PortalRole });

  const isAdmin = user.role === 'admin';

  const load = useCallback(async () => {
    const res = await portalTeamApi.list();
    if (res.success && res.data) setMembers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    const res = await portalTeamApi.add(form);
    setSaving(false);
    if (res.success) {
      setForm({ name: '', email: '', password: '', role: 'viewer' });
      setShowAdd(false);
      load();
    } else {
      setError(res.error || 'Failed to add member.');
    }
  };

  const changeRole = async (m: TeamMember, role: PortalRole) => {
    await portalTeamApi.update(m.id, { role });
    load();
  };

  const toggleActive = async (m: TeamMember) => {
    await portalTeamApi.update(m.id, { isActive: !m.isActive });
    load();
  };

  const remove = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.name}'s access?`)) return;
    await portalTeamApi.remove(m.id);
    load();
  };

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink placeholder-gray-400 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeading
          eyebrow="// Team"
          title="Team & Access"
          subtitle="Manage who can access your MX-IX portal. Roles: admin (full), viewer (read-only), billing (invoices)."
        />
        {isAdmin && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors hover-trigger"
          >
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="border border-gray-200 bg-gray-50 px-5 py-3 mb-6 flex items-center gap-2 text-sm text-gray-500">
          <ShieldCheck className="w-4 h-4 text-gray-400" /> You have {user.role} access — only admins can change team
          membership.
        </div>
      )}

      {showAdd && isAdmin && (
        <section className="bg-white border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-label tracking-label uppercase text-ink">New team member</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputClass} />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (min 8)" className={inputClass} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PortalRole })} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-[#F20732] font-mono text-xs mt-3">{error}</p>}
          <div className="flex justify-end mt-4">
            <button
              onClick={add}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Add
            </button>
          </div>
        </section>
      )}

      {members.length ? (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {members.map((m) => {
            const self = m.id === user.id;
            return (
              <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-ink text-white flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
                  {(m.name || m.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {m.name} {self && <span className="text-gray-400 font-normal">(you)</span>}
                    {!m.isActive && <span className="ml-2 font-mono text-label-sm uppercase text-gray-400">disabled</span>}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5 truncate">
                    {m.email}
                    {m.lastLogin ? ` · last login ${new Date(m.lastLogin).toLocaleDateString()}` : ' · never logged in'}
                  </p>
                </div>

                {isAdmin && !self ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as PortalRole)}
                    className="bg-white border border-gray-300 px-2 py-1.5 font-mono text-label-sm uppercase tracking-mono focus:outline-none focus:border-[#F20732]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={ROLE_TONE[m.role]}>{m.role}</Badge>
                )}

                {isAdmin && !self && (
                  <>
                    <button
                      onClick={() => toggleActive(m)}
                      className="font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-ink transition-colors hover-trigger"
                    >
                      {m.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(m)} className="p-1.5 text-gray-400 hover:text-[#F20732] transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Users className="w-10 h-10" />} title="No team members" />
      )}
    </div>
  );
};

export default PortalTeam;
