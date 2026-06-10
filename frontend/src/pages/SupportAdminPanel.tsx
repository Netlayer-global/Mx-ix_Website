import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, LifeBuoy, Send, ArrowLeft } from 'lucide-react';
import { adminTicketsApi, TicketItem, TicketStatus, TicketPriority } from '../services/api';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

const badge = (s: string, kind: 'status' | 'priority') => {
  const status: Record<string, string> = {
    open: 'bg-[#F20732]/15 text-[#F20732] border-[#F20732]/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
    closed: 'bg-gray-600/20 text-gray-400 border-gray-600/40',
  };
  const priority: Record<string, string> = {
    urgent: 'bg-[#F20732]/15 text-[#F20732] border-[#F20732]/30',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    normal: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-gray-600/20 text-gray-400 border-gray-600/40',
  };
  const map = kind === 'status' ? status : priority;
  return <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ${map[s]}`}>{s}</span>;
};

const SupportAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [active, setActive] = useState<TicketItem | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminTicketsApi.list();
    if (res.success && res.data) setTickets(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string) => {
    const res = await adminTicketsApi.get(id);
    if (res.success && res.data) setActive(res.data);
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    const res = await adminTicketsApi.reply(active._id, reply);
    setBusy(false);
    if (res.success && res.data) {
      setActive(res.data);
      setReply('');
      load();
    }
  };

  const update = async (data: { status?: TicketStatus; priority?: TicketPriority; assignedTo?: string }) => {
    if (!active) return;
    const res = await adminTicketsApi.update(active._id, data);
    if (res.success && res.data) {
      setActive({ ...active, ...res.data });
      load();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const field = 'bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

  // ── Thread detail ──
  if (active) {
    const org: any = active.organization;
    return (
      <div className="min-h-screen bg-gray-900 text-white admin-panel">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={() => setActive(null)} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{active.subject}</h1>
              <p className="text-gray-400 text-xs">
                {(active.orgName || org?.name) ?? '—'} · #{active._id.slice(-6)} · {active.category}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* controls */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <label className="text-xs text-gray-400 font-mono uppercase">Status</label>
            <select value={active.status} onChange={(e) => update({ status: e.target.value as TicketStatus })} className={field}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <label className="text-xs text-gray-400 font-mono uppercase">Priority</label>
            <select value={active.priority} onChange={(e) => update({ priority: e.target.value as TicketPriority })} className={field}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              defaultValue={active.assignedTo || ''}
              onBlur={(e) => update({ assignedTo: e.target.value })}
              placeholder="Assign to (email)"
              className={`${field} flex-1 min-w-[160px]`}
            />
          </div>

          {/* messages */}
          <div className="space-y-3">
            {active.messages.map((m, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 ${
                  m.from === 'staff' ? 'border-[#F20732]/30 bg-[#F20732]/5' : 'border-gray-700 bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                    {m.from === 'staff' ? `Staff · ${m.authorName}` : m.authorName}
                  </span>
                  <span className="font-mono text-[10px] text-gray-500">{new Date(m.at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>

          {/* reply */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Reply to the member…"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={sendReply}
                disabled={busy || !reply.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send reply
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── List ──
  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);
  const openCount = tickets.filter((t) => t.status === 'open').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Support Desk</h1>
              <p className="text-gray-400 text-sm">Member tickets &amp; responses</p>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold">{openCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Open</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', ...STATUSES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          {filtered.map((t) => (
            <button
              key={t._id}
              onClick={() => open(t._id)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4 text-left hover:border-gray-500 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{t.subject}</span>
                  {badge(t.priority, 'priority')}
                  {badge(t.status, 'status')}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {t.orgName}{t.orgAsn ? ` · AS${t.orgAsn}` : ''} · {t.category} · {t.messageCount ?? t.messages?.length} msgs · updated {new Date(t.lastReplyAt).toLocaleDateString()}
                  {t.assignedTo ? ` · ${t.assignedTo}` : ''}
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && (
            <p className="text-gray-500 text-sm text-center py-12">No tickets{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default SupportAdminPanel;
