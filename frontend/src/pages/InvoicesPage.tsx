import { useEffect, useState } from 'react';
import { invoicesApi, competitionsApi } from '../api/client';
import { useCompetition } from '../context/CompetitionContext';
import { PricingTier, CompetitionPricing, MultiDancePricing, InvoiceSummary, PersonInvoice, PartnershipGroup } from '../types';

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
    <div style={{ marginBottom: '0.75rem' }}>
      {label && <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>{label}</div>}
      <table style={{ width: '100%', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Min Entries</th>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Price Per Entry ({currency})</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, idx) => (
            <tr key={idx}>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <input
                  type="number"
                  min="0"
                  value={tier.minEntries}
                  onChange={e => update(idx, 'minEntries', e.target.value)}
                  style={{ width: '80px', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                />
              </td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.pricePerEntry}
                  onChange={e => update(idx, 'pricePerEntry', e.target.value)}
                  style={{ width: '100px', padding: '0.25rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                />
              </td>
              <td>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(tiers.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1rem' }}
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
        style={{
          marginTop: '0.375rem',
          padding: '0.25rem 0.75rem',
          fontSize: '0.8125rem',
          border: '1px solid #cbd5e0',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer',
        }}
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
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to send email';
      alert(msg);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const hasPricing = !!activeCompetition?.pricing;
  const currency = activeCompetition?.currency || 'USD';
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

  return (
    <div className="container">
      {/* ─── Pricing Configuration ─── */}
      <div className="card">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setPricingOpen(!pricingOpen)}
        >
          <h3 style={{ margin: 0 }}>
            <span style={{ marginRight: '0.5rem', color: '#a0aec0' }}>{pricingOpen ? '▾' : '▸'}</span>
            Pricing Configuration
          </h3>
          {hasPricing && <span style={{ fontSize: '0.8125rem', color: '#48bb78' }}>Configured</span>}
        </div>

        {pricingOpen && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#4a5568' }}>Single Dance</h4>
            <TierTable tiers={singleTiers} onChange={setSingleTiers} label="" currency={currency} />

            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

            <h4 style={{ marginBottom: '0.5rem', color: '#4a5568' }}>Multi-Dance</h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {(['flat', 'per-dance-count'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiMode(m)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    border: multiMode === m ? '2px solid #667eea' : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: multiMode === m ? '#667eea' : 'white',
                    color: multiMode === m ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: multiMode === m ? 600 : 400,
                  }}
                >
                  {m === 'flat' ? 'Flat Rate' : 'By Dance Count'}
                </button>
              ))}
            </div>

            {multiMode === 'flat' ? (
              <TierTable tiers={multiFlatTiers} onChange={setMultiFlatTiers} label="" currency={currency} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

            <h4 style={{ marginBottom: '0.5rem', color: '#4a5568' }}>Scholarship</h4>
            <TierTable tiers={scholarshipTiers} onChange={setScholarshipTiers} label="" currency={currency} />

            <button
              className="btn"
              onClick={savePricing}
              disabled={savingPricing}
              style={{ marginTop: '1rem' }}
            >
              {savingPricing ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Summary Stats ─── */}
      {summary && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: '#718096', marginBottom: '0.25rem' }}>Total Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: '#718096', marginBottom: '0.25rem' }}>Paid</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#48bb78' }}>{fmt(summary.totalPaid)}</div>
          </div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: '#718096', marginBottom: '0.25rem' }}>Outstanding</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: summary.totalOutstanding > 0 ? '#d69e2e' : '#48bb78' }}>
              {fmt(summary.totalOutstanding)}
            </div>
          </div>
        </div>
      )}

      {/* ─── Invoice Table ─── */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Invoices</h3>

        {!hasPricing ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>No pricing configured</p>
            <p>Open the Pricing Configuration section above to set entry prices.</p>
          </div>
        ) : !summary || summary.invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            <p>No entries found. Add participants to events to generate invoices.</p>
          </div>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Entries</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
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
              <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>Total ({summary.invoices.length} people)</td>
                <td></td>
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                  {summary.invoices.reduce((s, i) => s + i.partnerships.reduce((ps, p) => ps + p.lineItems.length, 0), 0)}
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{fmt(summary.totalRevenue)}</td>
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: '#48bb78' }}>{fmt(summary.totalPaid)}</td>
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: summary.totalOutstanding > 0 ? '#d69e2e' : '#48bb78' }}>
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
  const statusColor = invoice.personStatus === 'professional' ? '#667eea' : '#4a5568';

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
        style={{ cursor: 'pointer', background: expanded ? '#f7fafc' : undefined }}
      >
        <td style={{ padding: '0.5rem' }}>
          <span style={{ marginRight: '0.5rem', color: '#a0aec0', fontSize: '0.75rem' }}>{expanded ? '▾' : '▸'}</span>
          {invoice.personName}
        </td>
        <td style={{ padding: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>{statusLabel}</span>
        </td>
        <td style={{ textAlign: 'right', padding: '0.5rem' }}>{totalEntries}</td>
        <td style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>{fmt(invoice.totalAmount)}</td>
        <td style={{ textAlign: 'right', padding: '0.5rem', color: '#48bb78' }}>{fmt(invoice.paidAmount)}</td>
        <td style={{ textAlign: 'right', padding: '0.5rem', color: invoice.outstandingAmount > 0 ? '#d69e2e' : '#48bb78', fontWeight: 600 }}>
          {fmt(invoice.outstandingAmount)}
        </td>
        <td style={{ textAlign: 'center', padding: '0.5rem' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {allPaid ? (
              <>
                <span style={{ color: '#48bb78', fontWeight: 600, fontSize: '0.8125rem' }}>Paid</span>
                <button
                  onClick={() => onPayEntries(paidEntries, false)}
                  style={{
                    padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                    border: '1px solid #cbd5e0', borderRadius: '4px',
                    background: 'white', cursor: 'pointer', color: '#e53e3e',
                  }}
                >
                  Undo
                </button>
              </>
            ) : (
              <button
                className="btn"
                onClick={() => onPayEntries(unpaidEntries, true, invoice.personId)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                Pay All
              </button>
            )}
            <button
              onClick={() => onDownloadPDF(invoice.personId, invoice.personName)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                color: '#4a5568',
              }}
            >
              PDF
            </button>
            <button
              onClick={() => onEmailInvoice(invoice.personId)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                color: '#4a5568',
              }}
            >
              Email
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '0 0.5rem 0.75rem 1.5rem', background: '#f7fafc' }}>
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
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem', paddingTop: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#4a5568' }}>
          w/ {partnership.partnerName} <span style={{ color: '#a0aec0', fontWeight: 400 }}>(Bib #{partnership.bib})</span>
          <span style={{ marginLeft: '0.75rem', color: '#718096', fontWeight: 400, fontSize: '0.8125rem' }}>
            {partnership.lineItems.length} entries — {fmt(partnership.subtotal)}
          </span>
        </div>
        {allPaid ? (
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            <span style={{ color: '#48bb78', fontWeight: 600, fontSize: '0.75rem' }}>Paid</span>
            <button
              onClick={() => onPayEntries(
                partnership.lineItems.filter(i => i.paid).map(i => ({ eventId: i.eventId, bib: i.bib })),
                false,
              )}
              style={{
                padding: '0.2rem 0.5rem', fontSize: '0.7rem',
                border: '1px solid #cbd5e0', borderRadius: '4px',
                background: 'white', cursor: 'pointer', color: '#e53e3e',
              }}
            >
              Undo
            </button>
          </div>
        ) : unpaidEntries.length > 0 ? (
          <button
            className="btn"
            onClick={() => onPayEntries(unpaidEntries, true, personId)}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
          >
            Pay Partnership
          </button>
        ) : null}
      </div>
      <table style={{ width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ color: '#718096' }}>
            <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 500, width: '30px' }}>Paid</th>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Event</th>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Category</th>
            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Dances</th>
            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {partnership.lineItems.map((item) => (
            <tr key={`${item.eventId}:${item.bib}`}>
              <td style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>
                <input
                  type="checkbox"
                  checked={item.paid}
                  onChange={() => onPayEntries([{ eventId: item.eventId, bib: item.bib }], !item.paid, personId)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </td>
              <td style={{ padding: '0.25rem 0.5rem', textDecoration: item.paid ? 'line-through' : undefined, color: item.paid ? '#a0aec0' : undefined }}>
                {item.eventName}
              </td>
              <td style={{ padding: '0.25rem 0.5rem', color: item.paid ? '#a0aec0' : undefined }}>{categoryLabel[item.category]}</td>
              <td style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: item.paid ? '#a0aec0' : undefined }}>{item.danceCount}</td>
              <td style={{ textAlign: 'right', padding: '0.25rem 0.5rem', color: item.paid ? '#a0aec0' : undefined }}>{fmt(item.pricePerEntry)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600, borderTop: '1px solid #e2e8f0' }}>
            <td></td>
            <td colSpan={3} style={{ padding: '0.25rem 0.5rem' }}>Subtotal</td>
            <td style={{ textAlign: 'right', padding: '0.25rem 0.5rem' }}>{fmt(partnership.subtotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default InvoicesPage;
