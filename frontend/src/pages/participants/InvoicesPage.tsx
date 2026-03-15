import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { invoicesApi, competitionsApi, couplesApi, peopleApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { useToast } from '../../context/ToastContext';
import { PricingTier, CompetitionPricing, MultiDancePricing, InvoiceSummary, PersonInvoice, PartnershipGroup, Couple, Person } from '../../types';
import { Skeleton } from '../../components/Skeleton';

type SortField = 'name' | 'entries' | 'total' | 'paid' | 'outstanding';
type SortDir = 'asc' | 'desc';

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
  const { showToast } = useToast();
  const competitionId = activeCompetition?.id || 0;

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<number | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
    loadCouplesAndPeople();
  }, [competitionId]);

  const loadCouplesAndPeople = async () => {
    try {
      const [couplesRes, peopleRes] = await Promise.all([
        couplesApi.getAll(competitionId),
        peopleApi.getAll(competitionId),
      ]);
      const loadedCouples = couplesRes.data;
      const loadedPeople = peopleRes.data;
      setCouples(loadedCouples);
      setPeople(loadedPeople);

      // Auto-assign billing for couples that don't have it set yet
      const personMap = new Map(loadedPeople.map(p => [p.id, p]));
      const toUpdate: Array<{ id: number; billTo: 'leader' | 'follower' }> = [];
      for (const couple of loadedCouples) {
        if (couple.billTo) continue; // already configured
        const leader = personMap.get(couple.leaderId);
        const follower = personMap.get(couple.followerId);
        if (!leader || !follower) continue;
        // Pro-Am: bill the student
        if (leader.status === 'professional' && follower.status === 'student') {
          toUpdate.push({ id: couple.id, billTo: 'follower' });
        } else if (leader.status === 'student' && follower.status === 'professional') {
          toUpdate.push({ id: couple.id, billTo: 'leader' });
        }
      }
      if (toUpdate.length > 0) {
        await Promise.all(toUpdate.map(u => couplesApi.update(u.id, { billTo: u.billTo })));
        const refreshed = await couplesApi.getAll(competitionId);
        setCouples(refreshed.data);
        loadInvoices();
      }
    } catch { /* ignore */ }
  };

  const updateBillTo = async (id: number, billTo: 'split' | 'leader' | 'follower') => {
    try {
      await couplesApi.update(id, { billTo });
      const res = await couplesApi.getAll(competitionId);
      setCouples(res.data);
      await loadInvoices();
    } catch {
      showToast('Failed to update billing', 'error');
    }
  };

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
      showToast('Failed to save pricing', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const payEntries = async (entries: Array<{ eventId: number; bib: number }>, paid: boolean, paidBy?: number) => {
    try {
      await invoicesApi.updatePayment(competitionId, entries, paid, paidBy);
      await loadInvoices();
    } catch {
      showToast('Failed to update payment', 'error');
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
      showToast('Failed to download PDF', 'error');
    }
  };

  const emailInvoice = async (personId: number) => {
    try {
      const res = await invoicesApi.emailInvoice(competitionId, personId);
      showToast(`Invoice emailed to ${res.data.sentTo}`, 'success');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to send email' : 'Failed to send email';
      showToast(msg, 'error');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const { proInvoices, studentInvoices } = useMemo(() => {
    if (!summary) return { proInvoices: [], studentInvoices: [] };
    const getEntryCount = (inv: PersonInvoice) =>
      inv.partnerships.reduce((s, p) => s + p.lineItems.length, 0);
    const sort = (invoices: PersonInvoice[]) =>
      [...invoices].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'name': cmp = a.personName.localeCompare(b.personName); break;
          case 'entries': cmp = getEntryCount(a) - getEntryCount(b); break;
          case 'total': cmp = a.totalAmount - b.totalAmount; break;
          case 'paid': cmp = a.paidAmount - b.paidAmount; break;
          case 'outstanding': cmp = a.outstandingAmount - b.outstandingAmount; break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    return {
      proInvoices: sort(summary.invoices.filter(i => i.personStatus === 'professional')),
      studentInvoices: sort(summary.invoices.filter(i => i.personStatus === 'student')),
    };
  }, [summary, sortField, sortDir]);

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

      {/* ─── Billing Assignment ─── */}
      {couples.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div
            className="flex justify-between items-center cursor-pointer select-none"
            onClick={() => setBillingOpen(!billingOpen)}
          >
            <h3 className="m-0">
              <span className="mr-2 text-gray-400">{billingOpen ? '▾' : '▸'}</span>
              Billing Assignment
            </h3>
          </div>

          {billingOpen && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-4">
                Choose who pays for each partnership. "Split" shows the full amount on both invoices (revenue is only counted once).
                Assigning to one person shows {currency === 'USD' ? '$0' : '0'} on the other's invoice while still listing their entries for reference.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Bib</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Leader</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Follower</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Bill To</th>
                  </tr>
                </thead>
                <tbody>
                  {couples.map(couple => {
                    const current = couple.billTo || 'split';
                    const personMap = new Map(people.map(p => [p.id, p]));
                    const leader = personMap.get(couple.leaderId);
                    const follower = personMap.get(couple.followerId);
                    const isProAm = (leader?.status === 'professional' && follower?.status === 'student')
                      || (leader?.status === 'student' && follower?.status === 'professional');
                    const statusBadge = (status?: string) =>
                      status === 'professional'
                        ? 'text-primary-500 text-[0.7rem] font-semibold'
                        : 'text-gray-400 text-[0.7rem]';
                    const btnCls = (val: string) =>
                      `px-3 py-1.5 text-xs rounded border cursor-pointer font-medium transition-colors ${
                        current === val
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`;
                    return (
                      <tr key={couple.bib} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 font-semibold">#{couple.bib}</td>
                        <td className="px-3 py-2.5">
                          {couple.leaderName}
                          <span className={`ml-1.5 ${statusBadge(leader?.status)}`}>
                            {leader?.status === 'professional' ? 'Pro' : 'Student'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {couple.followerName}
                          <span className={`ml-1.5 ${statusBadge(follower?.status)}`}>
                            {follower?.status === 'professional' ? 'Pro' : 'Student'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5 items-center">
                            <button className={btnCls('split')} onClick={() => updateBillTo(couple.id, 'split')}>
                              Split
                            </button>
                            <button className={btnCls('leader')} onClick={() => updateBillTo(couple.id, 'leader')}>
                              {couple.leaderName.split(' ')[0]}
                            </button>
                            <button className={btnCls('follower')} onClick={() => updateBillTo(couple.id, 'follower')}>
                              {couple.followerName.split(' ')[0]}
                            </button>
                            {isProAm && (
                              <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[0.65rem] font-semibold">
                                Pro-Am
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
                <SortHeader field="name" label="Name" align="left" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader field="entries" label="Entries" align="right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader field="total" label="Total" align="right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader field="paid" label="Paid" align="right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader field="outstanding" label="Outstanding" align="right" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proInvoices.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="px-2 pt-4 pb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary-500">
                        Professional ({proInvoices.length})
                      </span>
                      <span className="ml-3 text-xs text-gray-400">
                        Revenue generated: {fmt(proInvoices.reduce((sum, inv) => sum + inv.partnerships.reduce((s, p) => s + p.subtotal, 0), 0))}
                      </span>
                    </td>
                  </tr>
                  {proInvoices.map(inv => (
                    <InvoiceRow
                      key={inv.personId}
                      invoice={inv}
                      expanded={expandedPerson === inv.personId}
                      onToggle={() => setExpandedPerson(expandedPerson === inv.personId ? null : inv.personId)}
                      onPayEntries={payEntries}
                      onDownloadPDF={downloadPDF}
                      onEmailInvoice={emailInvoice}
                      fmt={fmt}
                      showRevenue
                    />
                  ))}
                </>
              )}
              {studentInvoices.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="px-2 pt-4 pb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Student ({studentInvoices.length})
                      </span>
                    </td>
                  </tr>
                  {studentInvoices.map(inv => (
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
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-200">
                <td className="px-2 py-3">Total ({summary.invoices.length} people)</td>
                <td className="text-right px-2 py-3">
                  {(() => {
                    const seen = new Set<string>();
                    for (const inv of summary.invoices) {
                      for (const p of inv.partnerships) {
                        for (const item of p.lineItems) {
                          seen.add(`${item.eventId}:${item.bib}`);
                        }
                      }
                    }
                    return seen.size;
                  })()}
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

// ─── Sortable Column Header ───

const SortHeader = ({
  field,
  label,
  align,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  align: 'left' | 'right';
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) => {
  const active = sortField === field;
  const arrow = active ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return (
    <th
      className={`text-${align} px-3 py-2 font-medium cursor-pointer select-none hover:text-gray-800 ${active ? 'text-gray-800' : 'text-gray-500'}`}
      onClick={() => onSort(field)}
    >
      {label}{arrow}
    </th>
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
  showRevenue,
}: {
  invoice: PersonInvoice;
  expanded: boolean;
  onToggle: () => void;
  onPayEntries: (entries: Array<{ eventId: number; bib: number }>, paid: boolean, paidBy?: number) => Promise<void>;
  onDownloadPDF: (personId: number, personName: string) => Promise<void>;
  onEmailInvoice: (personId: number) => Promise<void>;
  fmt: (n: number) => string;
  showRevenue?: boolean;
}) => {
  const totalEntries = invoice.partnerships.reduce((s, p) => s + p.lineItems.length, 0);
  const allPaid = invoice.outstandingAmount === 0 && invoice.totalAmount > 0;
  const isReferenceOnly = invoice.totalAmount === 0 && invoice.partnerships.some(p => !p.billable);
  // Total revenue this person generates across ALL partnerships (including non-billable)
  const revenueGenerated = invoice.partnerships.reduce((s, p) => s + p.subtotal, 0);

  const billablePartnerships = invoice.partnerships.filter(p => p.billable);
  const unpaidEntries = billablePartnerships.flatMap(p =>
    p.lineItems.filter(item => !item.paid).map(item => ({ eventId: item.eventId, bib: item.bib }))
  );
  const paidEntries = billablePartnerships.flatMap(p =>
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
          {isReferenceOnly && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[0.65rem] font-medium">
              Reference
            </span>
          )}
        </td>
        <td className="text-right px-2 py-2">{totalEntries}</td>
        <td className="text-right px-2 py-2 font-semibold">
          {showRevenue && revenueGenerated > 0 ? (
            <span className="text-primary-600" title="Revenue generated through students">
              {fmt(revenueGenerated)}
            </span>
          ) : (
            fmt(invoice.totalAmount)
          )}
        </td>
        <td className="text-right px-2 py-2 text-success-500">{fmt(invoice.paidAmount)}</td>
        <td className={`text-right px-2 py-2 font-semibold ${invoice.outstandingAmount > 0 ? 'text-yellow-600' : 'text-success-500'}`}>
          {showRevenue && revenueGenerated > 0 ? (
            <span className="text-primary-600">
              {fmt(revenueGenerated - invoice.paidAmount)}
            </span>
          ) : (
            fmt(invoice.outstandingAmount)
          )}
        </td>
        <td className="text-center px-2 py-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5 justify-center items-center flex-wrap">
            {isReferenceOnly ? (
              <span className="text-gray-400 text-[0.8125rem]">No balance</span>
            ) : allPaid ? (
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
          <td colSpan={6} className="px-2 pb-3 pl-6 bg-gray-50">
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
  const allPaid = partnership.billable && partnership.paidAmount === partnership.subtotal && partnership.subtotal > 0;
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
          {!partnership.billable && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[0.65rem] font-medium">
              For reference — billed to {partnership.partnerName}
            </span>
          )}
        </div>
        {partnership.billable && (
          allPaid ? (
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
          ) : null
        )}
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
