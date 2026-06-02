# PFIC Report

A web tool for running the two statutory PFIC (Passive Foreign Investment Company) tests on publicly traded securities, using financial data from the [EODHD Fundamentals API](https://eodhd.com/).

## What it does

Paste a list of stock tickers, and the tool will:

1. Fetch financial fundamentals from EODHD (with a local SQLite cache).
2. Run the **income test** — flags PFIC if passive income ≥ 75% of gross income.
3. Run the **asset test** — flags PFIC if passive assets average ≥ 50% of total assets across four quarters.
4. Classify each ticker as `PFIC — Yes`, `PFIC — No`, `Manual Review Required`, `Unable to Determine`, or `Not Suitable` (for fund-like entities such as ETFs and mutual funds).
5. Save results to a shareable URL (`/results/:id`) that expires after a configurable number of days.
6. Let you export results to CSV in two formats: a **full** data dump or a **structured** format for filing.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and set EODHD_API_KEY
npm run dev
```

The server starts on `http://localhost:3000` by default.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `EODHD_API_KEY` | — | **Required.** API key from [eodhd.com/cp/settings](https://eodhd.com/cp/settings) |
| `DATABASE_PATH` | `./pfic.db` | SQLite file path. For Railway: `/data/pfic.db` |
| `CACHE_TTL_HOURS` | `24` | Hours to cache EODHD responses. `0` disables caching. |
| `MAX_CONCURRENT` | `5` | Parallel EODHD requests. Use `1`–`2` on free/trial plans. |
| `SESSION_TTL_DAYS` | `7` | How long shareable result URLs remain valid. |
| `PORT` | `3000` | HTTP port. |

## Ticker input format

- One per line, or comma/semicolon/tab/space-separated.
- Symbols without an exchange suffix default to `.US` (e.g. `AAPL` → `AAPL.US`).
- Foreign listings require an explicit suffix (e.g. `HSBC.LSE`, `7203.TSE`, `NESN.SW`).
- Duplicates are detected and removed before analysis.

## Tech stack

- **Runtime**: Node.js ≥ 22
- **Web framework**: Express 4
- **Templating**: Nunjucks
- **Database**: SQLite via `better-sqlite3`
- **External API**: EODHD Fundamentals (`https://eodhd.com/api/fundamentals`)
- **Deploy target**: Railway (persistent volume for the SQLite file)

## PFIC test logic

**Income test** (IRC §1297(a)(1)): passive income components (interest, dividends, net investment income, realized gains, other income/expense net) are summed and divided by total revenue. Ratio ≥ 75% → positive.

**Asset test** (IRC §1297(a)(2)): passive assets (cash equivalents, short-term investments, long-term investments) are averaged across the four most recent quarters and divided by average total assets. Ratio ≥ 50% → positive.

Either test positive → `pfic_yes`. Both negative → `pfic_no`. Mixed or missing data triggers `manual_review` or `unable_to_determine`. Fund-like entities (ETFs, mutual funds, REITs, etc.) are classified as `not_suitable` for the corporate PFIC test.

> **Disclaimer**: This tool is for informational purposes only and does not constitute tax or legal advice. PFIC determinations depend on facts and circumstances beyond what financial statement data can fully capture. Consult a qualified tax advisor.
