> **Streamhub QA Automation Assessment — Section A**
> Covers: A1 (Web App) · A2 (Playwright UI Tests) · 

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [A1 — Web Application](#3-a1--web-application)
4. [A2 — Playwright Test Framework](#4-a2--playwright-test-framework)
5. [Test Execution Results](#5-test-execution-results)



---

## 1. Project Overview

LoanLens is a fully client-side EMI (Equated Monthly Instalment) calculator. It requires no backend, no build step, and no server — open `emi-calculator.html` in any browser and it works immediately.

The Playwright test suite covers the app end-to-end across 19 test cases, all passing, with screenshots and an HTML report committed to this repository.

---

## 2. Repository Structure

```
loanlens/
│
├── emi-calculator.html              # A1 — Web application (single file)
├── playwright.config.ts             # Playwright configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json                     # Node dependencies
├── .env.example                     # Environment variable template
│
├── tests/                           # A2 — UI test suite
│   ├── pages/
│   │   └── EmiCalculatorPage.ts     # Page Object Model
│   ├── features/
│   │   └── emi-calculator.feature   # BDD feature file (Gherkin)
│   ├── step-definitions/
│   │   └── emi.steps.ts             # Step definitions
│   └── emi-calculator.spec.ts       # Playwright spec (19 test cases)
│
├── api-tests/                       # A3 — API test suite
│   └── jsonplaceholder.spec.ts
│
├── sql/                             # A4 — SQL queries
│   ├── schema.sql
│   ├── round_trip_transfers.sql
│   ├── ipl_streaks.sql
│   └── screenshots/
│
├── self-healing/                    # AI self-healing exercise
│   └── SELF_HEALING.md
│
├── test-results/                    # Committed test execution results
│   ├── console-output.txt           # Full console log — 19 passed
│   ├── html-report/                 # Playwright HTML report
│   │   └── index.html
│   └── screenshots/                 # One screenshot per test (19 total)
│       ├── TC-01-screenshot.png
│       ├── TC-02-screenshot.png
│       └── ... (TC-03 through TC-19)
│
├── README.md                        # This file
└── SETUP_STEPS.md                   # Step-by-step GitHub publishing guide
```

---

## 3. A1 — Web Application

### What it does

| # | Feature | Detail |
|---|---|---|
| 1 | **Dashboard hero** | Monthly EMI in large serif font; principal, total interest, total payable shown as stats |
| 2 | **Three sliders** | Loan amount (₹0–₹1 Cr), interest rate (1–30%), tenure (1–30 yrs) — labels update live |
| 3 | **Tick markers** | Dot marks every ₹5L / every 1% / every 2 yrs — turn blue as you drag |
| 4 | **Animated donut chart** | SVG donut: blue = principal, amber = interest; interest % in centre |
| 5 | **Breakdown bars** | Proportional bars showing principal vs interest amounts |
| 6 | **Amortization table** | Full month-by-month: EMI, principal, interest, remaining balance |
| 7 | **Responsive layout** | Two-column desktop → single-column mobile (≤ 800 px) |
| 8 | **Reduced motion** | CSS transitions off when `prefers-reduced-motion` is set |

### How to open

```bash
# macOS
open emi-calculator.html

# Linux
xdg-open emi-calculator.html

# Windows
start emi-calculator.html
```

Or drag `emi-calculator.html` into any browser tab.

### data-testid reference

Every interactive and output element has a `data-testid` attribute so Playwright locators are stable across any CSS or layout changes.

| `data-testid` | Element |
|---|---|
| `slider-principal` | Loan amount range input |
| `slider-rate` | Interest rate range input |
| `slider-tenure` | Tenure range input |
| `btn-calculate` | Calculate button |
| `emi-result` | Monthly EMI hero container |
| `stat-principal` | Principal stat |
| `stat-interest` | Total interest stat |
| `stat-total` | Total payable stat |
| `donut-chart` | SVG donut element |
| `donut-interest-pct` | Interest % inside donut |
| `bd-principal` | Breakdown principal amount |
| `bd-interest` | Breakdown interest amount |
| `amortization-table` | Full schedule `<table>` |
| `table-meta` | Row count + total line |
| `row-month-N` | Each table row (e.g. `row-month-1`) |

---

## 4. A2 — Playwright Test Framework

### Framework design

```
emi-calculator.feature  (Gherkin scenarios)
        ↓
emi.steps.ts            (step definitions — wire Gherkin to actions)
        ↓
EmiCalculatorPage.ts    (Page Object Model — all locators and actions)
        ↓
Playwright → Chromium
```

### Locator strategy

All locators use `data-testid` via `page.getByTestId()`. No positional CSS, no XPath, no `nth-child`. This means locators survive any styling or layout change.

```ts
// Good — stable, role/testid based
this.btnCalculate = page.getByTestId('btn-calculate');
this.donutChart   = page.getByTestId('donut-chart');

// Avoided — brittle, breaks if layout changes
page.locator('div:nth-child(3) > button')   // ❌
page.locator('//div[@class="panel"]/button') // ❌
```

### Environment configuration

`BASE_URL` is never hardcoded in test files. It is read from `.env` into `playwright.config.ts`:

```ts
// playwright.config.ts
use: {
  baseURL: process.env.BASE_URL ??
    `file://${path.resolve(__dirname, 'emi-calculator.html')}`,
}
```

Override for any deployment:

```bash
# Local file
BASE_URL=file:///absolute/path/to/emi-calculator.html

# GitHub Pages
BASE_URL=https://<username>.github.io/loanlens/emi-calculator.html
```

### Test suites — 19 test cases

#### Suite 1 — Dashboard & Controls (TC-01, TC-02)

| TC | Scenario | Assertion |
|---|---|---|
| TC-01 | Page loads and all controls are visible | All 3 sliders + button visible and enabled |
| TC-02 | Slider defaults are pre-set on load | Principal = 10,00,000 · Rate = 8.5 · Tenure = 10 |

#### Suite 2 — Formula Validation (TC-03 to TC-06)

EMI is computed independently using the reducing-balance formula and compared to the app's output within ±1% tolerance.

| TC | Inputs | Expected EMI | Formula |
|---|---|---|---|
| TC-03 | ₹10,00,000 · 8.5% · 10 yr | ₹12,399 | `P×r×(1+r)ⁿ / ((1+r)ⁿ–1)` |
| TC-04 | ₹5,00,000 · 10% · 5 yr | ₹10,624 | same |
| TC-05 | ₹2,00,000 · 7% · 2 yr | ₹8,972 | same |
| TC-06 | Total payable check | Not a placeholder `—` | stat-total has ₹ content |

#### Suite 3 — Chart & Visual Elements (TC-07 to TC-10)

| TC | Scenario | Assertion |
|---|---|---|
| TC-07 | Donut chart is visible after calculation | `toBeVisible()` |
| TC-08 | Donut shows non-zero interest % | `pct > 0 && pct < 100` |
| TC-09 | Breakdown amounts populated | Both contain `₹`, not `—` |
| TC-10 | SVG arcs updated from default | `stroke-dasharray` ≠ `'0 390'` |

#### Suite 4 — Amortization Table (TC-11 to TC-15)

| TC | Scenario | Assertion |
|---|---|---|
| TC-11 | 2-year loan → 24 rows | `count() === 24` |
| TC-12 | Table metadata text | Contains `'24 monthly payments'` |
| TC-13 | First row has valid data | 5 cells, principal cell contains `₹` |
| TC-14 | Last row balance = ₹0 | Balance cell digits = `'0'` |
| TC-15 | 10-year loan → 120 rows | `count() === 120` |

#### Suite 5 — Edge Cases (TC-16 to TC-19)

| TC | Scenario | Assertion |
|---|---|---|
| TC-16 | Zero loan amount | EMI = ₹0 |
| TC-17 | Max loan ₹1 Cr, 30 yr | EMI ≈ ₹76,891 (within 1%) |
| TC-18 | Min tenure 1 year | 12 table rows |
| TC-19 | Max tenure 30 years | 360 table rows |

---

## 5. Test Execution Results

### Summary

```
Running 19 tests using 1 worker

  ✓  TC-01  Dashboard loads, all controls visible          (487ms)
  ✓  TC-02  Slider defaults pre-set on load                (342ms)
  ✓  TC-03  EMI formula — ₹10L, 8.5%, 10yr               (532ms)
  ✓  TC-04  EMI formula — ₹5L, 10%, 5yr                  (518ms)
  ✓  TC-05  EMI formula — ₹2L, 7%, 2yr                   (512ms)
  ✓  TC-06  Total payable within rounding tolerance        (547ms)
  ✓  TC-07  Donut chart visible after calculation          (498ms)
  ✓  TC-08  Donut shows non-zero interest percentage       (480ms)
  ✓  TC-09  Breakdown amounts populated                    (465ms)
  ✓  TC-10  SVG arcs updated after calculation             (492ms)
  ✓  TC-11  2-year loan → 24 table rows                   (665ms)
  ✓  TC-12  Table metadata shows correct month count       (443ms)
  ✓  TC-13  First row has valid data                       (542ms)
  ✓  TC-14  Last row balance = ₹0                         (462ms)
  ✓  TC-15  10-year loan → 120 table rows                 (488ms)
  ✓  TC-16  Zero loan amount → zero EMI                   (466ms)
  ✓  TC-17  Max loan ₹1 Cr calculates without error       (591ms)
  ✓  TC-18  Min tenure 1 year → 12 rows                   (429ms)
  ✓  TC-19  Max tenure 30 years → 360 rows                (540ms)

  19 passed (10.7s)
```

### Result artifacts in this repo

| Artifact | Location | Description |
|---|---|---|
| Console log | `test-results/console-output.txt` | Full terminal output from test run |
| HTML report | `test-results/html-report/index.html` | Playwright interactive report |
| Screenshots | `test-results/screenshots/TC-01 … TC-19` | One screenshot per test case |

> Open `test-results/html-report/index.html` locally in a browser to view the full interactive Playwright report.
