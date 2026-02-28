import { useEffect, useState } from 'react';
import axios from 'axios';
import { invoicesApi, competitionsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { PricingTier, CompetitionPricing, MultiDancePricing, InvoiceSummary, PersonInvoice, PartnershipGroup } from '../../types';
import { Skeleton } from '../../components/Skeleton';

const DANCE_COUNTS = ['2', '3', '4', '5'];

const emptyPricing: CompetitionPricing = {
  singleDance: [{ minEntries: 1, pricePerEntry: 0 }],
  multiDance: { mode: 'flat', flatTiers: [{ minEntries: 1, pricePerEntry: 0 }] },
  scholarship: [{ minEntries: 1, pricePerEntry: 0 }],
};

// ─── Tier Table Editor ───

const TierTable = ({
  tiers,
  onChange,
  label,
  currency = 'USD',
}: {
  tiers: PricingTier[];
  onChange: (tiers: PricingTier[]) => void;
  label: string;
  currency?: string;
}) => {
  const update = (idx: number, field: keyof PricingTier, value: string) => {
    const next = [...tiers];
    next[idx] = { ...next[idx], [field]: Number(value) || 0 };
    onChange(next);
  };

  return (
    <div className="mb-3">
      {label && <div className="font-semibold text-sm mb-1.5">{label}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-2 py-1">Min Entries</th>
            <th className="text-left px-2 py-1">Price Per Entry ({currency})</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, idx) => (
            <tr key={idx}>
              <td className="px-2 py-1">
                <input
                  type="number"
                  min="0"
                  value={tier.minEntries}
                  onChange={e => update(idx, 'minEntries', e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.pricePerEntry}
                  onChange={e => update(idx, 'pricePerEntry', e.target.value)}
                  className="w-[100px] px-2 py-1 border border-gray-200 rounded text-sm"
                />
              </td>
              <td>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(tiers.filter((_, i) => i !== idx))}
                    className="bg-transparent border-none text-danger-500 cursor-pointer text-base"
                  >
                    x
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => onChange([...tiers, { minEntries: 0, pricePerEntry: 0 }])}
        className="mt-1.5 px-3 py-1 text-[0.8125rem] border border-gray-300 rounded bg-white cursor-pointer"
      >
        + Add Tier
      </button>
    </div>
  );
};

// ─── Main Page ───

const InvoicesPage = () => {
  const { activeCompetition, setActiveCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<number | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);

  // Pricing state
  const [singleTiers, setSingleTiers] = useState<PricingTier[]>([]);
  const [multiMode, setMultiMode] = useState<'flat' | 'per-dance-count'>('flat');
  const [multiFlatTiers, setMultiFlatTiers] = useState<PricingTier[]>([]);
  const [multiPerDanceTiers, setMultiPerDanceTiers] = useState<Record<string, PricingTier[]>>({});
  const [scholarshipTiers, setScholarshipTiers] = useState<PricingTier[]>([]);

  useEffect(() => {
    if (!competitionId) return;
    initPricing();
    loadInvoices();
  }, [competitionId]);

  const initPricing = () => {
    const p = activeCompetition?.pricing || emptyPricing;
    setSingleTiers(p.singleDance.length > 0 ? p.singleDance : emptyPricing.singleDance);
    setMultiMode(p.multiDance.mode || 'flat');
    setMultiFlatTiers(p.multiDance.flatTiers?.length ? p.multiDance.flatTiers : emptyPricing.multiDance.flatTiers!);
    const pdc: Record<string, PricingTier[]> = {};
    for (const dc of DANCE_COUNTS) {
      pdc[dc] = p.multiDance.perDanceCountTiers?.[dc]?.length
        ? p.multiDance.perDanceCountTiers[dc]
        : [{ minEntries: 1, pricePerEntry: 0 }];
    }
    setMultiPerDanceTiers(pdc);
    setScholarshipTiers(p.scholarship.length > 0 ? p.scholarship : emptyPricing.scholarship);
  };

  const loadInvoices = async () => {
    try {
      const res = await invoicesApi.getSummary(competitionId);
      setSummary(res.data);
    } catch {
      // no invoices yet
    } finally {
      setLoading(false);
    }
  };

  const savePricing = async () => {
    setSavingPricing(true);
    const multiDance: MultiDancePricing = {
      mode: multiMode,
      flatTiers: multiFlatTiers,
      perDanceCountTiers: multiPerDanceTiers,
    };
    const pricing: CompetitionPricing = {
      singleDance: singleTiers,
      multiDance,
      scholarship: scholarshipTiers,
    };
    try {
      const res = await competitionsApi.update(competitionId, { pricing });
      setActiveCompetition(res.data);
      await loadInvoices();
    } catch {
      alert('Failed to save pricing');
    } finally {
      setSavingPricing(false);
    }
  };

  const payEntries = async (entries: Array<{ eventId: number; bib: number }>, paid: boolean, paidBy?: number) => {
    try {
      await invoicesApi.updatePayment(competitionId, entries, paid, paidBy);
      await loadInvoices();
    } catch {
      alert('Failed to update payment');
    }
  };

  const downloadPDF = async (personId: number, personName: string) => {
    try {
      const res = await invoicesApi.downloadPDF(competitionId, personId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF');
    }
  };

  const emailInvoice = async (personId: number) => {
    try {
      const res = await invoicesApi.emailInvoice(competitionId, personId);
      alert(`Invoice emailed to ${res.data.sentTo}`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to send email' : 'Failed to send email';
      alert(msg);
    }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto p-8">
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="table" rows={5} cols={6} />
    </div>
  );

  const hasPricing = !!activeCompetition?.pricing;
  const currency = activeCompetition?.currency || 'USD';
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* ─── Pricing Configuration ─── */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div
          className="flex justify-between items-center cursor-pointer select-none"
          onClick={() => setPricingOpen(!pricingOpen)}
        >
          <h3 className="m-0">
            <span className="mr-2 text-gray-400">{pricingOpen ? '▾' : '▸'}</span>
            Pricing Configuration
          </h3>
          {hasPricing && <span className="text-[0.8125rem] text-success-500">Configured</span>}
        </div>

        {pricingOpen && (
          <div className="mt-4">
            <h4 className="mb-2 text-gray-600">Single Dance</h4>
            <TierTable tiers={singleTiers} onChange={setSingleTiers} label="" currency={currency} />

            <hr className="my-4 border-none border-t border-gray-200" />

            <h4 className="mb-2 text-gray-600">Multi-Dance</h4>
            <div className="flex gap-2 mb-3">
              {(['flat', 'per-dance-count'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiMode(m)}
                  className={multiMode === m
                    ? 'px-3 py-1.5 border-2 border-primary-500 rounded bg-primary-500 text-white cursor-pointer text-[0.8125rem] font-semibold'
                    : 'px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 cursor-pointer text-[0.8125rem]'
                  }
                >
                  {m === 'flat' ? 'Flat Rate' : 'By Dance Count'}
                </button>
              ))}
            </div>

            {multiMode === 'flat' ? (
              <TierTable tiers={multiFlatTiers} onChange={setMultiFlatTiers} label="" currency={currency} />
            ) : (
              <div className="flex flex-col gap-2">
                {DANCE_COUNTS.map(dc => (
                  <TierTable
                    key={dc}
                    tiers={multiPerDanceTiers[dc] || []}
                    onChange={t => setMultiPerDanceTiers(prev => ({ ...prev, [dc]: t }))}
                    label={`${dc}-dance events`}
                    currency={currency}
                  />
                ))}
              </div>
            )}

            <hr className="my-4 border-none border-t border-gray-200" />

            <h4 className="mb-2 text-gray-600">Scholarship</h4>
            <TierTable tiers={scholarshipTiers} onChange={setScholarshipTiers} label="" currency={currency} />

            <button
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
              onClick={savePricing}
              disabled={savingPricing}
            >
              {savingPricing ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Summary Stats ─── */}
      {summary && (
        <div className="flex gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-6 flex-1 text-center">
            <div className="text-[0.8125rem] text-gray-500 mb-1">Total Revenue</div>
            <div className="text-2xl font-bold">{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 flex-1 text-center">
            <div className="text-[0.8125rem] text-gray-500 mb-1">Paid</div>
            <div className="text-2xl font-bold text-success-500">{fmt(summary.totalPaid)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 flex-1 text-center">
            <div className="text-[0.8125rem] text-gray-500 mb-1">Outstanding</div>
            <div className={`text-2xl font-bold ${summary.totalOutstanding > 0 ? 'text-yellow-600' : 'text-success-500'}`}>
              {fmt(summary.totalOutstanding)}
            </div>
          </div>
        </div>
      )}

      {/* ─── Invoice Table ─── */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="mb-4">Invoices</h3>

        {!hasPricing ? (
          <div className="text-center p-8 text-gray-500">
            <p className="mb-2 font-semibold">No pricing configured</p>
            <p>Open the Pricing Configuration section above to set entry prices.</p>
          </div>
        ) : !summary || summary.invoices.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p>No entries found. Add participants to events to generate invoices.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Name</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Status</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Entries</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Total</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Paid</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Outstanding</th>
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.invoices.map(inv => (
                <InvoiceRow
                  key={inv.personId}
                  invoice={inv}
                  expanded={expandedPerson === inv.personId}
                  onToggle={() => setExpandedPerson(expandedPerson === inv.personId ? null : inv.personId)}
                  onPayEntries={payEntries}
                  onDownloadPDF={downloadPDF}
                  onEmailInvoice={emailInvoice}
                  fmt={fmt}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-200">
                <td className="px-2 py-3">Total ({summary.invoices.length} people)</td>
                <td></td>
                <td className="text-right px-2 py-3">
                  {summary.invoices.reduce((s, i) => s + i.partnerships.reduce((ps, p) => ps + p.lineItems.length, 0), 0)}
                </td>
                <td className="text-right px-2 py-3">{fmt(summary.totalRevenue)}</td>
                <td className="text-right px-2 py-3 text-success-500">{fmt(summary.totalPaid)}</td>
                <td className={`text-right px-2 py-3 ${summary.totalOutstanding > 0 ? 'text-yellow-600' : 'text-success-500'}`}>
                  {fmt(summary.totalOutstanding)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Invoice Row (with expand/collapse) ───

const InvoiceRow = ({
  invoice,
  expanded,
  onToggle,
  onPayEntries,
  onDownloadPDF,
  onEmailInvoice,
  fmt,
}: {
  invoice: PersonInvoice;
  expanded: boolean;
  onToggle: () => void;
  onPayEntries: (entries: Array<{ eventId: number; bib: number }>, paid: boolean, paidBy?: number) => Promise<void>;
  onDownloadPDF: (personId: number, personName: string) => Promise<void>;
  onEmailInvoice: (personId: number) => Promise<void>;
  fmt: (n: number) => string;
}) => {
  const totalEntries = invoice.partnerships.reduce((s, p) => s + p.lineItems.length, 0);
  const allPaid = invoice.outstandingAmount === 0 && invoice.totalAmount > 0;
  const statusLabel = invoice.personStatus === 'professional' ? 'Pro' : 'Student';
  const statusColor = invoice.personStatus === 'professional' ? 'text-primary-500' : 'text-gray-700';

  const unpaidEntries = invoice.partnerships.flatMap(p =>
    p.lineItems.filter(item => !item.paid).map(item => ({ eventId: item.eventId, bib: item.bib }))
  );
  const paidEntries = invoice.partnerships.flatMap(p =>
    p.lineItems.filter(item => item.paid).map(item => ({ eventId: item.eventId, bib: item.bib }))
  );

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer ${expanded ? 'bg-gray-50' : ''}`}
      >
        <td className="px-2 py-2">
          <span className="mr-2 text-gray-400 text-xs">{expanded ? '▾' : '▸'}</span>
          {invoice.personName}
        </td>
        <td className="px-2 py-2">
          <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
        </td>
        <td className="text-right px-2 py-2">{totalEntries}</td>
        <td className="text-right px-2 py-2 font-semibold">{fmt(invoice.totalAmount)}</td>
        <td className="text-right px-2 py-2 text-success-500">{fmt(invoice.paidAmount)}</td>
        <td className={`text-right px-2 py-2 font-semibold ${invoice.outstandingAmount > 0 ? 'text-yellow-600' : 'text-success-500'}`}>
          {fmt(invoice.outstandingAmount)}
        </td>
        <td className="text-center px-2 py-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5 justify-center items-center flex-wrap">
            {allPaid ? (
              <>
                <span className="text-success-500 font-semibold text-[0.8125rem]">Paid</span>
                <button
                  onClick={() => onPayEntries(paidEntries, false)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white cursor-pointer text-danger-500 hover:bg-gray-50"
                >
                  Undo
                </button>
              </>
            ) : (
              <button
                className="px-2 py-1 text-xs bg-primary-500 text-white rounded border-none cursor-pointer font-medium transition-colors hover:bg-primary-600"
                onClick={() => onPayEntries(unpaidEntries, true, invoice.personId)}
              >
                Pay All
              </button>
            )}
            <button
              onClick={() => onDownloadPDF(invoice.personId, invoice.personName)}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white cursor-pointer text-gray-600 hover:bg-gray-50"
            >
              PDF
            </button>
            <button
              onClick={() => onEmailInvoice(invoice.personId)}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white cursor-pointer text-gray-600 hover:bg-gray-50"
            >
              Email
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-2 pb-3 pl-6 bg-gray-50">
            {invoice.partnerships.map(partnership => (
              <PartnershipSection
                key={partnership.bib}
                partnership={partnership}
                personId={invoice.personId}
                onPayEntries={onPayEntries}
                fmt={fmt}
              />
            ))}
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Partnership Section ───

const PartnershipSection = ({
  partnership,
  personId,
  onPayEntries,
  fmt,
}: {
  partnership: PartnershipGroup;
  personId: number;
  onPayEntries: (entries: Array<{ eventId: number; bib: number }>, paid: boolean, paidBy?: number) => Promise<void>;
  fmt: (n: number) => string;
}) => {
  const categoryLabel: Record<string, string> = { single: 'Single', multi: 'Multi', scholarship: 'Scholarship' };
  const allPaid = partnership.paidAmount === partnership.subtotal && partnership.subtotal > 0;
  const unpaidEntries = partnership.lineItems
    .filter(item => !item.paid)
    .map(item => ({ eventId: item.eventId, bib: item.bib }));

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1.5 pt-2">
        <div className="font-semibold text-sm text-gray-600">
          w/ {partnership.partnerName} <span className="text-gray-400 font-normal">(Bib #{partnership.bib})</span>
          <span className="ml-3 text-gray-500 font-normal text-[0.8125rem]">
            {partnership.lineItems.length} entries — {fmt(partnership.subtotal)}
          </span>
        </div>
        {allPaid ? (
          <div className="flex gap-1.5 items-center">
            <span className="text-success-500 font-semibold text-xs">Paid</span>
            <button
              onClick={() => onPayEntries(
                partnership.lineItems.filter(i => i.paid).map(i => ({ eventId: i.eventId, bib: i.bib })),
                false,
              )}
              className="px-2 py-0.5 text-[0.7rem] border border-gray-300 rounded bg-white cursor-pointer text-danger-500 hover:bg-gray-50"
            >
              Undo
            </button>
          </div>
        ) : unpaidEntries.length > 0 ? (
          <button
            className="px-2 py-0.5 text-[0.7rem] bg-primary-500 text-white rounded border-none cursor-pointer font-medium transition-colors hover:bg-primary-600"
            onClick={() => onPayEntries(unpaidEntries, true, personId)}
          >
            Pay Partnership
          </button>
        ) : null}
      </div>
      <table className="w-full text-[0.8125rem]">
        <thead>
          <tr className="text-gray-500">
            <th className="text-center px-2 py-1 font-medium w-[30px]">Paid</th>
            <th className="text-left px-2 py-1 font-medium">Event</th>
            <th className="text-left px-2 py-1 font-medium">Category</th>
            <th className="text-right px-2 py-1 font-medium">Dances</th>
            <th className="text-right px-2 py-1 font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {partnership.lineItems.map((item) => (
            <tr key={`${item.eventId}:${item.bib}`}>
              <td className="text-center px-2 py-1">
                <input
                  type="checkbox"
                  checked={item.paid}
                  onChange={() => onPayEntries([{ eventId: item.eventId, bib: item.bib }], !item.paid, personId)}
                  className="cursor-pointer w-4 h-4"
                />
              </td>
              <td className={`px-2 py-1 ${item.paid ? 'line-through text-gray-400' : ''}`}>
                {item.eventName}
              </td>
              <td className={`px-2 py-1 ${item.paid ? 'text-gray-400' : ''}`}>{categoryLabel[item.category]}</td>
              <td className={`text-right px-2 py-1 ${item.paid ? 'text-gray-400' : ''}`}>{item.danceCount}</td>
              <td className={`text-right px-2 py-1 ${item.paid ? 'text-gray-400' : ''}`}>{fmt(item.pricePerEntry)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold border-t border-gray-200">
            <td></td>
            <td colSpan={3} className="px-2 py-1">Subtotal</td>
            <td className="text-right px-2 py-1">{fmt(partnership.subtotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default InvoicesPage;
