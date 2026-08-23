import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Pencil, Trash2, Play, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { PanelShell, Card, Btn, Modal, Fld, Grid, Badge, Spinner, EmptyState, field } from './admin/ui';

interface MaintenanceWindow {
  _id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  state: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  notified: boolean;
  createdBy: string;
  notes: string;
  createdAt: string;
}

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

const apiCall = async (path: string, opts?: RequestInit) => {
  const token = localStorage.getItem('mx-ix-token');
  const r = await fetch(`/api/admin/maintenance${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
  });
  return r.json();
};

const MaintenanceAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<MaintenanceWindow | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    affectedComponents: '',
    scheduledStart: '',
    scheduledEnd: '',
    notes: '',
  });

  const load = useCallback(async () => {
    const res = await apiCall('/windows');
    if (res.success && res.data) setWindows(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ title: '', description: '', affectedComponents: '', scheduledStart: '', scheduledEnd: '', notes: '' });
    setModal('new');
  };

  const openEdit = (w: MaintenanceWindow) => {
    setForm({
      title: w.title,
      description: w.description,
      affectedComponents: w.affectedComponents.join(', '),
      scheduledStart: w.scheduledStart.slice(0, 16),
      scheduledEnd: w.scheduledEnd.slice(0, 16),
      notes: w.notes,
    });
    setModal(w);
  };

  const save = async () => {
    setSaving(true);
    const body = {
      title: form.title,
      description: form.description,
      affectedComponents: form.affectedComponents.split(',').map((s) => s.trim()).filter(Boolean),
      scheduledStart: new Date(form.scheduledStart).toISOString(),
      scheduledEnd: new Date(form.scheduledEnd).toISOString(),
      notes: form.notes,
    };
    if (modal === 'new') {
      await apiCall('/windows', { method: 'POST', body: JSON.stringify(body) });
    } else if (modal) {
      await apiCall(`/windows/${modal._id}`, { method: 'PUT', body: JSON.stringify(body) });
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const setState = async (id: string, state: string) => {
    await apiCall(`/windows/${id}`, { method: 'PUT', body: JSON.stringify({ state }) });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this maintenance window?')) return;
    await apiCall(`/windows/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <PanelShell title="Maintenance" subtitle="Planned maintenance windows" icon={Calendar} embedded={embedded} onBack={onBack}><Spinner /></PanelShell>;

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
                  <WindowRow key={w._id} w={w} onEdit={() => openEdit(w)} onDelete={() => del(w._id)} onSetState={(s) => setState(w._id, s)} />
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
                  <WindowRow key={w._id} w={w} onEdit={() => openEdit(w)} onDelete={() => del(w._id)} onSetState={(s) => setState(w._id, s)} />
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
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={field} />
            </Fld>
            <Grid cols={2}>
              <Fld label="Start">
                <input type="datetime-local" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} className={field} />
              </Fld>
              <Fld label="End">
                <input type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} className={field} />
              </Fld>
            </Grid>
            <Fld label="Affected components (comma separated)">
              <input value={form.affectedComponents} onChange={(e) => setForm({ ...form, affectedComponents: e.target.value })} placeholder="RS1, RS2, VLAN 100" className={field} />
            </Fld>
            <Fld label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={field} />
            </Fld>
            <div className="flex justify-end pt-2">
              <Btn icon={saving ? Loader2 : CheckCircle2} onClick={save} disabled={saving || !form.title || !form.scheduledStart || !form.scheduledEnd}>
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
  w: MaintenanceWindow;
  onEdit: () => void;
  onDelete: () => void;
  onSetState: (s: string) => void;
}> = ({ w, onEdit, onDelete, onSetState }) => {
  const sb = STATE_BADGE[w.state] || STATE_BADGE.scheduled;
  return (
    <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{w.title}</span>
          <Badge tone={sb.tone}>{sb.label}</Badge>
        </div>
        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(w.scheduledStart).toLocaleString()} → {new Date(w.scheduledEnd).toLocaleString()}</span>
          {w.affectedComponents.length > 0 && <span>Affects: {w.affectedComponents.join(', ')}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {w.state === 'scheduled' && <Btn icon={Play} size="sm" onClick={() => onSetState('in-progress')}>Start</Btn>}
        {w.state === 'in-progress' && <Btn icon={CheckCircle2} size="sm" onClick={() => onSetState('completed')}>Complete</Btn>}
        {(w.state === 'scheduled' || w.state === 'in-progress') && <Btn icon={XCircle} size="sm" variant="ghost" onClick={() => onSetState('cancelled')}>Cancel</Btn>}
        <Btn icon={Pencil} size="sm" variant="ghost" onClick={onEdit} />
        <Btn icon={Trash2} size="sm" variant="danger" onClick={onDelete} />
      </div>
    </div>
  );
};

export default MaintenanceAdminPanel;
