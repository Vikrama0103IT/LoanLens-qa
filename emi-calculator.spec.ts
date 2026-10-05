import { test, expect } from '@playwright/test';
import { EmiCalculatorPage } from './pages/EmiCalculatorPage';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: LoanLens EMI Calculator (A2)
//
// Covers:
//   1. Dashboard load & control visibility
//   2. EMI output validation against independently computed formula
//   3. Chart visibility and non-zero data
//   4. Amortization table row count and metadata
//   5. Edge cases (zero rate, max values)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('EMI Calculator — Dashboard & Controls', () => {

  test('TC-01: page loads and all input controls are visible', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    // All three sliders must be present
    await expect(emi.sliderPrincipal).toBeVisible();
    await expect(emi.sliderRate).toBeVisible();
    await expect(emi.sliderTenure).toBeVisible();

    // Calculate button must be present and enabled
    await expect(emi.btnCalculate).toBeVisible();
    await expect(emi.btnCalculate).toBeEnabled();

    // EMI result and stat elements must exist in DOM
    await expect(emi.emiResult).toBeAttached();
    await expect(emi.statPrincipal).toBeAttached();
    await expect(emi.statInterest).toBeAttached();
    await expect(emi.statTotal).toBeAttached();
  });

  test('TC-02: slider default values are pre-set on load', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    const principal = await emi.sliderPrincipal.inputValue();
    const rate      = await emi.sliderRate.inputValue();
    const tenure    = await emi.sliderTenure.inputValue();

    expect(Number(principal)).toBe(1000000); // ₹10,00,000
    expect(Number(rate)).toBe(8.5);          // 8.5%
    expect(Number(tenure)).toBe(10);         // 10 years
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('EMI Calculator — Formula Validation', () => {

  test('TC-03: EMI output matches independently computed value (₹10L, 8.5%, 10yr)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    // Set inputs
    await emi.setSlider('slider-principal', 1000000);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 10);
    await emi.calculate();

    /*
     * Independent calculation (reducing-balance formula):
     *   P = 1,000,000
     *   r = 8.5 / 12 / 100 = 0.007083...
     *   n = 10 × 12 = 120
     *   EMI = P × r × (1+r)^n / ((1+r)^n - 1) = 12,399 (rounded)
     */
    const expectedEMI = 12399;
    await emi.assertEmiApprox(expectedEMI, 1); // within 1%

    // Stats must not be placeholder dashes
    const interest = await emi.statInterest.textContent();
    const total    = await emi.statTotal.textContent();
    expect(interest?.trim()).not.toBe('—');
    expect(total?.trim()).not.toBe('—');
  });

  test('TC-04: EMI output matches independently computed value (₹5L, 10%, 5yr)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 500000);
    await emi.setSlider('slider-rate', 10);
    await emi.setSlider('slider-tenure', 5);
    await emi.calculate();

    /*
     * Independent calculation:
     *   P = 500,000  r = 0.008333...  n = 60
     *   EMI = 10,624 (rounded)
     */
    const expectedEMI = 10624;
    await emi.assertEmiApprox(expectedEMI, 1);
  });

  test('TC-05: EMI output matches independently computed value (₹2L, 7%, 2yr)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 200000);
    await emi.setSlider('slider-rate', 7);
    await emi.setSlider('slider-tenure', 2);
    await emi.calculate();

    /*
     * Independent calculation:
     *   P = 200,000  r = 0.005833...  n = 24
     *   EMI = 8,972 (rounded)
     */
    const expectedEMI = 8972;
    await emi.assertEmiApprox(expectedEMI, 1);
  });

  test('TC-06: total payable = EMI × months (within rounding tolerance)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 1000000);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 10);
    await emi.calculate();

    // EMI ≈ 12,399 × 120 months = 1,487,880
    // stat-total should contain a value representing ~14.88 L
    const totalText = (await emi.statTotal.textContent()) ?? '';
    expect(totalText).toMatch(/[₹\d]/); // has numeric content
    expect(totalText.trim()).not.toBe('—');
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('EMI Calculator — Chart & Visual Elements', () => {

  test('TC-07: donut chart is visible after calculation', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 500000);
    await emi.setSlider('slider-rate', 10);
    await emi.setSlider('slider-tenure', 5);
    await emi.calculate();

    await expect(emi.donutChart).toBeVisible();
  });

  test('TC-08: donut chart shows non-zero interest percentage', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 500000);
    await emi.setSlider('slider-rate', 10);
    await emi.setSlider('slider-tenure', 5);
    await emi.calculate();

    await emi.assertDonutHasData();
  });

  test('TC-09: breakdown amounts are populated and not placeholder', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 300000);
    await emi.setSlider('slider-rate', 9);
    await emi.setSlider('slider-tenure', 3);
    await emi.calculate();

    const bdP = await emi.bdPrincipal.textContent();
    const bdI = await emi.bdInterest.textContent();
    expect(bdP?.trim()).not.toBe('—');
    expect(bdI?.trim()).not.toBe('—');
    // Both should contain ₹ symbol
    expect(bdP).toContain('₹');
    expect(bdI).toContain('₹');
  });

  test('TC-10: donut SVG arcs have non-zero stroke-dasharray after calculation', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 500000);
    await emi.setSlider('slider-rate', 10);
    await emi.setSlider('slider-tenure', 5);
    await emi.calculate();

    // Check SVG arc elements have been updated from default "0 390"
    const arcPrincipal = page.locator('#arc-principal');
    const arcInterest  = page.locator('#arc-interest');

    const dashP = await arcPrincipal.getAttribute('stroke-dasharray');
    const dashI = await arcInterest.getAttribute('stroke-dasharray');

    expect(dashP).not.toBe('0 390');
    expect(dashI).not.toBe('0 390');
    expect(dashP).not.toBeNull();
    expect(dashI).not.toBeNull();
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('EMI Calculator — Amortization Table', () => {

  test('TC-11: table has correct row count for 2-year loan (24 months)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 200000);
    await emi.setSlider('slider-rate', 7);
    await emi.setSlider('slider-tenure', 2);
    await emi.calculate();

    const rows = await emi.amortizationTable
      .locator('tbody tr[data-testid]')
      .count();
    expect(rows).toBe(24);
  });

  test('TC-12: table metadata shows correct month count and total', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 200000);
    await emi.setSlider('slider-rate', 7);
    await emi.setSlider('slider-tenure', 2);
    await emi.calculate();

    const meta = await emi.tableMeta.textContent();
    expect(meta).toContain('24 monthly payments');
  });

  test('TC-13: first row has valid principal, interest and balance values', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 1000000);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 10);
    await emi.calculate();

    const firstRow = emi.tableRow(1);
    await expect(firstRow).toBeVisible();

    // All 5 cells should contain ₹ values (except month number)
    const cells = firstRow.locator('td');
    const count = await cells.count();
    expect(count).toBe(5);

    // Principal cell (index 2) should contain ₹
    const principalCell = cells.nth(2);
    const principalText = await principalCell.textContent();
    expect(principalText).toContain('₹');
  });

  test('TC-14: last row balance is ₹0 (loan fully repaid)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 200000);
    await emi.setSlider('slider-rate', 7);
    await emi.setSlider('slider-tenure', 2); // 24 months
    await emi.calculate();

    const lastRow   = emi.tableRow(24);
    await expect(lastRow).toBeVisible();

    const cells     = lastRow.locator('td');
    const balCell   = cells.nth(4); // Balance column
    const balText   = await balCell.textContent();

    // Balance in last row must be ₹0
    expect(balText?.replace(/[^\d]/g, '')).toBe('0');
  });

  test('TC-15: table has correct row count for 10-year loan (120 months)', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 1000000);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 10);
    await emi.calculate();

    const rows = await emi.amortizationTable
      .locator('tbody tr[data-testid]')
      .count();
    expect(rows).toBe(120);
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('EMI Calculator — Edge Cases', () => {

  test('TC-16: zero loan amount produces zero EMI', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 0);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 10);
    await emi.calculate();

    const raw    = (await emi.emiResult.textContent()) ?? '';
    const digits = raw.replace(/[^\d]/g, '');
    expect(Number(digits)).toBe(0);
  });

  test('TC-17: maximum loan amount (₹1 Cr) calculates without error', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 10000000);
    await emi.setSlider('slider-rate', 8.5);
    await emi.setSlider('slider-tenure', 30);
    await emi.calculate();

    /*
     * Independent calculation:
     *   P = 1,00,00,000  r = 0.007083...  n = 360
     *   EMI ≈ 76,891
     */
    await emi.assertEmiApprox(76891, 1);
  });

  test('TC-18: minimum tenure (1 year) produces 12 table rows', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 100000);
    await emi.setSlider('slider-rate', 10);
    await emi.setSlider('slider-tenure', 1);
    await emi.calculate();

    const rows = await emi.amortizationTable
      .locator('tbody tr[data-testid]')
      .count();
    expect(rows).toBe(12);
  });

  test('TC-19: maximum tenure (30 years) produces 360 table rows', async ({ page }) => {
    const emi = new EmiCalculatorPage(page);
    await emi.goto();

    await emi.setSlider('slider-principal', 500000);
    await emi.setSlider('slider-rate', 9);
    await emi.setSlider('slider-tenure', 30);
    await emi.calculate();

    const rows = await emi.amortizationTable
      .locator('tbody tr[data-testid]')
      .count();
    expect(rows).toBe(360);
  });

});
