import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type MouseEvent } from 'react';

import { addDays, addMonths, fmtMonthYear, fmtShortDate, fmtShortDateYear, iso, isoWeekNumber, parseISO, startOfWeek } from '../lib/dates';
import { fmtEUR, fmtH, fmtBytes, hexToRgba, hoursToMinutes, minutesToHours, uid } from '../lib/format';
import { addRatePeriod, currentRatePeriod, hasOverlap, rateForDate, sortRates } from '../lib/rates';
import * as store from '../lib/store';
import type {
  AppHeaderProps,
  ColorSwatchVM,
  Customer,
  CustomerDetailProjectRowVM,
  CustomerDetailViewProps,
  CustomerForm,
  CustomersViewProps,
  DayListRowVM,
  EarningsFilterSeed,
  EarningsViewProps,
  Entry,
  EntryForm,
  ExportScope,
  ExportViewProps,
  ModalProps,
  ModalState,
  Page,
  PersistedData,
  Project,
  ProjectDetailViewProps,
  ProjectForm,
  ProjectsViewProps,
  RatePeriod,
  RatePeriodRowVM,
  Service,
  ServiceDetailViewProps,
  ServiceForm,
  ServicesViewProps,
  SettingsViewProps,
  SidebarProps,
  SyncStatus,
  TempoSettings,
  TempoViewModel,
  MonthHeatmapDayVM,
  TrackDayVM,
  TrackViewProps,
} from '../types';

const PALETTE = ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#db2777', '#65a30d', '#0891b2', '#dc2626'];

function colorForProject(project: Project | undefined, custById: Record<string, Customer>): string {
  if (!project) {
    return '#9ca3af';
  }
  return custById[project.customerId]?.color || '#9ca3af';
}

function colorForServiceEntry(entry: Entry, custById: Record<string, Customer>): string {
  return entry.customerId ? (custById[entry.customerId]?.color || '#9ca3af') : '#9ca3af';
}

function labelForEntry(
  entry: Entry,
  projById: Record<string, Project>,
  serviceById: Record<string, Service>,
  custById: Record<string, Customer>,
): string {
  if (entry.kind === 'service') {
    const serviceName = serviceById[entry.serviceId ?? '']?.name || '—';
    const customerName = custById[entry.customerId ?? '']?.name || '—';
    return `${serviceName} — ${customerName}`;
  }
  if (entry.kind === 'customer') {
    return custById[entry.customerId ?? '']?.name || '—';
  }
  return projById[entry.projectId ?? '']?.name || '—';
}

function colorForEntry(
  entry: Entry,
  projById: Record<string, Project>,
  custById: Record<string, Customer>,
): string {
  return entry.kind === 'service' || entry.kind === 'customer'
    ? colorForServiceEntry(entry, custById)
    : colorForProject(projById[entry.projectId ?? ''], custById);
}

type TempoState = PersistedData & {
  page: Page;
  refISO: string;
  modal: ModalState | null;
  demoMode: boolean;
  syncStatus: SyncStatus;
  stateEtag: string;
  attachmentUploading: boolean;
  attachmentError: string;
  userDisplayName: string;
  selectedCustomerId: string | null;
  selectedProjectId: string | null;
  selectedServiceId: string | null;
  projectDraft: ProjectForm | null;
  projectOrigin: ProjectOrigin | null;
  serviceDraft: ServiceForm | null;
  exportScope: ExportScope | null;
  earningsFilter: EarningsFilterSeed | null;
};

type ProjectOrigin = { page: 'projects' } | { page: 'customerDetail'; customerId: string };
type EntryDraft = Pick<Entry, 'kind' | 'projectId' | 'serviceId' | 'customerId' | 'date' | 'minutes' | 'comment'> & Partial<Pick<Entry, 'id' | 'attachments' | 'amount'>>;

type RenderCtx = {
  S: TempoState;
  acc: string;
  hpd: number;
  showWeekend: boolean;
  ref: Date;
  todayISO: string;
  projById: Record<string, Project>;
  serviceById: Record<string, Service>;
  custById: Record<string, Customer>;
  entryEarn: (entry: Entry) => number;
  isTrack: boolean;
  isProjects: boolean;
  isServices: boolean;
  isCustomers: boolean;
  isSettings: boolean;
  isCustomerDetail: boolean;
  isProjectDetail: boolean;
  isServiceDetail: boolean;
  isExport: boolean;
  isEarnings: boolean;
  navSection: 'track' | 'projects' | 'services' | 'customers' | 'settings' | 'export' | 'earnings';
  heatmapAnchor: Date;
};

function getHoursPerDay(settings: TempoSettings): number {
  const value = Number(settings.hoursPerDay);
  return value > 0 ? value : 8;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function navStyle(active: boolean, accent: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '11px',
    width: '100%',
    minHeight: '44px',
    padding: '9px 12px',
    borderRadius: '9px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
    fontWeight: active ? 600 : 500,
    background: active ? hexToRgba(accent, 0.1) : 'transparent',
    color: active ? accent : '#3a3f48',
  };
}

function createEmptyData(): PersistedData {
  return {
    customers: [],
    projects: [],
    services: [],
    entries: [],
  };
}

function createStateFromData(data: PersistedData, demoMode: boolean): TempoState {
  const today = new Date();

  return {
    page: 'track',
    refISO: iso(today),
    customers: data.customers,
    projects: data.projects,
    services: data.services,
    entries: data.entries,
    modal: null,
    demoMode,
    syncStatus: 'idle',
    stateEtag: '',
    attachmentUploading: false,
    attachmentError: '',
    userDisplayName: '',
    selectedCustomerId: null,
    selectedProjectId: null,
    selectedServiceId: null,
    projectDraft: null,
    projectOrigin: null,
    serviceDraft: null,
    exportScope: null,
    earningsFilter: null,
  };
}

function makeProjectEntry(
  id: string,
  date: string,
  projectId: string,
  minutes: number,
  comment: string,
): Entry {
  return { id, kind: 'project', date, projectId, serviceId: null, customerId: null, amount: null, minutes, comment, attachments: [] };
}

function createDemoSeed(): PersistedData {
  const customers: Customer[] = [
    { id: 'c1', name: 'Northwind Studio', color: '#2563eb' },
    { id: 'c2', name: 'Meridian Health', color: '#7c3aed' },
    { id: 'c3', name: 'Atlas Logistics', color: '#db2777' },
  ];
  const seedRate = (id: string, amount: number): RatePeriod[] => [{ id, amount, from: '2020-01-01', to: null }];
  const projects: Project[] = [
    { id: 'p1', name: 'Website Redesign', customerId: 'c1', rates: seedRate('r1', 650) },
    { id: 'p2', name: 'Mobile App', customerId: 'c1', rates: seedRate('r2', 720) },
    { id: 'p3', name: 'Brand System', customerId: 'c2', rates: seedRate('r3', 800) },
    { id: 'p4', name: 'Analytics Dashboard', customerId: 'c2', rates: seedRate('r4', 680) },
    { id: 'p5', name: 'Logistics Portal', customerId: 'c3', rates: seedRate('r5', 600) },
  ];

  const weekStart = startOfWeek(new Date());
  const dayISO = (offset: number): string => iso(addDays(weekStart, offset));

  return {
    customers,
    projects,
    services: [
      { id: 's1', name: 'Workshop', rates: seedRate('sr1', 1200) },
      { id: 's2', name: 'Training', rates: seedRate('sr2', 900) },
    ],
    entries: [
      makeProjectEntry('e1', dayISO(0), 'p1', 210, 'Wireframe review & IA'),
      makeProjectEntry('e2', dayISO(0), 'p3', 150, 'Logo exploration'),
      makeProjectEntry('e3', dayISO(1), 'p2', 150, 'Onboarding flow'),
      makeProjectEntry('e4', dayISO(1), 'p4', 210, 'Charts components'),
      makeProjectEntry('e5', dayISO(2), 'p1', 240, 'Homepage build'),
      makeProjectEntry('e6', dayISO(2), 'p5', 120, 'API field mapping'),
      { id: 'e7', kind: 'service', date: dayISO(3), projectId: null, serviceId: 's1', customerId: 'c2', amount: null, minutes: 120, comment: 'Workshop facilitation', attachments: [] },
      makeProjectEntry('e8', dayISO(3), 'p2', 240, 'Push notifications'),
      makeProjectEntry('e9', dayISO(4), 'p1', 150, 'QA & polish'),
      { id: 'e10', kind: 'service', date: dayISO(4), projectId: null, serviceId: 's2', customerId: 'c1', amount: null, minutes: 150, comment: 'Team training', attachments: [] },
    ],
  };
}

