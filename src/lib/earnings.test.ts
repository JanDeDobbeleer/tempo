import { describe, expect, test } from 'vitest';

import { aggregateBy, entryEarnValue, filterEntries, summarize } from './earnings';
import type { Customer, Entry, Project, Service } from '../types';

const customers: Customer[] = [
  { id: 'c1', name: 'Acme', color: '#2563eb' },
  { id: 'c2', name: 'Globex', color: '#0d9488' },
];

const projects: Project[] = [
  { id: 'p1', name: 'Website', customerId: 'c1', rates: [{ id: 'r1', amount: 800, from: '2026-01-01', to: null }] },
  { id: 'p2', name: 'App', customerId: 'c1', rates: [{ id: 'r2', amount: 600, from: '2026-01-01', to: null }] },
  { id: 'p3', name: 'Support', customerId: 'c2', rates: [{ id: 'r3', amount: 400, from: '2026-01-01', to: null }] },
];

const services: Service[] = [
  {
    id: 's1',
    name: 'Workshop',
    rates: [
      { id: 'sr1', amount: 900, from: '2026-01-01', to: '2026-01-31' },
      { id: 'sr2', amount: 950, from: '2026-02-01', to: null },
    ],
  },
];

const entries: Entry[] = [
  { id: 'e1', kind: 'project', date: '2026-01-05', projectId: 'p1', serviceId: null, customerId: null, start: 540, end: 1020, comment: '', attachments: [] }, // 8h @800/8h = 800
  { id: 'e2', kind: 'project', date: '2026-01-10', projectId: 'p2', serviceId: null, customerId: null, start: 540, end: 780, comment: '', attachments: [] }, // 4h @600/8h = 300
  { id: 'e3', kind: 'project', date: '2026-02-01', projectId: 'p3', serviceId: null, customerId: null, start: 540, end: 1020, comment: '', attachments: [] }, // 8h @400/8h = 400
  { id: 'e4', kind: 'service', date: '2026-01-20', projectId: null, serviceId: 's1', customerId: 'c2', start: 540, end: 660, comment: '', attachments: [] }, // flat 900
];

const HOURS_PER_DAY = 8;

describe('earnings helpers', () => {
  test('entryEarnValue applies the day-rate formula and 0 for a missing project', () => {
    expect(entryEarnValue(entries[0], projects[0], undefined, HOURS_PER_DAY)).toBeCloseTo(800);
    expect(entryEarnValue(entries[1], projects[1], undefined, HOURS_PER_DAY)).toBeCloseTo(300);
    expect(entryEarnValue(entries[3], undefined, services[0], HOURS_PER_DAY)).toBeCloseTo(900);
    expect(entryEarnValue(entries[0], undefined, undefined, HOURS_PER_DAY)).toBe(0);
  });

  test('filterEntries applies inclusive date bounds', () => {
    const result = filterEntries(entries, projects, services, { fromISO: '2026-01-01', toISO: '2026-01-31', customerId: null, projectId: null });
    expect(result.map((entry) => entry.id)).toEqual(['e1', 'e2', 'e4']);
  });

  test('filterEntries AND-composes customer and project filters', () => {
    const byCustomer = filterEntries(entries, projects, services, { fromISO: '2026-01-01', toISO: '2026-12-31', customerId: 'c1', projectId: null });
    expect(byCustomer.map((entry) => entry.id)).toEqual(['e1', 'e2']);

    const byProject = filterEntries(entries, projects, services, { fromISO: '2026-01-01', toISO: '2026-12-31', customerId: 'c1', projectId: 'p2' });
    expect(byProject.map((entry) => entry.id)).toEqual(['e2']);

    const serviceByCustomer = filterEntries(entries, projects, services, { fromISO: '2026-01-01', toISO: '2026-12-31', customerId: 'c2', projectId: null });
    expect(serviceByCustomer.map((entry) => entry.id)).toEqual(['e3', 'e4']);
  });

  test('filterEntries treats null customer/project as "all"', () => {
    const result = filterEntries(entries, projects, services, { fromISO: '2026-01-01', toISO: '2026-12-31', customerId: null, projectId: null });
    expect(result).toHaveLength(4);
  });

  test('summarize totals minutes, earnings, days and entry count', () => {
    const projById = { p1: projects[0], p2: projects[1], p3: projects[2] };
    const serviceById = { s1: services[0] };
    const summary = summarize(entries, projById, serviceById, HOURS_PER_DAY);
    expect(summary.count).toBe(4);
    expect(summary.minutes).toBe((1020 - 540) + (780 - 540) + (1020 - 540) + (660 - 540));
    expect(summary.earn).toBeCloseTo(800 + 300 + 400 + 900);
    expect(summary.days).toBeCloseTo(summary.minutes / 60 / HOURS_PER_DAY);
  });

  test('aggregateBy groups by customer, sorts by earnings desc, and shares sum to ~100', () => {
    const rows = aggregateBy(entries, projects, services, customers, 'customer', HOURS_PER_DAY);
    expect(rows.map((row) => row.id)).toEqual(['c2', 'c1']);
    expect(rows[0].earn).toBeCloseTo(1300);
    expect(rows[1].earn).toBeCloseTo(1100);
    const totalShare = rows.reduce((sum, row) => sum + row.sharePct, 0);
    expect(totalShare).toBeCloseTo(100);
  });

  test('aggregateBy groups by project and keeps services as separate groups', () => {
    const rows = aggregateBy(entries, projects, services, customers, 'project', HOURS_PER_DAY);
    expect(rows.map((row) => row.id)).toEqual(['service:s1', 'p1', 'p3', 'p2']);
  });

  test('aggregateBy returns 0 shares when total earnings is 0', () => {
    const zeroRateProjects: Project[] = [{ id: 'p0', name: 'Free', customerId: 'c1', rates: [{ id: 'r0', amount: 0, from: '2026-01-01', to: null }] }];
    const zeroEntries: Entry[] = [{ id: 'e0', kind: 'project', date: '2026-01-05', projectId: 'p0', serviceId: null, customerId: null, start: 540, end: 1020, comment: '', attachments: [] }];
    const rows = aggregateBy(zeroEntries, zeroRateProjects, [], customers, 'customer', HOURS_PER_DAY);
    expect(rows[0].sharePct).toBe(0);
  });
});
