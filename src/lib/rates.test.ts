import { describe, expect, test } from 'vitest';

import { addRatePeriod, currentRatePeriod, hasOverlap, rateForDate, sortRates } from './rates';

describe('rates helpers', () => {
  test('sortRates orders periods by from date', () => {
    const sorted = sortRates([
      { id: 'b', amount: 700, from: '2026-03-01', to: null },
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
    ]);
    expect(sorted.map((rate) => rate.id)).toEqual(['a', 'b']);
  });

  test('currentRatePeriod prefers the open period', () => {
    const rates = [
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
      { id: 'b', amount: 700, from: '2026-03-01', to: null },
    ];
    expect(currentRatePeriod(rates)?.id).toBe('b');
  });

  test('currentRatePeriod falls back to latest by from when none are open', () => {
    const rates = [
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
      { id: 'b', amount: 700, from: '2026-03-01', to: '2026-04-30' },
    ];
    expect(currentRatePeriod(rates)?.id).toBe('b');
  });

  test('rateForDate resolves the period covering the date', () => {
    const rates = [
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
      { id: 'b', amount: 700, from: '2026-03-01', to: null },
    ];
    expect(rateForDate(rates, '2026-01-15')).toBe(650);
    expect(rateForDate(rates, '2026-03-15')).toBe(700);
  });

  test('rateForDate falls back to the current rate for uncovered dates', () => {
    const rates = [{ id: 'a', amount: 700, from: '2026-03-01', to: null }];
    expect(rateForDate(rates, '2025-01-01')).toBe(700);
  });

  test('addRatePeriod closes the previously open period', () => {
    const rates = [{ id: 'a', amount: 650, from: '2026-01-01', to: null }];
    const next = addRatePeriod(rates, 'b', 700, '2026-03-01');
    expect(next).toEqual([
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
      { id: 'b', amount: 700, from: '2026-03-01', to: null },
    ]);
  });

  test('addRatePeriod is a no-op when the new period would invert the closed one', () => {
    const rates = [{ id: 'a', amount: 650, from: '2026-03-01', to: null }];
    const next = addRatePeriod(rates, 'b', 700, '2026-01-01');
    expect(next).toBe(rates);
  });

  test('hasOverlap detects overlapping and multiple open periods', () => {
    expect(hasOverlap([
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-02-28' },
      { id: 'b', amount: 700, from: '2026-03-01', to: null },
    ])).toBe(false);

    expect(hasOverlap([
      { id: 'a', amount: 650, from: '2026-01-01', to: '2026-03-01' },
      { id: 'b', amount: 700, from: '2026-02-01', to: null },
    ])).toBe(true);

    expect(hasOverlap([
      { id: 'a', amount: 650, from: '2026-01-01', to: null },
      { id: 'b', amount: 700, from: '2026-02-01', to: null },
    ])).toBe(true);
  });
});
