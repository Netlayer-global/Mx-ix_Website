import React, { useCallback, useEffect, useState } from 'react';
import { Globe, RefreshCw, Search, Link2, AlertTriangle, Check } from 'lucide-react';
import {
  adminPeeringDbApi,
  adminFabricApi,
  PeeringDbStatus,
  PdbLookupResult,
  ParticipantDiff,
  InfrastructureItem,
} from '../services/api';
import {
  PanelShell,
  Btn,
  Card,
  CardHeader,
  Table,
  Td,
  Modal,
  Fld,
  Grid,
  Badge,
  StatTile,
  Note,
  Spinner,
  EmptyState,
  field,
  fmtNumber,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

type Tab = 'lookup' | 'participants' | 'sync';

/**
 * PeeringDB integration panel — ASN lookup, member auto-fill, bulk sync aur
 * participant reconciliation (who's in PeeringDB vs who we actually provisioned).
 */
const PeeringDbAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [tab, setTab] = useState<Tab>('lookup');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<PeeringDbStatus | null>(null);
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);

  // Lookup
  const [asnInput, setAsnInput] = useState('');
  const [lookupResult, setLookupResult] = useState<PdbLookupResult | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  // Participants
  const [selectedInfra, setSelectedInfra] = useState('');
  const [diff, setDiff] = useState<ParticipantDiff | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  // Sync
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<{ attempted: number; succeeded: number; failed: number } | null>(null);

  const loadStatus = useCallback(async () => {
    const [sRes, iRes] = await Promise.all([adminPeeringDbApi.status(), adminFabricApi.listInfrastructures()]);
    if (sRes.success && sRes.data) setStatus(sRes.data);
    if (iRes.success && iRes.data) {
      setInfras(iRes.data);
      setSelectedInfra(iRes.data[0]?._id || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const lookup = async () => {
    setError('');
    setLookupResult(null);
    const asn = Number(asnInput);
    if (!asn || asn <= 0) return setError('Enter a valid ASN.');
    setLookupBusy(true);
    const res = await adminPeeringDbApi.lookupAsn(asn);
    setLookupBusy(false);
    if (res.success && res.data) setLookupResult(res.data);
    else setError(res.error || 'PeeringDB lookup failed.');
  };

  const loadDiff = async () => {
    if (!selectedInfra) return;
    setDiff(null);
    setDiffBusy(true);
    const res = await adminPeeringDbApi.participants(selectedInfra);
    setDiffBusy(false);
    if (res.success && res.data) setDiff(res.data);
    else setError(res.error || 'PeeringDB comparison failed.');
  };

  const syncAll = async () => {
    if (!confirm('Sync every active customer from PeeringDB? This runs sequentially and may take a minute.')) return;
    setSyncBusy(true);
    setSyncResult(null);
    const res = await adminPeeringDbApi.syncAll();
    setSyncBusy(false);
    if (res.success && res.data) setSyncResult(res.data);
    else setError(res.error || 'Sync failed.');
  };

  const clearCache = async () => {
    await adminPeeringDbApi.clearCache();
    alert('In-process cache cleared. Next request will hit PeeringDB live.');
  };

  if (loading) return <Spinner label="Checking PeeringDB connection…" />;

  return (
    <PanelShell
      title="PeeringDB"
      subtitle="ASN lookup, member enrichment & participant reconciliation"
      icon={Globe}
      embedded={embedded}
      onBack={onBack}
      actions={
        <Btn icon={RefreshCw} size="sm" onClick={clearCache} title="Clear in-process cache">
          Clear cache
        </Btn>
      }
    >
      {error && <Note tone="error" onDismiss={() => setError('')}>{error}</Note>}

      {/* Connection status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Status"
          value={status?.configured ? (status?.connected ? 'Connected' : 'Error') : 'Not configured'}
          tone={status?.connected ? 'green' : status?.configured ? 'red' : 'gray'}
        />
        <StatTile label="Auth" value={status?.authenticated ? 'Authenticated' : 'Anonymous'} tone={status?.authenticated ? 'green' : 'amber'} hint={!status?.authenticated ? 'Add an API key for higher rate limits' : undefined} />
        <StatTile label="Base URL" value={status?.baseUrl || '—'} />
        <StatTile label="Cache TTL" value={status?.cacheTtlMinutes ? `${status.cacheTtlMinutes}m` : '—'} />
      </div>

      {!status?.configured && (
        <Note tone="warning">
          PeeringDB is not enabled in Settings. Go to Integrations &gt; PeeringDB and enable it. An API key is optional but recommended — without one, PeeringDB rate-limits after a few dozen requests.
        </Note>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['lookup', 'ASN Lookup'],
          ['participants', 'Participant reconciliation'],
          ['sync', 'Bulk sync'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === id ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ASN Lookup ── */}
      {tab === 'lookup' && (
        <>
          <div className="flex gap-2">
            <input
              className={field}
              value={asnInput}
              onChange={(e) => setAsnInput(e.target.value)}
              placeholder="Enter an ASN, e.g. 64500"
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
            <Btn icon={Search} variant="primary" busy={lookupBusy} onClick={lookup}>
              Lookup
            </Btn>
          </div>

          {lookupResult && (
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg">{lookupResult.net?.name || '—'}</h3>
                  <p className="font-mono text-xs text-gray-500">
                    AS{lookupResult.net?.asn} · {lookupResult.net?.info_type || 'Unknown'} · Policy: {lookupResult.net?.policy_general || '—'}
                  </p>
                  {lookupResult.net?.website && (
                    <a href={lookupResult.net.website} target="_blank" rel="noreferrer" className="text-xs text-[#F20732] hover:underline">
                      {lookupResult.net.website}
                    </a>
                  )}
                </div>
                {lookupResult.existingOrganization ? (
                  <Badge tone={lookupResult.existingOrganization.linked ? 'green' : 'amber'}>
                    {lookupResult.existingOrganization.linked ? 'Linked' : 'Exists (not linked)'}
                  </Badge>
                ) : (
                  <Badge tone="gray">New</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile label="Max prefixes v4" value={fmtNumber(lookupResult.net?.info_prefixes4)} />
                <StatTile label="Max prefixes v6" value={fmtNumber(lookupResult.net?.info_prefixes6)} />
                <StatTile label="IRR as-set" value={lookupResult.net?.irr_as_set || '—'} />
                <StatTile label="Traffic" value={lookupResult.net?.info_traffic || '—'} />
              </div>

              {lookupResult.ixPresence?.length > 0 && (
                <>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">IX presence ({lookupResult.ixPresence.length})</p>
                  <Table head={['IX', 'IPv4', 'IPv6', 'Speed', 'RS peer']} dense>
                    {lookupResult.ixPresence.slice(0, 20).map((ix, i) => (
                      <tr key={i}>
                        <Td className="text-xs">{ix.name || `ix #${ix.ixId}`}</Td>
                        <Td className="font-mono text-xs">{ix.ipv4 || '—'}</Td>
                        <Td className="font-mono text-xs">{ix.ipv6 || '—'}</Td>
                        <Td className="font-mono text-xs">{ix.speed ? `${ix.speed / 1000}G` : '—'}</Td>
                        <Td>{ix.isRsPeer ? <Badge tone="green">yes</Badge> : <Badge tone="gray">no</Badge>}</Td>
                      </tr>
                    ))}
                  </Table>
                </>
              )}

              {lookupResult.facilities?.length > 0 && (
                <>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">Facilities ({lookupResult.facilities.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {lookupResult.facilities.map((f, i) => (
                      <Badge key={i} tone="gray">{f.name || `fac #${f.facId}`}{f.city ? `, ${f.city}` : ''}</Badge>
                    ))}
                  </div>
                </>
              )}

              <Note tone="info">
                <strong>proposedPatch</strong> — what a sync would write onto the customer:<br />
                <code className="text-[11px]">{JSON.stringify(lookupResult.proposedPatch, null, 2)}</code>
              </Note>
            </Card>
          )}
        </>
      )}

      {/* ── Participant reconciliation ── */}
      {tab === 'participants' && (
        <>
          <div className="flex gap-2">
            <select className={field} value={selectedInfra} onChange={(e) => setSelectedInfra(e.target.value)}>
              {infras.map((i) => (
                <option key={i._id} value={i._id}>{i.name}</option>
              ))}
            </select>
            <Btn icon={Search} variant="primary" busy={diffBusy} onClick={loadDiff}>
              Compare
            </Btn>
          </div>

          <Note tone="info">
            Compares PeeringDB's ixlan participant list against what we have actually provisioned. Useful for catching stale PeeringDB entries, undeclared presences and members who haven't registered with us yet.
          </Note>

          {diff && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatTile label="PeeringDB" value={diff.counts.peeringDb} />
                <StatTile label="Our peers" value={diff.counts.local} />
                <StatTile label="Matched" value={diff.counts.matched} tone="green" />
                <StatTile label="Mismatched" value={diff.counts.mismatched} tone="amber" />
                <StatTile label="Not provisioned" value={diff.counts.notProvisioned} tone="red" />
              </div>

              {diff.mismatched.length > 0 && (
                <Card>
                  <CardHeader title="Mismatched" hint="Their PeeringDB entry disagrees with what we assigned." />
                  <Table head={['ASN', 'Member', 'Problems']}>
                    {diff.mismatched.map((m) => (
                      <tr key={m.asn}>
                        <Td className="font-mono text-xs font-bold">AS{m.asn}</Td>
                        <Td className="text-sm">{m.name}</Td>
                        <Td className="text-xs text-amber-500">{m.problems.join('; ')}</Td>
                      </tr>
                    ))}
                  </Table>
                </Card>
              )}

              {diff.notProvisioned.length > 0 && (
                <Card>
                  <CardHeader title="In PeeringDB but NOT provisioned here" hint="They claim to be on our IX but we have no peer for them." />
                  <Table head={['ASN', 'Name', 'IPv4', 'IPv6', 'Speed']}>
                    {diff.notProvisioned.map((m) => (
                      <tr key={m.asn}>
                        <Td className="font-mono text-xs font-bold">AS{m.asn}</Td>
                        <Td className="text-sm">{m.name || '—'}</Td>
                        <Td className="font-mono text-xs">{m.ipv4 || '—'}</Td>
                        <Td className="font-mono text-xs">{m.ipv6 || '—'}</Td>
                        <Td className="font-mono text-xs">{m.speed ? `${m.speed / 1000}G` : '—'}</Td>
                      </tr>
                    ))}
                  </Table>
                </Card>
              )}

              {diff.notInPeeringDb.length > 0 && (
                <Card>
                  <CardHeader title="Provisioned here but NOT in PeeringDB" hint="They haven't registered their presence with PeeringDB. Ask them to." />
                  <Table head={['ASN', 'Member']}>
                    {diff.notInPeeringDb.map((m) => (
                      <tr key={m.asn}>
                        <Td className="font-mono text-xs font-bold">AS{m.asn}</Td>
                        <Td className="text-sm">{m.name}</Td>
                      </tr>
                    ))}
                  </Table>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ── Bulk sync ── */}
      {tab === 'sync' && (
        <>
          <Note tone="info">
            Pulls PeeringDB data (max-prefix limits, peering policy, as-set, contacts) for every active customer that has an ASN set. Runs sequentially to avoid PeeringDB's rate limiter.
          </Note>

          <Btn icon={RefreshCw} variant="primary" busy={syncBusy} onClick={syncAll}>
            Sync all members from PeeringDB
          </Btn>

          {syncResult && (
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Attempted" value={syncResult.attempted} />
              <StatTile label="Succeeded" value={syncResult.succeeded} tone="green" />
              <StatTile label="Failed" value={syncResult.failed} tone={syncResult.failed ? 'red' : undefined} />
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
};

export default PeeringDbAdminPanel;
