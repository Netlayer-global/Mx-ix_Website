import React, { useEffect, useState } from 'react';
import { ChevronLeft, Loader2, ScrollText, ChevronDown } from 'lucide-react';
import { adminSystemApi, AuditEntry } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const AuditLogPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminSystemApi.getAudit(200);
      if (res.success && res.data) setLogs(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><ScrollText className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">Audit Log</h1><p className="text-gray-400 text-sm">Admin actions with before/after</p></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-2">
        {logs.map((l) => {
          const hasDiff = l.before || l.after;
          const isOpen = open === l._id;
          return (
            <div key={l._id} className="bg-gray-800 border border-gray-700 rounded-lg">
              <button onClick={() => hasDiff && setOpen(isOpen ? null : l._id)} className="w-full p-4 flex items-center gap-3 text-left">
                <span className="font-mono text-[11px] px-2 py-0.5 bg-gray-700 rounded uppercase tracking-wider">{l.action}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{l.resource}{l.resourceId ? ` · ${l.resourceId.slice(-6)}` : ''}</div>
                  <div className="text-xs text-gray-400">{l.actor} · {new Date(l.createdAt).toLocaleString()}</div>
                </div>
                {hasDiff && <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
              </button>
              {isOpen && (
                <div className="border-t border-gray-700 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div><div className="text-gray-500 uppercase mb-1">Before</div><pre className="bg-gray-900 p-2 rounded overflow-x-auto text-gray-300">{JSON.stringify(l.before, null, 2) || '—'}</pre></div>
                  <div><div className="text-gray-500 uppercase mb-1">After</div><pre className="bg-gray-900 p-2 rounded overflow-x-auto text-green-400">{JSON.stringify(l.after, null, 2) || '—'}</pre></div>
                </div>
              )}
            </div>
          );
        })}
        {!logs.length && <p className="text-gray-500 text-sm text-center py-12">No audit entries yet.</p>}
      </main>
    </div>
  );
};

export default AuditLogPanel;
