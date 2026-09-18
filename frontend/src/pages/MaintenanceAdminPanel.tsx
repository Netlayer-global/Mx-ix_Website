import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Pencil, Trash2, Play, CheckCircle2, XCircle, Loader2, Clock, Send, BellOff } from 'lucide-react';
import { PanelShell, Card, Btn, Modal, Fld, Grid, Badge, Spinner, EmptyState, field } from './admin/ui';
import { adminMaintenanceApi, statusApi, MaintenanceWindowItem, MaintenanceState } from '../services/api';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const STATE_BADGE: Record<string, { tone: 'green' | 'amber' | 'gray' | 'red'; label: string }> = {
  scheduled: { tone: 'amber', label: 'Scheduled' },
  'in-progress': { tone: 'red', label: 'In Progress' },
  completed: { tone: 'green', label: 'Completed' },
  cancelled: { tone: 'gray', label: 'Cancelled' },
};

/** `datetime-local` needs a local-time string, not the UTC ISO value. */
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const MaintenanceAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [windows, setWindows] = useState<MaintenanceWindowItem[]>([]);
  const [componentNames, setComponentNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<MaintenanceWindowItem | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    affectedComponents: [] as string[],
    scheduledStart: '',
    scheduledEnd: '',
    notes: '',
    notify: true,
  });

  const load = useCallback(async () => {
    const [res, comps] = await Promise.all([adminMaintenanceApi.list(), statusApi.listComponents()]);
    if (res.success && res.data) setWindows(res.data);
    else setError(res.error || 'Could not load maintenance windows.');
    if (comps.success && comps.data) setComponentNames(comps.data.map((c) => c.name));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const openCreate = () => {
    setError('');
    setForm({ title: '', description: '', affectedComponents: [], scheduledStart: '', scheduledEnd: '', notes: '', notify: true });
    setModal('new');
  };

  const openEdit = (w: MaintenanceWindowItem) => {
    setError('');
    setForm({
      title: w.title,
      description: w.description || '',
      affectedComponents: w.affectedComponents || [],
      scheduledStart: toLocalInput(w.scheduledStart),
      scheduledEnd: toLocalInput(w.scheduledEnd),
      notes: w.notes || '',
      // Editing defaults to quiet; only time changes are worth re-announcing.
      notify: false,
    });
    setModal(w);
  };

  const toggleComponent = (name: string) =>
    setForm((f) => ({
      ...f,
      affectedComponents: f.affectedComponents.includes(name)
        ? f.affectedComponents.filter((n) => n !== name)
        : [...f.affectedComponents, name],
    }));

  const save = async () => {
    setError('');
    if (new Date(form.scheduledEnd).getTime() <= new Date(form.scheduledStart).getTime()) {
      setError('The end time must be after the start time.');
      return;
    }
    setSaving(true);
    const body = {
      title: form.title,
      description: form.description,
      affectedComponents: form.affectedComponents,
      scheduledStart: new Date(form.scheduledStart).toISOString(),
      scheduledEnd: new Date(form.scheduledEnd).toISOString(),
      notes: form.notes,
      notify: form.notify,
    };
    const res = modal === 'new'
      ? await adminMaintenanceApi.create(body)
      : await adminMaintenanceApi.update((modal as MaintenanceWindowItem)._id, body);
    setSaving(false);
    if (!res.success) {
      setError(res.error || 'Could not save the window.');
      return;
    }
    setModal(null);
    flash(form.notify ? 'Saved — members are being notified.' : 'Saved.');
    load();
  };

  const setState = async (id: string, state: MaintenanceState) => {
    setBusyId(id);
    const res = await adminMaintenanceApi.update(id, { state });
    setBusyId(null);
    if (!res.success) setError(res.error || 'Could not update the window.');
    else load();
  };

  const renotify = async (w: MaintenanceWindowItem) => {
    setBusyId(w._id);
    const res = await adminMaintenanceApi.notify(w._id);
    setBusyId(null);
    if (res.success && res.data) {
      flash(`Notified ${res.data.members} member(s), emailed ${res.data.emailed} NOC address(es).`);
      load();
    } else {
      setError(res.error || 'Could not send notifications.');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this maintenance window?')) return;
    await adminMaintenanceApi.remove(id);
    load();
  };

  if (loading) {
    return (
      <PanelShell title="Maintenance" subtitle="Planned maintenance windows" icon={Calendar} embedded={embedded} onBack={onBack}>
        <Spinner />
      </PanelShell>
    );
  }

  const upcoming = windows.filter((w) => w.state === 'scheduled' || w.state === 'in-progress');
  const past = windows.filter((w) => w.state === 'completed' || w.state === 'cancelled');

  return (
    <PanelShell
      title="Maintenance Windows"
      subtitle="Schedule, notify and track planned maintenance"
      icon={Calendar}
      embedded={embedded}
      onBack={onBack}
      actions={<Btn icon={Plus} onClick={openCreate}>New window</Btn>}
    >
      {toast && (
        <p className="mb-4 rounded border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{toast}</p>
      )}
      {error && (
        <p className="mb-4 rounded border border-[#F20732]/40 bg-[#F20732]/10 px-4 py-3 font-mono text-xs text-[#F20732]">{error}</p>
      )}

      <p className="mb-4 text-xs text-gray-500">
        Scheduled and in-progress windows appear on the public status page and in every member's portal. Members are
        notified in-app and by email when a window is announced, started, completed or cancelled.
      </p>

      {!windows.length ? (
        <EmptyState icon={Calendar} title="No maintenance windows" hint="Create one to schedule and notify members about planned work." />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <Card>
              <div className="px-5 pt-4 pb-2 border-b border-gray-700">
                <h3 className="font-bold">Upcoming &amp; In Progress</h3>
              </div>
              <div className="divide-y divide-gray-700">
                {upcoming.map((w) => (
                  <WindowRow
                    key={w._id}
                    w={w}
                    busy={busyId === w._id}
                    onEdit={() => openEdit(w)}
                    onDelete={() => del(w._id)}
                    onSetState={(s) => setState(w._id, s)}
                    onNotify={() => renotify(w)}
                  />
                ))}
              </div>
            </Card>
          )}

          {past.length > 0 && (
            <Card>
              <div className="px-5 pt-4 pb-2 border-b border-gray-700">
                <h3 className="font-bold text-gray-400">Past</h3>
              </div>
              <div className="divide-y divide-gray-700">
                {past.map((w) => (
                  <WindowRow
                    key={w._id}
                    w={w}
                    busy={busyId === w._id}
                    onEdit={() => openEdit(w)}
                    onDelete={() => del(w._id)}
                    onSetState={(s) => setState(w._id, s)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'new' ? 'Schedule Maintenance' : 'Edit Window'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <Fld label="Title">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Route server upgrade" className={field} />
            </Fld>
            <Fld label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="What will happen, and what members should expect."
                className={field}
              />
            </Fld>
            <Grid cols={2}>
              <Fld label="Start">
                <input type="datetime-local" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} className={field} />
              </Fld>
              <Fld label="End">
                <input type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} className={field} />
              </Fld>
            </Grid>

            <Fld label="Affected components">
              {componentNames.length ? (
                <div className="flex flex-wrap gap-2">
                  {componentNames.map((name) => {
                    const on = form.affectedComponents.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleComponent(name)}
                        className={`cursor-pointer rounded border px-2.5 py-1 text-xs transition-colors ${
                          on ? 'border-[#F20732] bg-[#F20732] text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  No status components defined yet. Add them under IX Operations → System Status so windows can be tied
                  to what members see.
                </p>
              )}
            </Fld>

            <Fld label="Internal notes (not shown to members)">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={field} />
            </Fld>

            <label className="flex cursor-pointer items-start gap-2.5 rounded border border-gray-700 bg-gray-800/60 px-3 py-2.5 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.notify}
                onChange={(e) => setForm({ ...form, notify: e.target.checked })}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#F20732]"
              />
              <span>
                Notify affected members
                <span className="mt-0.5 block text-xs text-gray-500">
                  In-app notification plus an email to each member's NOC address.
                </span>
              </span>
            </label>

            {error && <p className="font-mono text-xs text-[#F20732]">{error}</p>}

            <div className="flex justify-end pt-2">
              <Btn
                icon={saving ? Loader2 : CheckCircle2}
                onClick={save}
                disabled={saving || !form.title || !form.scheduledStart || !form.scheduledEnd}
              >
                {modal === 'new' ? 'Create' : 'Save'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </PanelShell>
  );
};

const WindowRow: React.FC<{
  w: MaintenanceWindowItem;
  busy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetState: (s: MaintenanceState) => void;
  onNotify?: () => void;
}> = ({ w, busy, onEdit, onDelete, onSetState, onNotify }) => {
  const sb = STATE_BADGE[w.state] || STATE_BADGE.scheduled;
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{w.title}</span>
          <Badge tone={sb.tone}>{sb.label}</Badge>
          {!w.notified && (w.state === 'scheduled' || w.state === 'in-progress') && (
            <span
              className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400"
              title="Members have not been told about this window yet"
            >
              <BellOff className="h-3 w-3" /> Not announced
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(w.scheduledStart).toLocaleString()} →{' '}
            {new Date(w.scheduledEnd).toLocaleString()}
          </span>
          {w.affectedComponents.length > 0 && <span>Affects: {w.affectedComponents.join(', ')}</span>}
          {w.notifiedAt && <span>Announced {new Date(w.notifiedAt).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin text-gray-400" />}
        {onNotify && <Btn icon={Send} size="sm" variant="ghost" onClick={onNotify}>{w.notified ? 'Re-announce' : 'Announce'}</Btn>}
        {w.state === 'scheduled' && <Btn icon={Play} size="sm" onClick={() => onSetState('in-progress')}>Start</Btn>}
        {w.state === 'in-progress' && <Btn icon={CheckCircle2} size="sm" onClick={() => onSetState('completed')}>Complete</Btn>}
        {(w.state === 'scheduled' || w.state === 'in-progress') && (
          <Btn icon={XCircle} size="sm" variant="ghost" onClick={() => onSetState('cancelled')}>Cancel</Btn>
        )}
        <Btn icon={Pencil} size="sm" variant="ghost" onClick={onEdit} />
        <Btn icon={Trash2} size="sm" variant="danger" onClick={onDelete} />
      </div>
    </div>
  );
};

export default MaintenanceAdminPanel;
