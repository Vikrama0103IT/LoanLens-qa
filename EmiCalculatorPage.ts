import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model — EmiCalculatorPage
 *
 * All locators use data-testid attributes.
 * No positional CSS, no XPath — locators are stable across any styling changes.
 */
export class EmiCalculatorPage {
  readonly page: Page;

  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly sliderPrincipal: Locator;
  readonly sliderRate: Locator;
  readonly sliderTenure: Locator;
  readonly btnCalculate: Locator;

  // ── Result hero ─────────────────────────────────────────────────────────
  readonly emiResult: Locator;
  readonly statPrincipal: Locator;
  readonly statInterest: Locator;
  readonly statTotal: Locator;

  // ── Chart ────────────────────────────────────────────────────────────────
  readonly donutChart: Locator;
  readonly donutInterestPct: Locator;
  readonly bdPrincipal: Locator;
  readonly bdInterest: Locator;

  // ── Table ────────────────────────────────────────────────────────────────
  readonly amortizationTable: Locator;
  readonly tableMeta: Locator;

  constructor(page: Page) {
    this.page = page;

    this.sliderPrincipal   = page.getByTestId('slider-principal');
    this.sliderRate        = page.getByTestId('slider-rate');
    this.sliderTenure      = page.getByTestId('slider-tenure');
    this.btnCalculate      = page.getByTestId('btn-calculate');

    this.emiResult         = page.getByTestId('emi-result');
    this.statPrincipal     = page.getByTestId('stat-principal');
    this.statInterest      = page.getByTestId('stat-interest');
    this.statTotal         = page.getByTestId('stat-total');

    this.donutChart        = page.getByTestId('donut-chart');
    this.donutInterestPct  = page.getByTestId('donut-interest-pct');
    this.bdPrincipal       = page.getByTestId('bd-principal');
    this.bdInterest        = page.getByTestId('bd-interest');

    this.amortizationTable = page.getByTestId('amortization-table');
    this.tableMeta         = page.getByTestId('table-meta');
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  async goto() {
    const url =
      process.env.BASE_URL ??
      `file://${require('path').resolve(__dirname, '../../emi-calculator.html')}`;
    await this.page.goto(url);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Set a range slider to an exact value by directly setting el.value
   * and firing an 'input' event — bypasses browser drag simulation.
   */
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

  /** Get a specific amortization row by month number */
  tableRow(month: number): Locator {
    return this.page.getByTestId(`row-month-${month}`);
  }

  // ── Formula helper (independent computation for assertions) ──────────────

  /**
   * Standard reducing-balance EMI formula.
   * Edge case: r = 0  →  EMI = P / n
   */
  computeExpectedEMI(principal: number, annualRatePct: number, years: number): number {
    const r = annualRatePct / 12 / 100;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  async assertVisible(): Promise<void> {
    await expect(this.sliderPrincipal).toBeVisible();
    await expect(this.sliderRate).toBeVisible();
    await expect(this.sliderTenure).toBeVisible();
    await expect(this.btnCalculate).toBeVisible();
  }

  async assertEmiApprox(expectedEmi: number, tolerancePct = 1): Promise<void> {
    const raw    = (await this.emiResult.textContent()) ?? '';
    const digits = raw.replace(/[^\d]/g, '');
    const actual = parseInt(digits, 10);
    const tol    = (tolerancePct / 100) * expectedEmi;
    expect(
      Math.abs(actual - expectedEmi),
      `EMI: expected ~${expectedEmi}, got ${actual}`
    ).toBeLessThan(tol);
  }

  async assertDonutHasData(): Promise<void> {
    const text = (await this.donutInterestPct.textContent()) ?? '0%';
    const pct  = parseInt(text.replace('%', ''), 10);
    expect(pct, 'Donut interest % should be > 0').toBeGreaterThan(0);
    expect(pct, 'Donut interest % should be < 100').toBeLessThan(100);
  }
}
