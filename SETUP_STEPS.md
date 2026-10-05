# Setup & GitHub Publishing Guide

Complete step-by-step instructions — from cloning locally to a published GitHub repository with committed test results.

---

## Prerequisites

| Tool | Minimum version | Download |
|---|---|---|
| Git | Any recent | https://git-scm.com |
| Node.js | 18.0 or higher | https://nodejs.org |
| GitHub account | — | https://github.com |

---

## Part 1 — Local Setup

### Step 1 · Create the project folder

```bash
mkdir loanlens
cd loanlens
```

Place all project files inside this folder (see repository structure in README.md).

---

### Step 2 · Initialise Git

```bash
git init
git add .
git commit -m "feat: initial commit — LoanLens EMI calculator (A1)"
```

---

### Step 3 · Install Node dependencies

```bash
npm install
```

If starting from scratch (no `package.json` yet):

```bash
npm init -y
npm install --save-dev @playwright/test typescript ts-node dotenv
```

---

### Step 4 · Install Playwright browser

```bash
npx playwright install chromium
```

---

### Step 5 · Create the folder structure

```bash
mkdir -p tests/pages
mkdir -p tests/features
mkdir -p tests/step-definitions
mkdir -p api-tests
mkdir -p sql/screenshots
mkdir -p self-healing
mkdir -p test-results/screenshots
mkdir -p test-results/html-report
```

---

### Step 6 · Configure environment variables

```bash
# Copy the template
cp .env.example .env
```

Edit `.env` and set `BASE_URL` to the absolute path of your HTML file:

```bash
# .env — local file
BASE_URL=file:///Users/yourname/loanlens/emi-calculator.html   # macOS / Linux
BASE_URL=file:///C:/Users/yourname/loanlens/emi-calculator.html # Windows
```

For a deployed version (GitHub Pages):

```bash
BASE_URL=https://<your-username>.github.io/loanlens/emi-calculator.html
```

Make sure `.env` is in `.gitignore` — never commit real paths or secrets:

```bash
echo ".env" >> .gitignore
git add .gitignore .env.example
git commit -m "chore: add gitignore and env template"
```

---

## Part 2 — Framework Files

### Step 7 · `playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL:
      process.env.BASE_URL ??
      `file://${path.resolve(__dirname, 'emi-calculator.html')}`,
    screenshot: 'on',
    video: 'off',
    headless: true,
  },
});
```

---

### Step 8 · Page Object Model — `tests/pages/EmiCalculatorPage.ts`

```ts
import { Page, Locator, expect } from '@playwright/test';

export class EmiCalculatorPage {
  readonly page: Page;

  // Inputs
  readonly sliderPrincipal: Locator;
  readonly sliderRate: Locator;
  readonly sliderTenure: Locator;
  readonly btnCalculate: Locator;

  // Result hero
  readonly emiResult: Locator;
  readonly statPrincipal: Locator;
  readonly statInterest: Locator;
  readonly statTotal: Locator;

  // Chart
  readonly donutChart: Locator;
  readonly donutInterestPct: Locator;
  readonly bdPrincipal: Locator;
  readonly bdInterest: Locator;

  // Table
  readonly amortizationTable: Locator;
  readonly tableMeta: Locator;

  constructor(page: Page) {
    this.page = page;

    this.sliderPrincipal  = page.getByTestId('slider-principal');
    this.sliderRate       = page.getByTestId('slider-rate');
    this.sliderTenure     = page.getByTestId('slider-tenure');
    this.btnCalculate     = page.getByTestId('btn-calculate');

    this.emiResult        = page.getByTestId('emi-result');
    this.statPrincipal    = page.getByTestId('stat-principal');
    this.statInterest     = page.getByTestId('stat-interest');
    this.statTotal        = page.getByTestId('stat-total');

    this.donutChart       = page.getByTestId('donut-chart');
    this.donutInterestPct = page.getByTestId('donut-interest-pct');
    this.bdPrincipal      = page.getByTestId('bd-principal');
    this.bdInterest       = page.getByTestId('bd-interest');

    this.amortizationTable = page.getByTestId('amortization-table');
    this.tableMeta         = page.getByTestId('table-meta');
  }

  async goto() {
    const url =
      process.env.BASE_URL ??
      `file://${require('path').resolve(__dirname, '../../emi-calculator.html')}`;
    await this.page.goto(url);
  }

