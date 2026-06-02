'use strict';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function pct(ratio) {
  if (ratio === null || ratio === undefined) return '';
  return (ratio * 100).toFixed(2) + '%';
}

function resultLabel(code) {
  const map = {
    pfic_yes: 'PFIC — Yes',
    pfic_no: 'PFIC — No',
    unable_to_determine: 'Unable to Determine from Pulled Data',
    not_suitable: 'Security Type Not Suitable for Corporate PFIC Test',
    manual_review: 'Manual Review Required',
  };
  return map[code] || code || '';
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function filterResults(results, filter) {
  if (!filter || filter === 'all') return results;
  return results.filter(r => r.pficResult === filter);
}

// ─── Full results CSV ─────────────────────────────────────────────────────────

const FULL_HEADERS = [
  'Ticker', 'Company Name', 'Exchange', 'Country', 'Entity Type', 'Currency',
  'Fiscal Year End', 'Income Period',
  'Total Revenue', 'Interest Income', 'Net Investment Income',
  'Dividend Income', 'Realized Gains', 'Other Income/Expense (Net)',
  'Passive Income (Calculated)', 'Income Test Ratio', 'Income Test Result',
  'Q1 Date', 'Q1 Total Assets', 'Q1 Passive Assets',
  'Q2 Date', 'Q2 Total Assets', 'Q2 Passive Assets',
  'Q3 Date', 'Q3 Total Assets', 'Q3 Passive Assets',
  'Q4 Date', 'Q4 Total Assets', 'Q4 Passive Assets',
  'Asset Test Ratio', 'Asset Test Result',
  'PFIC Result', 'Missing Data Notes', 'From Cache', 'Fetch Error',
];

function buildFullCsv(results) {
  const rows = [FULL_HEADERS];

  for (const r of results) {
    const ci = r.companyInfo || {};
    const id = r.incomeData || {};
    const f = id.fields || {};
    const it = r.incomeTestResult || {};
    const at = r.assetTestResult || {};
    const qs = r.quarters || [];

    const qCols = [];
    for (let i = 0; i < 4; i++) {
      const q = qs[i] || {};
      qCols.push(q.date ?? '', q.totalAssets ?? '', q.passiveAssets ?? '');
    }

    rows.push([
      r.ticker,
      ci.name ?? '',
      ci.exchange ?? '',
      ci.country ?? '',
      ci.type ?? '',
      ci.currency ?? '',
      ci.fiscalYearEnd ?? '',
      id.period ?? '',
      f.totalRevenue ?? '',
      f.interestIncome ?? '',
      f.netInvestmentIncome ?? '',
      f.dividendIncome ?? '',
      f.realizedGains ?? '',
      f.totalOtherIncomeExpenseNet ?? '',
      it.passiveIncome ?? '',
      pct(it.ratio),
      it.result ?? '',
      ...qCols,
      pct(at.ratio),
      at.result ?? '',
      resultLabel(r.pficResult),
      (r.notes || []).join('; '),
      r.fromCache ? 'Yes' : 'No',
      r.fetchError ?? '',
    ]);
  }

  return rowsToCsv(rows);
}

// ─── Structured export CSV (spec columns) ────────────────────────────────────

const STRUCTURED_HEADERS = [
  'Fund Name', 'Fund Code', 'Fund Class', 'Fund Currency',
  'PFIC Start date', 'Account #', 'Bank Name', 'Bank Address',
  'Bank City', 'Bank State/Province', 'Bank Country', 'Ownership %', 'Notes',
];

function buildStructuredCsv(results, manualFields) {
  const mf = manualFields || {};
  const rows = [STRUCTURED_HEADERS];

  for (const r of results) {
    const ci = r.companyInfo || {};

    const autoNotes = [
      `PFIC Result: ${resultLabel(r.pficResult)}`,
      ...(r.notes || []),
    ].filter(Boolean).join('; ');

    const combinedNotes = mf.notes
      ? `${autoNotes}; ${mf.notes}`
      : autoNotes;

    rows.push([
      ci.name || r.ticker,
      r.ticker,
      mf.fundClass ?? '',
      ci.currency ?? '',
      mf.pficStartDate ?? '',
      mf.accountNumber ?? '',
      mf.bankName ?? '',
      mf.bankAddress ?? '',
      mf.bankCity ?? '',
      mf.bankStateProvince ?? '',
      mf.bankCountry ?? '',
      mf.ownershipPercent ?? '',
      combinedNotes,
    ]);
  }

  return rowsToCsv(rows);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function buildCsv(results, manualFields, filter, exportType) {
  const filtered = filterResults(results, filter);

  if (exportType === 'structured') {
    return buildStructuredCsv(filtered, manualFields);
  }
  return buildFullCsv(filtered);
}

module.exports = { buildCsv, resultLabel };
