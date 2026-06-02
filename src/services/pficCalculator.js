'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const FUND_GENERAL_TYPES = new Set([
  'ETF', 'ETF MUTUAL FUND', 'MUTUAL FUND', 'FUND',
  'MONEY MARKET FUND', 'UNIT', 'CLOSED-END FUND', 'OPEN-END FUND',
]);

const FUND_NAME_KEYWORDS = [
  ' etf', ' fund', ' trust', ' ucits', ' sicav', ' reit',
  'investment company', 'closed-end', 'open-end', 'index fund',
  'unit trust', 'investment trust', 'managed fund',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Parse a value to float or return null — never treat missing as zero
function num(val) {
  if (val === null || val === undefined || val === '' || val === 'None') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// Sum only the non-null values; return null if ALL are null
function sumNonNull(values) {
  const valid = values.filter(v => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

// Sort an object's keys as date strings descending, return values array
function sortedDescValues(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj)
    .sort()
    .reverse()
    .map(k => obj[k]);
}

// ─── Entity type detection ────────────────────────────────────────────────────

function detectEntityType(raw) {
  if (!raw || !raw.General) return 'unknown';

  const type = (raw.General.Type || '').trim().toUpperCase();
  const name = (raw.General.Name || '').toLowerCase();
  const category = (raw.General.Category || '').toLowerCase();

  if (FUND_GENERAL_TYPES.has(type)) return 'fund_like';
  if (FUND_NAME_KEYWORDS.some(kw => name.includes(kw))) return 'fund_like';
  if (FUND_NAME_KEYWORDS.some(kw => category.includes(kw))) return 'fund_like';

  return 'common_stock';
}

// ─── Data extraction ──────────────────────────────────────────────────────────

function extractCompanyInfo(raw) {
  const g = raw.General || {};
  return {
    name: g.Name || null,
    code: g.Code || null,
    exchange: g.Exchange || null,
    country: g.CountryName || null,
    type: g.Type || null,
    currency: g.CurrencyCode || null,
    fiscalYearEnd: g.FiscalYearEnd || null,
    isin: g.ISIN || null,
    description: g.Description || null,
  };
}

function extractIncomeData(raw) {
  const yearly = raw?.Financials?.Income_Statement?.yearly;
  const records = sortedDescValues(yearly);

  if (records.length === 0) {
    return { period: null, fields: {}, available: false };
  }

  const r = records[0];

  const fields = {
    totalRevenue: num(r.totalRevenue),
    interestIncome: num(r.interestIncome),
    netInvestmentIncome: num(r.netInvestmentIncome),
    dividendIncome: num(r.dividendIncome),
    // totalOtherIncomeExpenseNet can contain investment gains; included as a
    // passive income candidate — reviewer should confirm if applicable
    totalOtherIncomeExpenseNet: num(r.totalOtherIncomeExpenseNet),
    realizedGains: num(r.realizedGains) !== null
      ? num(r.realizedGains)
      : num(r.capitalGains),
  };

  return { period: r.date || null, fields, available: true };
}

function extractQuarterlyBalance(raw) {
  const quarterly = raw?.Financials?.Balance_Sheet?.quarterly;
  const records = sortedDescValues(quarterly).slice(0, 4);

  return records.map(q => {
    const totalAssets = num(q.totalAssets);

    const cash = num(q.cash);
    const shortTermInvestments = num(q.shortTermInvestments);
    const cashAndST = num(q.cashAndShortTermInvestments);
    const longTermInvestments = num(q.longTermInvestments);

    // Resolve liquid assets: prefer granular fields; fall back to combined field
    let cashEquiv, shortTerm;
    if (cash !== null && shortTermInvestments !== null) {
      cashEquiv = cash;
      shortTerm = shortTermInvestments;
    } else if (cashAndST !== null) {
      cashEquiv = cashAndST;
      shortTerm = null; // already rolled into cashEquiv
    } else {
      cashEquiv = cash;
      shortTerm = shortTermInvestments;
    }

    const passiveAssets = sumNonNull([cashEquiv, shortTerm, longTermInvestments]);

    return {
      date: q.date || null,
      totalAssets,
      cashEquiv,
      shortTerm,
      longTermInvestments,
      passiveAssets,
    };
  });
}

// ─── PFIC Tests ───────────────────────────────────────────────────────────────

function incomeTest(incomeData) {
  if (!incomeData.available) {
    return {
      result: 'no_data',
      ratio: null,
      passiveIncome: null,
      totalRevenue: null,
      passiveComponents: {},
      missingFields: ['No annual income statement data available'],
    };
  }

  const f = incomeData.fields;

  if (f.totalRevenue === null) {
    return {
      result: 'no_data',
      ratio: null,
      passiveIncome: null,
      totalRevenue: null,
      passiveComponents: f,
      missingFields: ['totalRevenue is missing'],
    };
  }

  if (f.totalRevenue === 0) {
    return {
      result: 'no_data',
      ratio: null,
      passiveIncome: null,
      totalRevenue: 0,
      passiveComponents: f,
      missingFields: ['totalRevenue is zero — cannot compute ratio'],
    };
  }

  const passiveComponents = {
    interestIncome: f.interestIncome,
    netInvestmentIncome: f.netInvestmentIncome,
    dividendIncome: f.dividendIncome,
    realizedGains: f.realizedGains,
    totalOtherIncomeExpenseNet: f.totalOtherIncomeExpenseNet,
  };

  const missingFields = Object.entries(passiveComponents)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  const passiveIncome = sumNonNull(Object.values(passiveComponents));

  // If every passive component is null, we cannot run the test
  if (passiveIncome === null) {
    return {
      result: 'no_data',
      ratio: null,
      passiveIncome: null,
      totalRevenue: f.totalRevenue,
      passiveComponents,
      missingFields: ['All passive income fields are missing'],
    };
  }

  const ratio = passiveIncome / f.totalRevenue;

  return {
    result: ratio >= 0.75 ? 'positive' : 'negative',
    ratio,
    passiveIncome,
    totalRevenue: f.totalRevenue,
    passiveComponents,
    missingFields,
  };
}

function assetTest(quarters) {
  if (!quarters || quarters.length === 0) {
    return {
      result: 'insufficient_data',
      ratio: null,
      quarterBreakdown: [],
      missingFields: ['No quarterly balance sheet data available'],
    };
  }

  if (quarters.length < 4) {
    return {
      result: 'insufficient_data',
      ratio: null,
      quarterBreakdown: quarters,
      missingFields: [`Only ${quarters.length} of 4 quarters available — cannot compute annual average`],
    };
  }

  const q4 = quarters.slice(0, 4);

  const nullTotalAssets = q4.filter(q => q.totalAssets === null).map(q => q.date);
  if (nullTotalAssets.length > 0) {
    return {
      result: 'insufficient_data',
      ratio: null,
      quarterBreakdown: q4,
      missingFields: [`totalAssets missing for quarters: ${nullTotalAssets.join(', ')}`],
    };
  }

  const nullPassive = q4.filter(q => q.passiveAssets === null).map(q => q.date);
  if (nullPassive.length > 0) {
    return {
      result: 'insufficient_data',
      ratio: null,
      quarterBreakdown: q4,
      missingFields: [`Passive asset components missing for quarters: ${nullPassive.join(', ')}`],
    };
  }

  const totalPassive = q4.reduce((s, q) => s + q.passiveAssets, 0);
  const totalAssets = q4.reduce((s, q) => s + q.totalAssets, 0);

  if (totalAssets === 0) {
    return {
      result: 'no_data',
      ratio: null,
      quarterBreakdown: q4,
      missingFields: ['Sum of quarterly totalAssets is zero'],
    };
  }

  const ratio = totalPassive / totalAssets;

  return {
    result: ratio >= 0.50 ? 'positive' : 'negative',
    ratio,
    totalPassive,
    totalAssets,
    quarterBreakdown: q4,
    missingFields: [],
  };
}

// ─── Final result ─────────────────────────────────────────────────────────────

function pficResult(incomeResult, assetResult, entityType) {
  if (entityType === 'fund_like') return 'not_suitable';

  if (incomeResult.result === 'positive' || assetResult.result === 'positive') {
    return 'pfic_yes';
  }

  if (incomeResult.result === 'negative' && assetResult.result === 'negative') {
    return 'pfic_no';
  }

  // One test negative but the other has no/insufficient data
  if (
    incomeResult.result === 'negative' ||
    assetResult.result === 'negative'
  ) {
    return 'manual_review';
  }

  return 'unable_to_determine';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function analyze(ticker, rawData, fetchError) {
  if (!rawData) {
    return {
      ticker,
      companyInfo: null,
      entityType: 'unknown',
      incomeData: { available: false, period: null, fields: {} },
      quarters: [],
      incomeTestResult: { result: 'no_data', missingFields: ['API returned no data'] },
      assetTestResult: { result: 'no_data', missingFields: ['API returned no data'] },
      pficResult: 'unable_to_determine',
      notes: [fetchError || 'EODHD returned no data for this ticker'],
    };
  }

  const companyInfo = extractCompanyInfo(rawData);
  const entityType = detectEntityType(rawData);
  const incomeData = extractIncomeData(rawData);
  const quarters = extractQuarterlyBalance(rawData);

  const incomeResult = incomeTest(incomeData);
  const assetResult = assetTest(quarters);
  const result = pficResult(incomeResult, assetResult, entityType);

  const notes = [
    ...(incomeResult.missingFields || []),
    ...(assetResult.missingFields || []),
  ].filter(Boolean);

  return {
    ticker,
    companyInfo,
    entityType,
    incomeData,
    quarters,
    incomeTestResult: incomeResult,
    assetTestResult: assetResult,
    pficResult: result,
    notes,
  };
}

module.exports = {
  analyze,
  detectEntityType,
  extractCompanyInfo,
  extractIncomeData,
  extractQuarterlyBalance,
  incomeTest,
  assetTest,
  pficResult,
};