  // Set a range slider via JS evaluate (page.fill() does not work on range inputs)
  async setSlider(testId: string, value: number): Promise<void> {
    await this.page.getByTestId(testId).evaluate(
      (el: HTMLInputElement, val: number) => {
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      value
    );
  }

  async calculate(): Promise<void> {
    await this.btnCalculate.click();
  }

  tableRow(month: number): Locator {
    return this.page.getByTestId(`row-month-${month}`);
  }

  // Independent EMI formula for test assertions
  computeExpectedEMI(principal: number, annualRatePct: number, years: number): number {
    const r = annualRatePct / 12 / 100;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  async assertEmiApprox(expectedEmi: number, tolerancePct = 1): Promise<void> {
    const raw    = (await this.emiResult.textContent()) ?? '';
    const actual = parseInt(raw.replace(/[^\d]/g, ''), 10);
    const tol    = (tolerancePct / 100) * expectedEmi;
    expect(
      Math.abs(actual - expectedEmi),
      `EMI: expected ~${expectedEmi}, got ${actual}`
    ).toBeLessThan(tol);
  }

  async assertDonutHasData(): Promise<void> {
    const text = (await this.donutInterestPct.textContent()) ?? '0%';
    const pct  = parseInt(text.replace('%', ''), 10);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  }
}
```

---

### Step 9 · Feature file — `tests/features/emi-calculator.feature`

```gherkin
Feature: EMI Calculator

  Background:
    Given I open the EMI calculator

  Scenario: Dashboard loads with all input controls visible
    Then the calculate button should be visible
    And  the loan amount slider should be visible
    And  the interest rate slider should be visible
    And  the tenure slider should be visible

  Scenario: EMI output matches the expected formula result
    When I set the loan amount to 1000000
    And  I set the interest rate to 8.5
    And  I set the tenure to 10
    And  I click Calculate
    Then the monthly EMI should be approximately 12399
    And  the total interest stat should not be empty
    And  the total payable stat should not be empty

  Scenario: Donut chart is visible and shows non-zero interest percentage
    When I set the loan amount to 500000
    And  I set the interest rate to 10
    And  I set the tenure to 5
    And  I click Calculate
    Then the donut chart should be visible
    And  the interest percentage should be greater than 0

  Scenario: Amortization table row count matches the loan tenure
    When I set the loan amount to 200000
    And  I set the interest rate to 7
    And  I set the tenure to 2
    And  I click Calculate
    Then the amortization table should have 24 rows
    And  the table metadata should mention 24 monthly payments
```

---

### Step 10 · Step definitions — `tests/step-definitions/emi.steps.ts`

```ts
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { chromium, Browser, Page, expect } from '@playwright/test';
import { EmiCalculatorPage } from '../pages/EmiCalculatorPage';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();

let browser: Browser;
let page: Page;
let emiPage: EmiCalculatorPage;

const BASE_URL =
  process.env.BASE_URL ??
  `file://${path.resolve(__dirname, '../../emi-calculator.html')}`;

Before(async () => {
  browser = await chromium.launch();
  page    = await browser.newPage();
  emiPage = new EmiCalculatorPage(page);
});

After(async () => {
  await browser.close();
});

Given('I open the EMI calculator', async () => {
  await emiPage.goto();
});

When('I set the loan amount to {int}', async (val: number) => {
  await emiPage.setSlider('slider-principal', val);
});
When('I set the interest rate to {float}', async (val: number) => {
  await emiPage.setSlider('slider-rate', val);
});
When('I set the tenure to {int}', async (val: number) => {
  await emiPage.setSlider('slider-tenure', val);
});
When('I click Calculate', async () => {
  await emiPage.calculate();
});

Then('the calculate button should be visible', async () => {
  await expect(emiPage.btnCalculate).toBeVisible();
});
Then('the loan amount slider should be visible', async () => {
  await expect(emiPage.sliderPrincipal).toBeVisible();
});
Then('the interest rate slider should be visible', async () => {
  await expect(emiPage.sliderRate).toBeVisible();
});
Then('the tenure slider should be visible', async () => {
  await expect(emiPage.sliderTenure).toBeVisible();
});
Then('the monthly EMI should be approximately {int}', async (expected: number) => {
  await emiPage.assertEmiApprox(expected, 1);
});
Then('the total interest stat should not be empty', async () => {
  const t = await emiPage.statInterest.textContent();
  expect(t?.trim()).not.toBe('—');
});
Then('the total payable stat should not be empty', async () => {
  const t = await emiPage.statTotal.textContent();
  expect(t?.trim()).not.toBe('—');
});
Then('the donut chart should be visible', async () => {
  await expect(emiPage.donutChart).toBeVisible();
});
Then('the interest percentage should be greater than {int}', async (min: number) => {
  const text = (await emiPage.donutInterestPct.textContent()) ?? '0';
  const pct  = parseInt(text.replace('%', ''), 10);
  expect(pct).toBeGreaterThan(min);
});
Then('the amortization table should have {int} rows', async (expected: number) => {
  const count = await emiPage.amortizationTable
    .locator('tbody tr[data-testid]').count();
  expect(count).toBe(expected);
});
Then('the table metadata should mention {int} monthly payments', async (months: number) => {
  const text = await emiPage.tableMeta.textContent();
  expect(text).toContain(`${months} monthly payments`);
});
```

---

### Step 11 · API test — `api-tests/jsonplaceholder.spec.ts`

```ts
import { test, expect } from '@playwright/test';

const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';

test.describe('POST /posts — boundary and invalid input validation', () => {

  test('TC-01: excessively long title — mock accepts, real API should return 400', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { userId: 1, title: 'A'.repeat(10_000), body: 'test body' },
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).toHaveProperty('id');
  });

  test('TC-02: special characters in title — mock accepts, real API should sanitize', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { userId: 1, title: '🔥 <script>alert(1)</script> \x00\xFF', body: 'body' },
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).toHaveProperty('id');
  });

  test('TC-03: missing userId — mock returns 201, real API should return 422', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { title: 'Post without userId', body: 'body content' },
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).not.toHaveProperty('userId');
  });

  test('TC-04: empty body — mock returns 201, real API should return 400', async ({ request }) => {
    const res = await request.post(ENDPOINT, { data: {} });
    expect(res.status()).toBe(201);
  });

  test('TC-05: null values — mock accepts gracefully without server error', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      data: { userId: null, title: null, body: null },
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).toHaveProperty('id');
  });

});
```

---

## Part 3 — Run Tests and Commit Results

### Step 12 · Run the full test suite

```bash
# Run UI tests with HTML report
npx playwright test tests/ --reporter=html

