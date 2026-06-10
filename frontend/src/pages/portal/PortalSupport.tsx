import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, LifeBuoy, Plus, Send, ArrowLeft, X, MessageSquare } from 'lucide-react';
import { portalTicketsApi, TicketItem, TicketCategory, TicketPriority } from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

const CATEGORIES: TicketCategory[] = ['technical', 'billing', 'peering', 'provisioning', 'general'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

const statusTone = (s: string) =>
  s === 'resolved' ? 'green' : s === 'closed' ? 'gray' : s === 'pending' ? 'amber' : 'red';
const priorityTone = (p: string) => (p === 'urgent' ? 'red' : p === 'high' ? 'orange' : p === 'low' ? 'gray' : 'amber');

const PortalSupport: React.FC = () => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list');
  const [active, setActive] = useState<TicketItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // new ticket
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [body, setBody] = useState('');
  // reply
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    const res = await portalTicketsApi.list();
    if (res.success && res.data) setTickets(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openThread = async (id: string) => {
    const res = await portalTicketsApi.get(id);
    if (res.success && res.data) {
      setActive(res.data);
      setView('thread');
    }
  };

  const submitNew = async () => {
    setError('');
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.');
      return;
    }
    setBusy(true);
    const res = await portalTicketsApi.create({ subject, category, priority, body });
    setBusy(false);
    if (res.success && res.data) {
      setSubject('');
      setBody('');
      setActive(res.data);
      setView('thread');
      load();
    } else {
      setError(res.error || 'Failed to create ticket.');
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    const res = await portalTicketsApi.reply(active._id, reply);
    setBusy(false);
    if (res.success && res.data) {
      setActive(res.data);
      setReply('');
      load();
    }
  };

  const closeTicket = async () => {
    if (!active) return;
    const res = await portalTicketsApi.close(active._id);
    if (res.success && res.data) {
      setActive(res.data);
      load();
    }
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

  // ── Thread view ──
  if (view === 'thread' && active) {
    return (
      <div>
        <button
          onClick={() => {
            setView('list');
            setActive(null);
          }}
          className="inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-ink transition-colors mb-6 hover-trigger"
        >
          <ArrowLeft className="w-4 h-4" /> All tickets
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-ink">{active.subject}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={statusTone(active.status)}>{active.status}</Badge>
              <Badge tone={priorityTone(active.priority)}>{active.priority}</Badge>
              <span className="font-mono text-xs text-gray-400">#{active._id.slice(-6)} · {active.category}</span>
            </div>
          </div>
          {active.status !== 'closed' && (
            <button
              onClick={closeTicket}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 font-mono text-label-sm tracking-mono uppercase text-gray-500 hover:border-[#F20732] hover:text-[#F20732] transition-colors hover-trigger"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {active.messages.map((m, i) => (
            <div
              key={i}
              className={`border p-4 ${
                m.from === 'staff' ? 'border-[#F20732]/30 bg-[#F20732]/[0.03]' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-label-sm tracking-mono uppercase text-gray-500">
                  {m.from === 'staff' ? 'MX-IX Support' : m.authorName}
                </span>
                <span className="font-mono text-xs text-gray-400">{new Date(m.at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>

        {active.status !== 'closed' ? (
          <div className="bg-white border border-gray-200 p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className={inputClass}
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={sendReply}
                disabled={busy || !reply.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-[#F20732] text-white font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Reply
              </button>
            </div>
          </div>
        ) : (
          <p className="font-mono text-label-sm tracking-mono uppercase text-gray-400">This ticket is closed.</p>
        )}
      </div>
    );
  }

  // ── New ticket view ──
  if (view === 'new') {
    return (
      <div>
        <button
          onClick={() => setView('list')}
          className="inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-ink transition-colors mb-6 hover-trigger"
        >
          <ArrowLeft className="w-4 h-4" /> All tickets
        </button>
        <PageHeading eyebrow="// Support" title="New ticket" />
        <div className="bg-white border border-gray-200 p-5 space-y-4 max-w-2xl">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Describe your issue…" className={inputClass} />
          {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
          <button
            onClick={submitNew}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-3 bg-[#F20732] text-white font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit ticket
          </button>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeading eyebrow="// Support" title="Support" subtitle="Open a ticket and track responses from the MX-IX NOC and support teams." />
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors hover-trigger"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {tickets.length ? (
        <div className="bg-white border border-gray-200 divide-y divide-gray-100">
          {tickets.map((t) => (
            <button
              key={t._id}
              onClick={() => openThread(t._id)}
              className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors hover-trigger"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{t.subject}</p>
                <p className="font-mono text-xs text-gray-400 mt-0.5">
                  #{t._id.slice(-6)} · {t.category} · updated {new Date(t.lastReplyAt).toLocaleDateString()}
                </p>
              </div>
              <span className="flex items-center gap-1 text-gray-400 font-mono text-xs">
                <MessageSquare className="w-3.5 h-3.5" /> {t.messages.length}
              </span>
              <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<LifeBuoy className="w-10 h-10" />} title="No tickets yet" hint="Open a ticket and we'll get back to you." />
      )}
    </div>
  );
};

export default PortalSupport;
