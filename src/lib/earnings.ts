// Earnings analytics helpers: pure aggregation over entries/projects/customers
// already held in memory. Reuses the same day-rate formula as Track/Export
// (see useTempoState.ts's entryEarn / ExportView.tsx) so numbers always match.

import type { Customer, Entry, Project } from '../types';
import { rateForDate } from './rates';

export interface EarningsFilter {
  fromISO: string;
  toISO: string;
  customerId: string | null; // null = all customers
  projectId: string | null; // null = all projects
}

export interface EarningsSummary {
  minutes: number;
  earn: number;
  days: number; // minutes / 60 / hoursPerDay
  count: number; // entry count
}

export interface EarningsGroup {
  id: string;
  name: string;
  color: string; // customer color (own, or owning customer's color for a project)
  minutes: number;
  earn: number;
  sharePct: number; // 0-100 of total earn (0 when total earn is 0)
}

// Value of one entry using the app-wide day-rate formula: a project's rate is
// per full day, prorated by the fraction of a working day the entry spans.
export function entryEarnValue(entry: Entry, project: Project | undefined, hoursPerDay: number): number {
  if (!project) {
    return 0;
  }
  return (((entry.end - entry.start) / 60) / hoursPerDay) * rateForDate(project.rates, entry.date);
}

// AND-composed filter: inclusive date range, plus optional customer/project.
export function filterEntries(entries: Entry[], projects: Project[], filter: EarningsFilter): Entry[] {
  const projById: Record<string, Project> = {};
  projects.forEach((project) => {
    projById[project.id] = project;
  });

  return entries.filter((entry) => {
    if (entry.date < filter.fromISO || entry.date > filter.toISO) {
      return false;
    }
    if (filter.projectId && entry.projectId !== filter.projectId) {
      return false;
    }
    if (filter.customerId) {
      const project = projById[entry.projectId];
      if (!project || project.customerId !== filter.customerId) {
        return false;
      }
    }
    return true;
  });
}

export function summarize(entries: Entry[], projById: Record<string, Project>, hoursPerDay: number): EarningsSummary {
  const minutes = entries.reduce((sum, entry) => sum + (entry.end - entry.start), 0);
  const earn = entries.reduce((sum, entry) => sum + entryEarnValue(entry, projById[entry.projectId], hoursPerDay), 0);
  return {
    minutes,
    earn,
    days: minutes / 60 / hoursPerDay,
    count: entries.length,
  };
}

// groupBy 'customer' buckets by owning customer; 'project' buckets by project.
// Rows are sorted by earnings descending. sharePct is computed against the
// summed earn of all returned rows (0 when the total is 0).
export function aggregateBy(
  entries: Entry[],
  projects: Project[],
  customers: Customer[],
  groupBy: 'customer' | 'project',
  hoursPerDay: number,
): EarningsGroup[] {
  const projById: Record<string, Project> = {};
  projects.forEach((project) => {
    projById[project.id] = project;
  });
  const custById: Record<string, Customer> = {};
  customers.forEach((customer) => {
    custById[customer.id] = customer;
  });

  const buckets = new Map<string, EarningsGroup>();

  entries.forEach((entry) => {
    const project = projById[entry.projectId];
    const customer = project ? custById[project.customerId] : undefined;
    const id = groupBy === 'customer' ? (customer?.id ?? entry.projectId) : entry.projectId;
    const name = groupBy === 'customer' ? (customer?.name ?? 'Unknown') : (project?.name ?? 'Unknown');
    const color = customer?.color ?? '#9ca3af';

    const existing = buckets.get(id);
    const minutes = entry.end - entry.start;
    const earn = entryEarnValue(entry, project, hoursPerDay);

    if (existing) {
      existing.minutes += minutes;
      existing.earn += earn;
    } else {
      buckets.set(id, { id, name, color, minutes, earn, sharePct: 0 });
    }
  });

  const rows = Array.from(buckets.values());
  const totalEarn = rows.reduce((sum, row) => sum + row.earn, 0);
  rows.forEach((row) => {
    row.sharePct = totalEarn > 0 ? (row.earn / totalEarn) * 100 : 0;
  });

  return rows.sort((a, b) => b.earn - a.earn);
}