# Open the report
npx playwright show-report test-results/html-report

# Run API tests
npx playwright test api-tests/

# Run everything at once
npx playwright test
```

Expected output:

```
Running 19 tests using 1 worker
  ✓  1  TC-01 ...  (487ms)
  ✓  2  TC-02 ...  (342ms)
  ...
  19 passed (10.7s)
```

---

### Step 13 · Commit the test results

> The assessment requires results to be committed — not just the code.

```bash
git add test-results/
git commit -m "test: add Playwright execution results — 19 passed, HTML report and screenshots"
```

---

## Part 4 — Publish to GitHub

### Step 14 · Create the GitHub repository

1. Go to https://github.com → click **New repository**
2. Name it `loanlens`
3. Set visibility to **Public**
4. Do **not** tick "Add a README" (we already have one)
5. Click **Create repository**

---

### Step 15 · Push to GitHub

```bash
git remote add origin https://github.com/<your-username>/loanlens.git
git branch -M main
git push -u origin main
```

---

### Step 16 · (Optional) Enable GitHub Pages

1. Repo on GitHub → **Settings** → **Pages**
2. Source: branch `main` → folder `/ (root)` → **Save**
3. App goes live at: `https://<username>.github.io/loanlens/`
4. Update `BASE_URL` in `.env.example` to the live URL

---

## Final Submission Checklist

Review every item before submitting the repo link:

- [ ] `emi-calculator.html` opens in a browser and all features work
- [ ] `playwright.config.ts` reads `BASE_URL` from `.env` — no hardcoded paths in test files
- [ ] `tests/pages/EmiCalculatorPage.ts` — all locators use `data-testid`
- [ ] `tests/features/emi-calculator.feature` — BDD scenarios committed
- [ ] `tests/step-definitions/emi.steps.ts` — step definitions committed
- [ ] `tests/emi-calculator.spec.ts` — 19 test cases committed
- [ ] `api-tests/jsonplaceholder.spec.ts` — API tests committed
- [ ] `sql/` — schema, both query files, and output screenshots committed
- [ ] `self-healing/SELF_HEALING.md` committed
- [ ] `test-results/console-output.txt` — execution log committed
- [ ] `test-results/html-report/index.html` — Playwright HTML report committed
- [ ] `test-results/screenshots/TC-01 … TC-19` — all 19 screenshots committed
- [ ] `README.md` includes architecture notes, test results table, and Claude Code reflection
- [ ] Repository is set to **Public**
