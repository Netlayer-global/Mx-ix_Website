import React, { useEffect, useState } from 'react';
import { Loader2, Receipt, FileText, AlertCircle } from 'lucide-react';
import { portalBillingApi, InvoiceItem } from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

const invoiceTone = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'paid') return 'green';
  if (s === 'overdue') return 'red';
  if (s === 'draft') return 'gray';
  return 'amber';
};

const PortalBilling: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [linked, setLinked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    (async () => {
      const res = await portalBillingApi.listInvoices();
      if (res.success && res.data) {
        setConfigured(res.data.configured);
        setLinked(res.data.linked);
        setInvoices(res.data.invoices);
      } else {
        setError(res.error || 'Failed to load invoices.');
      }
      setLoading(false);
    })();
  }, []);

  const openPdf = async (id: string) => {
    setDownloading(id);
    const ok = await portalBillingApi.openInvoicePdf(id);
    setDownloading('');
    if (!ok) setError('Could not open the invoice PDF.');
  };

  const money = (n: number, cur: string) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD' }).format(n || 0);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div>
      <PageHeading
        eyebrow="// Billing"
        title="Billing & Invoices"
        subtitle="Your MX-IX invoices, synced read-only from Zoho Books. Reach out via Support for any billing questions."
      />

      {!configured ? (
        <div className="border border-amber-500/30 bg-amber-500/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-label tracking-label uppercase text-amber-700">Billing not yet available</p>
            <p className="text-sm text-gray-600 mt-1">Online invoices aren't enabled yet. Contact MX-IX for billing details.</p>
          </div>
        </div>
      ) : !linked ? (
        <div className="border border-gray-200 bg-gray-50 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-label tracking-label uppercase text-gray-600">No billing account linked</p>
            <p className="text-sm text-gray-500 mt-1">
              Your account isn't linked to a billing contact yet. Our team will connect it shortly.
            </p>
          </div>
        </div>
      ) : invoices.length ? (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                {['Invoice', 'Date', 'Due', 'Status', 'Total', 'Balance', ''].map((h) => (
                  <th key={h} className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.invoiceId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-bold text-ink">{inv.number}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.date}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.dueDate || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tone={invoiceTone(inv.status)}>{inv.status}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums">{money(inv.total, inv.currency)}</td>
                  <td className="px-5 py-3 font-mono tabular-nums">{money(inv.balance, inv.currency)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openPdf(inv.invoiceId)}
                      disabled={downloading === inv.invoiceId}
                      className="inline-flex items-center gap-1.5 font-mono text-label-sm tracking-mono uppercase text-gray-500 hover:text-[#F20732] transition-colors hover-trigger"
                    >
                      {downloading === inv.invoiceId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<Receipt className="w-10 h-10" />} title="No invoices yet" />
      )}

      {error && <p className="text-[#F20732] font-mono text-xs mt-4">{error}</p>}
    </div>
  );
};

export default PortalBilling;