function loadOrCreateDemoData(): PersistedData {
  const saved = store.loadDemoData();
  if (saved) {
    return saved;
  }

  const seed = createDemoSeed();
  store.saveDemoData(seed);
  return seed;
}

function getStoreData(demoMode: boolean): PersistedData {
  if (demoMode) {
    return loadOrCreateDemoData();
  }

  return store.loadData() || createEmptyData();
}

function getSyncStatusMeta(demoMode: boolean, syncStatus: SyncStatus): { label: string; color: string } {
  if (demoMode) {
    return { label: 'Demo mode (not synced)', color: '#9ca3af' };
  }

  if (syncStatus === 'syncing') {
    return { label: 'Syncing…', color: '#9ca3af' };
  }

  if (syncStatus === 'synced') {
    return { label: 'Synced', color: '#16a34a' };
  }

  if (syncStatus === 'conflict') {
    return { label: 'Reloaded newer data', color: '#d97706' };
  }

  if (syncStatus === 'error') {
    return { label: 'Sync failed', color: '#dc2626' };
  }

  return { label: 'Saved in browser', color: '#9ca3af' };
}

function createInitialState(): TempoState {
  const demoMode = store.getDemoModeFlag();
  return createStateFromData(getStoreData(demoMode), demoMode);
}

export function useTempoState(settings: TempoSettings): TempoViewModel {
  const [state, setState] = useState<TempoState>(createInitialState);
  const stateRef = useRef(state);
  const skipNextPushRef = useRef(false);
  // The month heatmap normally follows the active ledger week (ref), but the
  // user can browse other months/years independently via the heatmap's own
  // nav controls. `null` means "follow the ledger"; it resets to that once
  // the ledger's own navigation (setRefISO) moves to a different month.
  const [heatmapAnchorISO, setHeatmapAnchorISO] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const openEntry = useCallback((entry: EntryDraft, isNew: boolean) => {
    setState((current) => ({
      ...current,
      modal: {
        type: 'entry',
        isNew,
        form: {
          id: entry.id || uid(),
          kind: entry.kind,
          projectId: entry.projectId ?? '',
          serviceId: entry.serviceId ?? '',
          customerId: entry.customerId ?? '',
          amount: entry.amount != null ? String(entry.amount) : '',
          date: entry.date,
          hours: minutesToHours(entry.minutes),
          repeat: false,
          endDate: entry.date,
          skipWeekends: true,
          comment: entry.comment || '',
          attachments: entry.attachments ?? [],
        },
      },
    }));
  }, []);

  const openNewEntryForDate = useCallback((dateISO: string) => {
    const kind = stateRef.current.projects[0] ? 'project' : 'service';
    openEntry({
      kind,
      projectId: kind === 'project' ? (stateRef.current.projects[0]?.id || '') : null,
      serviceId: kind === 'service' ? (stateRef.current.services[0]?.id || '') : null,
      customerId: kind === 'service' ? (stateRef.current.customers[0]?.id || '') : null,
      date: dateISO,
      minutes: 60,
      comment: '',
    }, true);
  }, [openEntry]);

  const openNewEntry = useCallback(() => {
    openNewEntryForDate(stateRef.current.refISO);
  }, [openNewEntryForDate]);

  const draftFromProject = useCallback((project: Project | null, customers: Customer[], presetCustomerId?: string): ProjectForm => (
    project
      ? {
          id: project.id,
          name: project.name,
          customerId: project.customerId,
          rates: project.rates,
          newRateAmount: String(currentRatePeriod(project.rates)?.amount ?? ''),
          newRateFrom: iso(new Date()),
        }
      : {
          id: null,
          name: '',
          customerId: presetCustomerId || customers[0]?.id || '',
          rates: [{ id: uid(), amount: 600, from: iso(new Date()), to: null }],
          newRateAmount: '600',
          newRateFrom: iso(new Date()),
        }
  ), []);

  const openProjectDetail = useCallback((project: Project | null, origin: ProjectOrigin, presetCustomerId?: string) => {
    setState((current) => ({
      ...current,
      page: 'projectDetail',
      selectedProjectId: project?.id ?? null,
      selectedServiceId: null,
      projectOrigin: origin,
      projectDraft: draftFromProject(project, current.customers, presetCustomerId),
      serviceDraft: null,
    }));
  }, [draftFromProject]);

  const draftFromService = useCallback((service: Service | null): ServiceForm => (
    service
      ? {
          id: service.id,
          name: service.name,
          rates: service.rates,
          newRateAmount: String(currentRatePeriod(service.rates)?.amount ?? ''),
          newRateFrom: iso(new Date()),
        }
      : {
          id: null,
          name: '',
          rates: [{ id: uid(), amount: 600, from: iso(new Date()), to: null }],
          newRateAmount: '600',
          newRateFrom: iso(new Date()),
        }
  ), []);

  const openServiceDetail = useCallback((service: Service | null) => {
    setState((current) => ({
      ...current,
      page: 'serviceDetail',
      selectedProjectId: null,
      selectedServiceId: service?.id ?? null,
      projectDraft: null,
      projectOrigin: null,
      serviceDraft: draftFromService(service),
    }));
  }, [draftFromService]);

  const backFromProjectDetail = useCallback(() => {
    setState((current) => {
      const origin = current.projectOrigin;
      return {
        ...current,
        page: origin?.page === 'customerDetail' ? 'customerDetail' : 'projects',
        selectedCustomerId: origin?.page === 'customerDetail' ? origin.customerId : current.selectedCustomerId,
        selectedProjectId: null,
        projectDraft: null,
        projectOrigin: null,
      };
    });
  }, []);

  const backFromServiceDetail = useCallback(() => {
    setState((current) => ({
      ...current,
      page: 'services',
      selectedServiceId: null,
      serviceDraft: null,
    }));
  }, []);

  const navCustomerDetail = useCallback((customerId: string) => {
    setState((current) => ({ ...current, page: 'customerDetail', selectedCustomerId: customerId }));
  }, []);

  const backToCustomers = useCallback(() => {
    setState((current) => ({ ...current, page: 'customers', selectedCustomerId: null }));
  }, []);

  const openCustomer = useCallback((customer: Customer | null) => {
    setState((current) => ({
      ...current,
      modal: {
        type: 'customer',
        isNew: !customer,
        form: customer
          ? { id: customer.id, name: customer.name, color: customer.color }
          : { id: null, name: '', color: PALETTE[current.customers.length % PALETTE.length] },
      },
    }));
  }, []);

  const openSettings = useCallback(() => {
    setState((current) => ({ ...current, page: 'settings' }));
  }, []);

  const closeModal = useCallback(() => {
    setState((current) => ({ ...current, modal: null }));
  }, []);

  const updateForm = useCallback((key: string, value: string | boolean) => {
    setState((current) => {
      if (!current.modal) {
        return current;
      }

      return {
        ...current,
        modal: {
          ...current.modal,
          form: {
            ...current.modal.form,
            [key]: value,
          },
        },
      };
    });
  }, []);

  const updateProjectDraft = useCallback((key: 'name' | 'customerId' | 'newRateAmount' | 'newRateFrom', value: string) => {
    setState((current) => {
      if (!current.projectDraft) {
        return current;
      }

      return { ...current, projectDraft: { ...current.projectDraft, [key]: value } };
    });
  }, []);

  const updateProjectDraftRates = useCallback((rates: RatePeriod[]) => {
    setState((current) => {
      if (!current.projectDraft) {
        return current;
      }

      return { ...current, projectDraft: { ...current.projectDraft, rates } };
    });
  }, []);

  const addRate = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft) {
      return;
    }

    const amount = Number.parseFloat(draft.newRateAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !draft.newRateFrom) {
      return;
    }

    const next = addRatePeriod(draft.rates, uid(), amount, draft.newRateFrom);
    if (next === draft.rates) {
      window.alert('New rate must start after the current period began.');
      return;
    }

    updateProjectDraftRates(next);
  }, [updateProjectDraftRates]);

  const updateRateField = useCallback((id: string, field: 'amount' | 'from' | 'to', value: string) => {
    const draft = stateRef.current.projectDraft;
    if (!draft) {
      return;
    }

    const next = draft.rates.map((rate) => {
      if (rate.id !== id) {
        return rate;
      }

      if (field === 'amount') {
        return { ...rate, amount: Number.parseFloat(value) || 0 };
      }
      if (field === 'from') {
        return { ...rate, from: value };
      }
      return { ...rate, to: value || null };
    });

    updateProjectDraftRates(next);
  }, [updateProjectDraftRates]);

  const deleteRate = useCallback((id: string) => {
    const draft = stateRef.current.projectDraft;
    if (!draft || draft.rates.length <= 1) {
      return;
    }

    updateProjectDraftRates(draft.rates.filter((rate) => rate.id !== id));
  }, [updateProjectDraftRates]);

  const saveProjectDraft = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft || !draft.name.trim() || draft.rates.length === 0) {
      return;
    }

    if (hasOverlap(draft.rates)) {
      window.alert('Rate periods overlap. Adjust the from/to dates before saving.');
      return;
    }

    const rates = sortRates(draft.rates);
    setState((current) => {
      const id = draft.id || uid();
      const savedProject: Project = {
        id,
        name: draft.name.trim(),
        customerId: draft.customerId,
        rates,
      };

      return {
        ...current,
        projects: draft.id
          ? current.projects.map((project) => (project.id === draft.id ? savedProject : project))
          : [...current.projects, savedProject],
        selectedProjectId: id,
        projectDraft: { ...draft, id, rates },
      };
    });
  }, []);

  const deleteProjectDraft = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft || !draft.id) {
      return;
    }

    const id = draft.id;
    setState((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      entries: current.entries.filter((entry) => entry.projectId !== id),
    }));
    backFromProjectDetail();
  }, [backFromProjectDetail]);

  const updateServiceDraft = useCallback((key: 'name' | 'newRateAmount' | 'newRateFrom', value: string) => {
    setState((current) => {
      if (!current.serviceDraft) {
        return current;
      }

      return { ...current, serviceDraft: { ...current.serviceDraft, [key]: value } };
    });
  }, []);

  const updateServiceDraftRates = useCallback((rates: RatePeriod[]) => {
    setState((current) => {
      if (!current.serviceDraft) {
        return current;
      }

      return { ...current, serviceDraft: { ...current.serviceDraft, rates } };
    });
  }, []);

  const addServiceRate = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft) {
      return;
    }

    const amount = Number.parseFloat(draft.newRateAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !draft.newRateFrom) {
      return;
    }

    const next = addRatePeriod(draft.rates, uid(), amount, draft.newRateFrom);
    if (next === draft.rates) {
      window.alert('New rate must start after the current period began.');
      return;
    }

    updateServiceDraftRates(next);
  }, [updateServiceDraftRates]);

  const updateServiceRateField = useCallback((id: string, field: 'amount' | 'from' | 'to', value: string) => {
    const draft = stateRef.current.serviceDraft;
    if (!draft) {
      return;
    }

    const next = draft.rates.map((rate) => {
      if (rate.id !== id) {
        return rate;
      }

      if (field === 'amount') {
        return { ...rate, amount: Number.parseFloat(value) || 0 };
      }
      if (field === 'from') {
        return { ...rate, from: value };
      }
      return { ...rate, to: value || null };
    });

    updateServiceDraftRates(next);
  }, [updateServiceDraftRates]);

  const deleteServiceRate = useCallback((id: string) => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || draft.rates.length <= 1) {
      return;
    }

    updateServiceDraftRates(draft.rates.filter((rate) => rate.id !== id));
  }, [updateServiceDraftRates]);

  const saveServiceDraft = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || !draft.name.trim() || draft.rates.length === 0) {
      return;
    }

    if (hasOverlap(draft.rates)) {
      window.alert('Rate periods overlap. Adjust the from/to dates before saving.');
      return;
    }

    const rates = sortRates(draft.rates);
    setState((current) => {
      const id = draft.id || uid();
      const savedService: Service = {
        id,
        name: draft.name.trim(),
        rates,
      };

      return {
        ...current,
        services: draft.id
          ? current.services.map((service) => (service.id === draft.id ? savedService : service))
          : [...current.services, savedService],
        selectedServiceId: id,
        serviceDraft: { ...draft, id, rates },
      };
    });
  }, []);

  const deleteServiceDraft = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || !draft.id) {
      return;
    }

    const id = draft.id;
    setState((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== id),
      entries: current.entries.filter((entry) => entry.serviceId !== id),
    }));
    backFromServiceDetail();
  }, [backFromServiceDetail]);

  const pushStateNow = useCallback(async () => {
    const current = stateRef.current;
    if (current.demoMode) {
      return;
    }

    const data: PersistedData = {
      customers: current.customers,
      projects: current.projects,
      services: current.services,
      entries: current.entries,
    };

    setState((snapshot) => ({ ...snapshot, syncStatus: 'syncing' }));

    try {
      const result = await store.saveState(data, stateRef.current.stateEtag);
      setState((snapshot) => ({ ...snapshot, stateEtag: result.etag, syncStatus: 'synced' }));
    } catch (error) {
      if (error instanceof store.ConflictError) {
        // Someone else (another tab/device) saved in between. Reload the
        // remote copy rather than blindly overwriting it.
        try {
          const remote = await store.fetchState();
          setState((snapshot) => ({
            ...snapshot,
            customers: remote.data.customers,
            projects: remote.data.projects,
            services: remote.data.services,
            entries: remote.data.entries,
            stateEtag: remote.etag,
            syncStatus: 'conflict',
          }));
        } catch {
          setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
        }
        return;
      }

      setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
    }
  }, []);

  const pullStateNow = useCallback(async () => {
    if (stateRef.current.demoMode) {
      return;
    }

    setState((snapshot) => ({ ...snapshot, syncStatus: 'syncing' }));

    try {
      const remote = await store.fetchState();
      setState((snapshot) => ({
        ...snapshot,
        customers: remote.data.customers,
        projects: remote.data.projects,
        services: remote.data.services,
        entries: remote.data.entries,
        stateEtag: remote.etag,
        syncStatus: 'synced',
      }));
    } catch {
      setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
    }
  }, []);

  const onAddAttachments = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const modal = stateRef.current.modal;
    if (!files || files.length === 0 || !modal || modal.type !== 'entry') {
      return;
    }

    const entryId = (modal.form as EntryForm).id;
    if (!entryId) {
      return;
    }

    setState((current) => ({ ...current, attachmentUploading: true, attachmentError: '' }));

    try {
      for (const file of Array.from(files)) {
        const attachment = await store.uploadAttachment(entryId, file);
        setState((current) => {
          if (!current.modal || current.modal.type !== 'entry') {
            return current;
          }
          const form = current.modal.form as EntryForm;
          return {
            ...current,
            modal: { ...current.modal, form: { ...form, attachments: [...form.attachments, attachment] } },
          };
        });
      }
      setState((current) => ({ ...current, attachmentUploading: false }));
    } catch {
      setState((current) => ({ ...current, attachmentUploading: false, attachmentError: 'Failed to upload one or more files.' }));
    } finally {
      event.target.value = '';
    }
  }, []);

  const onDeleteAttachment = useCallback((attachmentId: string) => {
    const modal = stateRef.current.modal;
    if (!modal || modal.type !== 'entry') {
      return;
    }

    const entryId = (modal.form as EntryForm).id;
    if (!entryId) {
      return;
    }

    void store.deleteAttachment(entryId, attachmentId);
    setState((current) => {
      if (!current.modal || current.modal.type !== 'entry') {
        return current;
      }
      const form = current.modal.form as EntryForm;
      return {
        ...current,
        modal: { ...current.modal, form: { ...form, attachments: form.attachments.filter((item) => item.id !== attachmentId) } },
      };
    });
  }, []);

  const onDownloadAttachment = useCallback(async (entryId: string, attachmentId: string) => {
    try {
      const url = await store.getAttachmentDownloadUrl(entryId, attachmentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setState((current) => ({ ...current, attachmentError: 'Failed to open attachment.' }));
    }
  }, []);

  const signOut = useCallback(() => {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
  }, []);

  const saveModal = useCallback(() => {
    const modal = stateRef.current.modal;
    if (!modal) {
      return;
    }

    if (modal.type === 'entry') {
      const form = modal.form as EntryForm;
      const minutes = hoursToMinutes(form.hours);
      const invalidProject = form.kind === 'project' && !form.projectId;
      const invalidService = form.kind === 'service' && (!form.serviceId || !form.customerId);
      const parsedAmount = Number(form.amount);
      const invalidCustomer = form.kind === 'customer' && (!form.customerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0);
      if (invalidProject || invalidService || invalidCustomer || !Number.isFinite(minutes) || minutes <= 0) {
        return;
      }

      const buildEntry = (id: string, date: string, attachments: EntryForm['attachments']): Entry => ({
        id,
        kind: form.kind,
        projectId: form.kind === 'project' ? form.projectId : null,
        serviceId: form.kind === 'service' ? form.serviceId : null,
        customerId: form.kind === 'service' || form.kind === 'customer' ? form.customerId : null,
        amount: form.kind === 'customer' ? parsedAmount : null,
        date,
        minutes,
        comment: form.comment,
        attachments,
      });

      if (modal.isNew && form.repeat) {
        const startDate = parseISO(form.date);
        const endDate = parseISO(form.endDate);
        if (endDate < startDate) {
          return;
        }
        const newEntries: Entry[] = [];
        for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
          if (form.skipWeekends && isWeekend(cursor)) {
            continue;
          }
          newEntries.push(buildEntry(uid(), iso(cursor), []));
        }
        if (newEntries.length === 0) {
          return;
        }
        setState((current) => ({
          ...current,
          entries: [...current.entries, ...newEntries],
          modal: null,
        }));
        return;
      }

      const id = form.id ?? uid();
      const savedEntry = buildEntry(id, form.date, form.attachments);
      setState((current) => ({
        ...current,
        entries: current.entries.some((entry) => entry.id === id)
            ? current.entries.map((entry) => (
                entry.id === id ? savedEntry : entry
              ))
            : [
              ...current.entries,
              savedEntry,
            ],
        modal: null,
      }));
      return;
    }

    if (modal.type === 'customer') {
      const form = modal.form as CustomerForm;
      if (!form.name.trim()) {
        return;
      }

      setState((current) => ({
        ...current,
        customers: form.id
          ? current.customers.map((customer) => (
              customer.id === form.id ? { ...customer, name: form.name.trim() } : customer
            ))
          : [...current.customers, { id: uid(), name: form.name.trim(), color: form.color }],
        modal: null,
      }));
      return;
    }

  }, []);

  const deleteCustomerById = useCallback((id: string) => {
    setState((current) => {
      const projectIds = current.projects.filter((project) => project.customerId === id).map((project) => project.id);
      return {
        ...current,
        customers: current.customers.filter((customer) => customer.id !== id),
        projects: current.projects.filter((project) => project.customerId !== id),
        entries: current.entries.filter((entry) => !projectIds.includes(entry.projectId ?? '') && entry.customerId !== id),
        page: 'customers',
        selectedCustomerId: null,
      };
    });
  }, []);

  const deleteModal = useCallback(() => {
    const modal = stateRef.current.modal;
    if (!modal || modal.isNew) {
      return;
    }

    if (modal.type === 'entry') {
      const id = (modal.form as EntryForm).id;
      if (!id) {
        return;
      }

      const attachments = (modal.form as EntryForm).attachments;
      attachments.forEach((attachment) => {
        void store.deleteAttachment(id, attachment.id);
      });

      setState((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.id !== id),
        modal: null,
      }));
      return;
    }

    const id = (modal.form as CustomerForm).id;
    if (!id) {
      return;
    }

    setState((current) => {
      const projectIds = current.projects.filter((project) => project.customerId === id).map((project) => project.id);
      return {
        ...current,
        customers: current.customers.filter((customer) => customer.id !== id),
        projects: current.projects.filter((project) => project.customerId !== id),
        entries: current.entries.filter((entry) => !projectIds.includes(entry.projectId ?? '') && entry.customerId !== id),
        modal: null,
      };
    });
  }, []);

  const resetData = useCallback(() => {
    if (!window.confirm('Delete all data? This cannot be undone.')) {
      return;
    }

    skipNextPushRef.current = true;
    setState((current) => {
      if (current.demoMode) {
        store.clearDemoData();
        const demoData = createDemoSeed();
        store.saveDemoData(demoData);
        return {
          ...current,
          customers: demoData.customers,
          projects: demoData.projects,
          services: demoData.services,
          entries: demoData.entries,
          page: 'track',
          modal: null,
          syncStatus: 'idle',
          selectedCustomerId: null,
          selectedProjectId: null,
          selectedServiceId: null,
          projectDraft: null,
          projectOrigin: null,
          serviceDraft: null,
          exportScope: null,
          earningsFilter: null,
        };
      }

      store.clearData();
      const emptyData = createEmptyData();
      return {
        ...current,
        customers: emptyData.customers,
        projects: emptyData.projects,
        services: emptyData.services,
        entries: emptyData.entries,
        page: 'track',
        modal: null,
        syncStatus: 'idle',
        selectedCustomerId: null,
        selectedProjectId: null,
        selectedServiceId: null,
        projectDraft: null,
        projectOrigin: null,
        serviceDraft: null,
        exportScope: null,
        earningsFilter: null,
      };
    });
  }, []);

  const onToggleDemoMode = useCallback(() => {
    setState((current) => {
      const nextDemoMode = !current.demoMode;
      const data = getStoreData(nextDemoMode);
      store.setDemoModeFlag(nextDemoMode);

      return {
        ...current,
        customers: data.customers,
        projects: data.projects,
        services: data.services,
        entries: data.entries,
        demoMode: nextDemoMode,
        modal: null,
        syncStatus: 'idle',
        selectedCustomerId: null,
        selectedProjectId: null,
        selectedServiceId: null,
        projectDraft: null,
        projectOrigin: null,
        serviceDraft: null,
      };
    });
  }, []);

  const setPage = useCallback((page: Page) => {
    setState((current) => ({
      ...current,
      page,
      selectedCustomerId: null,
      selectedProjectId: null,
      selectedServiceId: null,
      projectDraft: null,
      projectOrigin: null,
      serviceDraft: null,
      exportScope: null,
      earningsFilter: null,
    }));
  }, []);

  const openExport = useCallback((scope: ExportScope | null) => {
    setState((current) => ({ ...current, page: 'export', exportScope: scope }));
  }, []);

  const openEarnings = useCallback((seed: EarningsFilterSeed | null) => {
    setState((current) => ({ ...current, page: 'earnings', earningsFilter: seed }));
  }, []);

  const setRefISO = useCallback((refISO: string) => {
    setState((current) => ({ ...current, refISO }));
    setHeatmapAnchorISO(null);
  }, []);

  const shiftHeatmapAnchor = useCallback((months: number) => {
    setHeatmapAnchorISO((current) => {
      const base = current ? parseISO(current) : parseISO(stateRef.current.refISO);
      return iso(addMonths(base, months));
    });
  }, []);

  const onHeatmapPrevMonth = useCallback(() => shiftHeatmapAnchor(-1), [shiftHeatmapAnchor]);
  const onHeatmapNextMonth = useCallback(() => shiftHeatmapAnchor(1), [shiftHeatmapAnchor]);
  const onHeatmapPrevYear = useCallback(() => shiftHeatmapAnchor(-12), [shiftHeatmapAnchor]);
  const onHeatmapNextYear = useCallback(() => shiftHeatmapAnchor(12), [shiftHeatmapAnchor]);

  useEffect(() => {
    const data = {
      customers: state.customers,
      projects: state.projects,
      services: state.services,
      entries: state.entries,
    };

    if (state.demoMode) {
      store.saveDemoData(data);
      return;
    }

    store.saveData(data);
  }, [state.customers, state.demoMode, state.entries, state.projects, state.services]);

  // Fetch the current user's identity once on mount so Settings can show who's
  // signed in (see the "owner" role gate in staticwebapp.config.json).
  useEffect(() => {
    fetch('/.auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { clientPrincipal?: { userDetails?: string } } | null) => {
        const userDetails = body?.clientPrincipal?.userDetails;
        if (userDetails) {
          setState((current) => ({ ...current, userDisplayName: userDetails }));
        }
      })
      .catch(() => {
        // No auth proxy in local dev; ignore.
      });
  }, []);

  useEffect(() => {
    if (!state.demoMode) {
      void pullStateNow();
    }
  }, [state.demoMode, pullStateNow]);

  useEffect(() => {
    if (state.demoMode) {
      return undefined;
    }

    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void pushStateNow();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [state.customers, state.demoMode, state.entries, state.projects, state.services, pushStateNow]);

  const hpd = getHoursPerDay(settings);
  const ref = parseISO(state.refISO);
  const todayISO = iso(new Date());

  const projById = useMemo<Record<string, Project>>(() => {
    const next: Record<string, Project> = {};
    state.projects.forEach((project) => {
      next[project.id] = project;
    });
    return next;
  }, [state.projects]);

  const serviceById = useMemo<Record<string, Service>>(() => {
    const next: Record<string, Service> = {};
    state.services.forEach((service) => {
      next[service.id] = service;
    });
    return next;
  }, [state.services]);

  const custById = useMemo<Record<string, Customer>>(() => {
    const next: Record<string, Customer> = {};
    state.customers.forEach((customer) => {
      next[customer.id] = customer;
    });
    return next;
  }, [state.customers]);

  const entryEarn = useCallback((entry: Entry) => {
    if (entry.kind === 'customer') {
      return entry.amount ?? 0;
    }
    if (entry.kind === 'service') {
      const service = serviceById[entry.serviceId ?? ''];
      return service ? rateForDate(service.rates, entry.date) : 0;
    }
    const project = projById[entry.projectId ?? ''];
    return project ? (((entry.minutes) / 60) / hpd) * rateForDate(project.rates, entry.date) : 0;
  }, [hpd, projById, serviceById]);

  const isCustomerDetail = state.page === 'customerDetail';
  const isProjectDetail = state.page === 'projectDetail';
  const isServiceDetail = state.page === 'serviceDetail';
  const navSection: RenderCtx['navSection'] = isCustomerDetail
    ? 'customers'
    : isProjectDetail
      ? (state.projectOrigin?.page === 'customerDetail' ? 'customers' : 'projects')
      : isServiceDetail
        ? 'services'
        : (state.page === 'projects' || state.page === 'services' || state.page === 'customers' || state.page === 'settings' || state.page === 'export' || state.page === 'earnings' ? state.page : 'track');

  const ctx: RenderCtx = {
    S: state,
    acc: settings.accentColor || '#2563eb',
    hpd,
    showWeekend: settings.showWeekend,
    ref,
    todayISO,
    projById,
    serviceById,
    custById,
    entryEarn,
    isTrack: state.page === 'track',
    isProjects: state.page === 'projects',
    isServices: state.page === 'services',
    isCustomers: state.page === 'customers',
    isSettings: state.page === 'settings',
    isCustomerDetail,
    isProjectDetail,
    isServiceDetail,
    isExport: state.page === 'export',
    isEarnings: state.page === 'earnings',
    navSection,
    heatmapAnchor: heatmapAnchorISO ? parseISO(heatmapAnchorISO) : ref,
  };

  const sidebarProps = useMemo<SidebarProps>(() => {
    const periodLabel = 'This week';
    const weekStart = startOfWeek(ctx.ref);
    const dayCount = ctx.showWeekend ? 7 : 5;
    const weekISOs = new Set<string>();
    for (let day = 0; day < dayCount; day += 1) {
      weekISOs.add(iso(addDays(weekStart, day)));
    }
    const periodEntries = ctx.S.entries.filter((entry) => weekISOs.has(entry.date));

    const periodMinutes = periodEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const periodEarn = periodEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const { label: syncLabel, color: syncColor } = getSyncStatusMeta(ctx.S.demoMode, ctx.S.syncStatus);

    return {
      logoStyle: {
        width: '27px',
        height: '27px',
        borderRadius: '8px',
        background: ctx.acc,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '15px',
        flexShrink: 0,
      },
      navTrackStyle: navStyle(ctx.navSection === 'track', ctx.acc),
      navProjectsStyle: navStyle(ctx.navSection === 'projects', ctx.acc),
      navServicesStyle: navStyle(ctx.navSection === 'services', ctx.acc),
      navCustomersStyle: navStyle(ctx.navSection === 'customers', ctx.acc),
      navExportStyle: navStyle(ctx.navSection === 'export', ctx.acc),
      navEarningsStyle: navStyle(ctx.navSection === 'earnings', ctx.acc),
      onNavTrack: () => setPage('track'),
      onNavProjects: () => setPage('projects'),
      onNavServices: () => setPage('services'),
      onNavCustomers: () => setPage('customers'),
      onNavExport: () => openExport(null),
      onNavEarnings: () => openEarnings(null),
      periodLabel,
      weekHours: fmtH(periodMinutes),
      weekDaysStr: (periodMinutes / 60 / ctx.hpd).toFixed(1),
      weekEarnStr: fmtEUR(periodEarn),
      syncColor,
      syncLabel,
      onOpenSettings: openSettings,
    };
  }, [ctx, openEarnings, openExport, openSettings, setPage]);

  const headerProps = useMemo<AppHeaderProps>(() => {
    const weekStart = startOfWeek(ctx.ref);
    const weekEnd = addDays(weekStart, 6);
    const weekRange = `${fmtShortDate(weekStart)} – ${fmtShortDateYear(weekEnd)}`;

    const diffWeeks = Math.round((weekStart.getTime() - startOfWeek(new Date()).getTime()) / (7 * 86400000));

    const relWeek = diffWeeks === 0
      ? 'This week'
      : diffWeeks === -1
        ? 'Last week'
        : diffWeeks === 1
          ? 'Next week'
          : diffWeeks < 0
            ? `${Math.abs(diffWeeks)} weeks ago`
            : `${diffWeeks} weeks from now`;

    const dayCount = ctx.showWeekend ? 7 : 5;
    const weekISOs = new Set<string>();
    for (let day = 0; day < dayCount; day += 1) {
      weekISOs.add(iso(addDays(weekStart, day)));
    }
    const weekEntries = ctx.S.entries.filter((entry) => weekISOs.has(entry.date));
    const weekMinutes = weekEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const weekEarn = weekEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    let headerTitle = 'Today';
    let headerSubtitle = '';
    if (ctx.isTrack) {
      headerTitle = `${relWeek} · W${isoWeekNumber(weekStart)}`;
      headerSubtitle = `${weekRange}${weekMinutes > 0 ? ` · ${fmtH(weekMinutes)} · ${fmtEUR(weekEarn)}` : ''}`;
    } else if (ctx.isProjects) {
      headerTitle = 'Projects';
      headerSubtitle = `${ctx.S.projects.length} active`;
    } else if (ctx.isServices) {
      headerTitle = 'Services';
      headerSubtitle = `${ctx.S.services.length} active`;
    } else if (ctx.isSettings) {
      headerTitle = 'Settings';
      headerSubtitle = 'Demo mode, Azure sync and data controls';
    } else if (ctx.isCustomers) {
      headerTitle = 'Customers';
      headerSubtitle = `${ctx.S.customers.length} total`;
    } else if (ctx.isCustomerDetail) {
      const customer = ctx.S.selectedCustomerId ? ctx.custById[ctx.S.selectedCustomerId] : undefined;
      const projectCount = ctx.S.projects.filter((project) => project.customerId === ctx.S.selectedCustomerId).length;
      headerTitle = customer?.name || 'Customer';
      headerSubtitle = `${projectCount}${projectCount === 1 ? ' project' : ' projects'}`;
    } else if (ctx.isProjectDetail) {
      const draft = ctx.S.projectDraft;
      headerTitle = draft?.name || 'New project';
      headerSubtitle = draft ? (ctx.custById[draft.customerId]?.name || '—') : '';
    } else if (ctx.isServiceDetail) {
      const draft = ctx.S.serviceDraft;
      headerTitle = draft?.name || 'New service';
      headerSubtitle = 'Recurring fixed-rate work';
    } else if (ctx.isExport) {
      headerTitle = 'Export timesheet';
      headerSubtitle = 'PDF + attachments for a customer or project';
    } else if (ctx.isEarnings) {
      headerTitle = 'Earnings';
      headerSubtitle = 'Totals and breakdown by customer or project';
    }

    return {
      headerTitle,
      headerSubtitle,
      isTrack: ctx.isTrack,
      isProjects: ctx.isProjects,
      isServices: ctx.isServices,
      isCustomers: ctx.isCustomers,
      onPrev: () => {
        const date = parseISO(ctx.S.refISO);
        setRefISO(iso(addDays(date, -7)));
      },
      onToday: () => setRefISO(ctx.todayISO),
      onNext: () => {
        const date = parseISO(ctx.S.refISO);
        setRefISO(iso(addDays(date, 7)));
      },
      btnPrimary: {
        height: '44px',
        padding: '0 15px',
        border: 'none',
        background: ctx.acc,
        color: '#fff',
        borderRadius: '9px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      },
      onNewEntry: openNewEntry,
      onNewProject: () => openProjectDetail(null, { page: 'projects' }),
      onNewService: () => openServiceDetail(null),
      onNewCustomer: () => openCustomer(null),
    };
  }, [ctx, openCustomer, openNewEntry, openProjectDetail, openServiceDetail, setRefISO]);

  const settingsProps = useMemo<SettingsViewProps | null>(() => {
    if (!ctx.isSettings) {
      return null;
    }

    const { label: syncStatusLabel, color: syncStatusColor } = getSyncStatusMeta(ctx.S.demoMode, ctx.S.syncStatus);

    return {
      onBack: () => setPage('track'),
      demoMode: ctx.S.demoMode,
      onToggleDemoMode,
      demoModeHint: 'Preview Tempo with example projects, customers and time entries. Your real data stays untouched and you can switch back anytime.',
      syncDisabled: ctx.S.demoMode,
      syncStatusLabel,
      syncStatusColor,
      onSyncNow: () => {
        void pushStateNow();
      },
      signedInAs: ctx.S.userDisplayName,
      onSignOut: signOut,
      onDeleteAll: resetData,
    };
  }, [ctx, onToggleDemoMode, pushStateNow, resetData, setPage, signOut]);

  const trackProps = useMemo<TrackViewProps | null>(() => {
    if (!ctx.isTrack) {
      return null;
    }

    const weekStart = startOfWeek(ctx.ref);
    const dayCount = ctx.showWeekend ? 7 : 5;
    const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const days: TrackDayVM[] = [];
    for (let index = 0; index < dayCount; index += 1) {
      const date = addDays(weekStart, index);
      const dayISO = iso(date);
      const isToday = dayISO === ctx.todayISO;
      const dayEntries = ctx.S.entries.filter((entry) => entry.date === dayISO);
      const dayMinutes = dayEntries.reduce((sum, entry) => sum + entry.minutes, 0);

      const entries: DayListRowVM[] = dayEntries.map((entry) => ({
        id: entry.id,
        projectName: labelForEntry(entry, ctx.projById, ctx.serviceById, ctx.custById),
        comment: entry.comment,
        hoursLabel: fmtH(entry.minutes),
        earnLabel: fmtEUR(ctx.entryEarn(entry)),
        dotStyle: {
          width: '10px',
          height: '10px',
          borderRadius: '3px',
          background: colorForEntry(entry, ctx.projById, ctx.custById),
          flexShrink: 0,
          marginTop: '4px',
        },
        onClick: () => openEntry(entry, false),
      }));

      days.push({
        iso: dayISO,
        dowLabel: dowLabels[index],
        dayNum: date.getDate(),
        isToday,
        numStyle: isToday
          ? {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: ctx.acc,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
            }
          : { fontSize: '15px', fontWeight: 600, color: '#1a1c20', lineHeight: '26px' },
        totalHoursLabel: dayMinutes > 0 ? fmtH(dayMinutes) : '',
        entries,
        onAddEntry: () => openNewEntryForDate(dayISO),
      });
    }

    const weekISOs = new Set(days.map((day) => day.iso));
    const weekEntries = ctx.S.entries.filter((entry) => weekISOs.has(entry.date));
    const weekMinutes = weekEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const weekEarn = weekEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    // Read-only month heatmap. The displayed month defaults to the currently
    // active week (ctx.ref) but can be browsed independently via its own
    // prev/next month/year controls (ctx.heatmapAnchor); browsing the ledger
    // itself (setRefISO) resets the heatmap back to following the ledger.
    // Shading maps hours/day onto accent opacity, clamped so a normal full
    // day reads as strongly shaded without single very-long days maxing out.
    const minutesByDate = new Map<string, number>();
    for (const entry of ctx.S.entries) {
      minutesByDate.set(entry.date, (minutesByDate.get(entry.date) ?? 0) + entry.minutes);
    }

    const monthRef = ctx.heatmapAnchor;
    const monthIndex = monthRef.getMonth();
    const gridStart = startOfWeek(new Date(monthRef.getFullYear(), monthIndex, 1, 12));
    const shadeCap = ctx.hpd > 0 ? ctx.hpd * 1.25 : 1;

    const heatmapWeeks: MonthHeatmapDayVM[][] = [];
    for (let week = 0; week < 6; week += 1) {
      const row: MonthHeatmapDayVM[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(gridStart, week * 7 + day);
        const cellISO = iso(date);
        const isCurrentMonth = date.getMonth() === monthIndex;
        const isToday = cellISO === ctx.todayISO;
        const cellMinutes = minutesByDate.get(cellISO) ?? 0;
        const intensity = Math.min(cellMinutes / 60 / shadeCap, 1);
        const background = cellMinutes > 0
          ? hexToRgba(ctx.acc, 0.1 + intensity * 0.8)
          : '#f6f7f9';
        const textColor = cellMinutes > 0 && intensity > 0.55 ? '#ffffff' : '#3a3f48';

        row.push({
          iso: cellISO,
          dayNum: date.getDate(),
          hoursLabel: cellMinutes > 0 ? fmtH(cellMinutes) : '',
          isToday,
          isCurrentMonth,
          style: {
            minHeight: '40px',
            borderRadius: '8px',
            padding: '5px 6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '2px',
            cursor: 'pointer',
            background,
            color: textColor,
            border: isToday ? `1.5px solid ${ctx.acc}` : '1px solid #eef0f3',
            opacity: isCurrentMonth ? 1 : 0.4,
          },
          onClick: () => setRefISO(cellISO),
        });
      }
      heatmapWeeks.push(row);
    }

    return {
      days,
      weekSummary: {
        weekLabel: `Week ${isoWeekNumber(weekStart)}`,
        hoursLabel: fmtH(weekMinutes),
        daysLabel: (weekMinutes / 60 / ctx.hpd).toFixed(1),
        earnLabel: fmtEUR(weekEarn),
      },
      monthHeatmap: {
        monthLabel: fmtMonthYear(monthRef),
        weeks: heatmapWeeks,
        dowLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        onPrevMonth: onHeatmapPrevMonth,
        onNextMonth: onHeatmapNextMonth,
        onPrevYear: onHeatmapPrevYear,
        onNextYear: onHeatmapNextYear,
      },
      accent: ctx.acc,
    };
  }, [ctx, openEntry, openNewEntryForDate, setRefISO, onHeatmapPrevMonth, onHeatmapNextMonth, onHeatmapPrevYear, onHeatmapNextYear]);

  const projectsProps = useMemo<ProjectsViewProps | null>(() => {
    if (!ctx.isProjects) {
      return null;
    }

    const projRows = ctx.S.projects.map((project) => {
      const entries = ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === project.id);
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: project.id,
        name: project.name,
        customerName: ctx.custById[project.customerId]?.name || '—',
        dayRate: fmtEUR(currentRatePeriod(project.rates)?.amount ?? 0),
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: colorForProject(project, ctx.custById), flexShrink: 0 },
        onClick: () => openProjectDetail(project, { page: 'projects' }),
      };
    });

    return { projRows, projEmpty: projRows.length === 0 };
  }, [ctx, openProjectDetail]);

  const servicesProps = useMemo<ServicesViewProps | null>(() => {
    if (!ctx.isServices) {
      return null;
    }

    const serviceRows = ctx.S.services.map((service, index) => {
      const entries = ctx.S.entries.filter((entry) => entry.kind === 'service' && entry.serviceId === service.id);
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: service.id,
        name: service.name,
        currentRate: fmtEUR(currentRatePeriod(service.rates)?.amount ?? 0),
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: PALETTE[index % PALETTE.length], flexShrink: 0 },
        onClick: () => openServiceDetail(service),
      };
    });

    return { serviceRows, serviceEmpty: serviceRows.length === 0 };
  }, [ctx, openServiceDetail]);

  const customersProps = useMemo<CustomersViewProps | null>(() => {
    if (!ctx.isCustomers) {
      return null;
    }

    const custRows = ctx.S.customers.map((customer) => {
      const projects = ctx.S.projects.filter((project) => project.customerId === customer.id);
      const projectIds = projects.map((project) => project.id);
      const entries = ctx.S.entries.filter(
        (entry) => (entry.kind === 'project' && projectIds.includes(entry.projectId ?? ''))
          || ((entry.kind === 'service' || entry.kind === 'customer') && entry.customerId === customer.id),
      );
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: customer.id,
        name: customer.name,
        projectLabel: `${projects.length}${projects.length === 1 ? ' project' : ' projects'}`,
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        avatarStyle: {
          width: '40px',
          height: '40px',
          borderRadius: '11px',
          background: customer.color,
          flexShrink: 0,
        },
        onClick: () => navCustomerDetail(customer.id),
      };
    });

    return { custRows, custEmpty: custRows.length === 0 };
  }, [ctx, navCustomerDetail]);

  const modalProps = useMemo<ModalProps | null>(() => {
    const modal = ctx.S.modal;
    if (!modal) {
      return null;
    }

    const isEntryModal = modal.type === 'entry';
    const isCustomerModal = modal.type === 'customer';
    const canDelete = !modal.isNew;
    const entryForm = isEntryModal ? (modal.form as EntryForm) : null;
    const entryId = entryForm?.id ?? '';

    const attachments = (entryForm?.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      label: `${attachment.fileName} (${fmtBytes(attachment.size)})`,
      onDownload: () => void onDownloadAttachment(entryId, attachment.id),
      onDelete: () => onDeleteAttachment(attachment.id),
    }));

    const modalTitle = modal.type === 'entry'
      ? (modal.isNew ? 'Log hours' : 'Edit entry')
      : (modal.isNew ? 'New customer' : 'Edit customer');
    const saveLabel = modal.isNew ? 'Add' : 'Save';

    const presetValues = [0.5, 1, 2, 4, ctx.hpd];
    const seenPresets = new Set<string>();
    const hoursPresets = presetValues
      .filter((value) => {
        const key = String(value);
        if (seenPresets.has(key)) {
          return false;
        }
        seenPresets.add(key);
        return true;
      })
      .map((value) => ({ label: String(value), value: String(value) }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #d7dadf',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#1a1c20',
      background: '#fff',
      outline: 'none',
    };

    return {
      modalTitle,
      saveLabel,
      isEntryModal,
      isCustomerModal,
      canDelete,
      form: modal.form,
      serviceOpts: ctx.S.services.map((service) => ({
        id: service.id,
        name: service.name,
      })),
      custOptsForEntry: ctx.S.customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
      })),
      projOpts: ctx.S.projects.map((project) => ({
        id: project.id,
        name: `${project.name}  ·  ${ctx.custById[project.customerId]?.name || '—'}`,
      })),
      inputStyle,
      textareaStyle: { ...inputStyle, resize: 'vertical', lineHeight: 1.4 },
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#626873', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: ctx.acc,
        color: '#fff',
        borderRadius: '9px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
      },
      onFormKind: (kind) => {
        updateForm('kind', kind);
        if (kind === 'project' && entryForm && !entryForm.projectId) {
          updateForm('projectId', ctx.S.projects[0]?.id || '');
        }
        if (kind === 'service') {
          if (entryForm && !entryForm.serviceId) {
            updateForm('serviceId', ctx.S.services[0]?.id || '');
          }
          if (entryForm && !entryForm.customerId) {
            updateForm('customerId', ctx.S.customers[0]?.id || '');
          }
        }
        if (kind === 'customer' && entryForm && !entryForm.customerId) {
          updateForm('customerId', ctx.S.customers[0]?.id || '');
        }
      },
      onFormProject: (event: ChangeEvent<HTMLSelectElement>) => updateForm('projectId', event.target.value),
      onFormService: (event: ChangeEvent<HTMLSelectElement>) => updateForm('serviceId', event.target.value),
      onFormEntryCustomer: (event: ChangeEvent<HTMLSelectElement>) => updateForm('customerId', event.target.value),
      onFormAmount: (event: ChangeEvent<HTMLInputElement>) => updateForm('amount', event.target.value),
      onFormDate: (event: ChangeEvent<HTMLInputElement>) => updateForm('date', event.target.value),
      onFormHours: (event: ChangeEvent<HTMLInputElement>) => updateForm('hours', event.target.value),
      hoursPresets,
      onPresetHours: (value: string) => updateForm('hours', value),
      onToggleRepeat: (repeat: boolean) => updateForm('repeat', repeat),
      onFormEndDate: (event: ChangeEvent<HTMLInputElement>) => updateForm('endDate', event.target.value),
      onToggleSkipWeekends: (skip: boolean) => updateForm('skipWeekends', skip),
      onFormComment: (event: ChangeEvent<HTMLTextAreaElement>) => updateForm('comment', event.target.value),
      onFormName: (event: ChangeEvent<HTMLInputElement>) => updateForm('name', event.target.value),
      onSave: saveModal,
      onCancel: closeModal,
      onDelete: deleteModal,
      stopOverlay: (event: MouseEvent) => event.stopPropagation(),
      attachments,
      attachmentUploading: ctx.S.attachmentUploading,
      attachmentError: ctx.S.attachmentError,
      onAddAttachments,
    };
  }, [closeModal, ctx, deleteModal, onAddAttachments, onDeleteAttachment, onDownloadAttachment, saveModal, updateForm]);

  const customerDetailProps = useMemo<CustomerDetailViewProps | null>(() => {
    if (!ctx.isCustomerDetail || !ctx.S.selectedCustomerId) {
      return null;
    }

    const customerId = ctx.S.selectedCustomerId;
    const customer = ctx.custById[customerId];
    const projects = ctx.S.projects.filter((project) => project.customerId === customerId);
    const projectIds = projects.map((project) => project.id);
    const entries = ctx.S.entries.filter(
      (entry) => (entry.kind === 'project' && projectIds.includes(entry.projectId ?? ''))
        || ((entry.kind === 'service' || entry.kind === 'customer') && entry.customerId === customerId),
    );
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const projectRows: CustomerDetailProjectRowVM[] = projects.map((project) => {
      const projectEntries = ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === project.id);
      const projectMinutes = projectEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const projectEarn = projectEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: project.id,
        name: project.name,
        currentRate: fmtEUR(currentRatePeriod(project.rates)?.amount ?? 0),
        hours: fmtH(projectMinutes),
        earn: fmtEUR(projectEarn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: customer?.color || '#9ca3af', flexShrink: 0 },
        onClick: () => openProjectDetail(project, { page: 'customerDetail', customerId }),
      };
    });

    const setCustomerColor = (color: string) => {
      setState((current) => ({
        ...current,
        customers: current.customers.map((item) => (item.id === customerId ? { ...item, color } : item)),
      }));
    };

    const colorSwatches: ColorSwatchVM[] = PALETTE.map((color) => ({
      color,
      style: {
        width: '30px',
        height: '30px',
        borderRadius: '9px',
        background: color,
        cursor: 'pointer',
        padding: 0,
        border: customer?.color === color ? '2px solid #fff' : '2px solid transparent',
        boxShadow: customer?.color === color ? `0 0 0 2px ${color}` : 'none',
      },
      onClick: () => setCustomerColor(color),
    }));

    return {
      customerName: customer?.name || '',
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => {
        const name = event.target.value;
        setState((current) => ({
          ...current,
          customers: current.customers.map((item) => (item.id === customerId ? { ...item, name } : item)),
        }));
      },
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      projectRows,
      projEmpty: projectRows.length === 0,
      canDelete: true,
      color: customer?.color || '#9ca3af',
      colorSwatches,
      onCustomColorChange: (event: ChangeEvent<HTMLInputElement>) => setCustomerColor(event.target.value),
      inputStyle: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d7dadf',
        borderRadius: '9px',
        fontSize: '14px',
        color: '#1a1c20',
        background: '#fff',
        outline: 'none',
      },
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#626873', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: ctx.acc,
        color: '#fff',
        borderRadius: '9px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
      },
      onBack: backToCustomers,
      onNewProject: () => openProjectDetail(null, { page: 'customerDetail', customerId }, customerId),
      onDeleteCustomer: () => {
        if (window.confirm(`Delete ${customer?.name || 'this customer'}? This removes all of its projects and related entries, plus service bookings for this customer.`)) {
          deleteCustomerById(customerId);
        }
      },
      onExport: () => openExport({ type: 'customer', id: customerId }),
      onViewEarnings: () => openEarnings({ customerId, projectId: null }),
    };
  }, [backToCustomers, ctx, deleteCustomerById, openEarnings, openExport, openProjectDetail]);

  const projectDetailProps = useMemo<ProjectDetailViewProps | null>(() => {
    if (!ctx.isProjectDetail || !ctx.S.projectDraft) {
      return null;
    }

    const draft = ctx.S.projectDraft;
    const isNew = !draft.id;
    const entries = draft.id ? ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === draft.id) : [];
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const rateRows: RatePeriodRowVM[] = sortRates(draft.rates).map((rate) => ({
      id: rate.id,
      amount: String(rate.amount),
      from: rate.from,
      to: rate.to ?? '',
      isCurrent: rate.to === null,
      onAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'amount', event.target.value),
      onFromChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'from', event.target.value),
      onToChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'to', event.target.value),
      onDelete: () => deleteRate(rate.id),
    }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #d7dadf',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#1a1c20',
      background: '#fff',
      outline: 'none',
    };

    return {
      isNew,
      saveLabel: isNew ? 'Create project' : 'Save changes',
      projectName: draft.name,
      customerId: draft.customerId,
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      canDelete: !isNew,
      custOpts: ctx.S.customers.map((customer) => ({ id: customer.id, name: customer.name })),
      rateRows,
      newRateAmount: draft.newRateAmount,
      newRateFrom: draft.newRateFrom,
      inputStyle,
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#626873', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: ctx.acc,
        color: '#fff',
        borderRadius: '9px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
      },
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('name', event.target.value),
      onCustomerChange: (event: ChangeEvent<HTMLSelectElement>) => updateProjectDraft('customerId', event.target.value),
      onNewRateAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('newRateAmount', event.target.value),
      onNewRateFromChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('newRateFrom', event.target.value),
      onAddRate: addRate,
      onSave: saveProjectDraft,
      onDelete: () => {
        if (window.confirm(`Delete ${draft.name || 'this project'}? This removes all of its logged entries.`)) {
          deleteProjectDraft();
        }
      },
      onBack: backFromProjectDetail,
      onExport: () => {
        if (draft.id) {
          openExport({ type: 'project', id: draft.id });
        }
      },
      onViewEarnings: () => {
        if (draft.id) {
          openEarnings({ customerId: draft.customerId, projectId: draft.id });
        }
      },
    };
  }, [addRate, backFromProjectDetail, ctx, deleteProjectDraft, deleteRate, openEarnings, openExport, saveProjectDraft, updateProjectDraft, updateRateField]);

  const serviceDetailProps = useMemo<ServiceDetailViewProps | null>(() => {
    if (!ctx.isServiceDetail || !ctx.S.serviceDraft) {
      return null;
    }

    const draft = ctx.S.serviceDraft;
    const isNew = !draft.id;
    const entries = draft.id ? ctx.S.entries.filter((entry) => entry.kind === 'service' && entry.serviceId === draft.id) : [];
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const rateRows: RatePeriodRowVM[] = sortRates(draft.rates).map((rate) => ({
      id: rate.id,
      amount: String(rate.amount),
      from: rate.from,
      to: rate.to ?? '',
      isCurrent: rate.to === null,
      onAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'amount', event.target.value),
      onFromChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'from', event.target.value),
      onToChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'to', event.target.value),
      onDelete: () => deleteServiceRate(rate.id),
    }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #d7dadf',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#1a1c20',
      background: '#fff',
      outline: 'none',
    };

    return {
      isNew,
      saveLabel: isNew ? 'Create service' : 'Save changes',
      serviceName: draft.name,
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      canDelete: !isNew,
      rateRows,
      newRateAmount: draft.newRateAmount,
      newRateFrom: draft.newRateFrom,
      inputStyle,
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#626873', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: ctx.acc,
        color: '#fff',
        borderRadius: '9px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
      },
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('name', event.target.value),
      onNewRateAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('newRateAmount', event.target.value),
      onNewRateFromChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('newRateFrom', event.target.value),
      onAddRate: addServiceRate,
      onSave: saveServiceDraft,
      onDelete: deleteServiceDraft,
      onBack: backFromServiceDetail,
    };
  }, [addServiceRate, backFromServiceDetail, ctx, deleteServiceDraft, deleteServiceRate, saveServiceDraft, updateServiceDraft, updateServiceRateField]);

  const exportProps = useMemo<ExportViewProps | null>(() => {
    if (!ctx.isExport) {
      return null;
    }

    return {
      customers: ctx.S.customers,
      projects: ctx.S.projects,
      services: ctx.S.services,
      entries: ctx.S.entries,
      hoursPerDay: ctx.hpd,
      initialScope: ctx.S.exportScope,
      onBack: () => setPage('track'),
    };
  }, [ctx, setPage]);

  const earningsProps = useMemo<EarningsViewProps | null>(() => {
    if (!ctx.isEarnings) {
      return null;
    }

    return {
      customers: ctx.S.customers,
      projects: ctx.S.projects,
      services: ctx.S.services,
      entries: ctx.S.entries,
      hoursPerDay: ctx.hpd,
      initialFilter: ctx.S.earningsFilter,
      onBack: () => setPage('track'),
    };
  }, [ctx, setPage]);

  return {
    showTrack: ctx.isTrack,
    showProjects: ctx.isProjects,
    showServices: ctx.isServices,
    showCustomers: ctx.isCustomers,
    showSettings: ctx.isSettings,
    showCustomerDetail: ctx.isCustomerDetail,
    showProjectDetail: ctx.isProjectDetail,
    showServiceDetail: ctx.isServiceDetail,
    showExport: ctx.isExport,
    showEarnings: ctx.isEarnings,
    modalOpen: Boolean(ctx.S.modal),
    sidebarProps,
    headerProps,
    trackProps,
    projectsProps,
    servicesProps,
    customersProps,
    settingsProps,
    customerDetailProps,
    projectDetailProps,
    serviceDetailProps,
    exportProps,
    earningsProps,
    modalProps,
  };
}

