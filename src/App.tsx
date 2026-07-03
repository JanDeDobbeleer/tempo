import type { FC } from 'react';

import { useTempoState } from './hooks/useTempoState';
import type { TempoSettings } from './types';

import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import MonthView from './components/MonthView';
import ProjectsView from './components/ProjectsView';
import CustomersView from './components/CustomersView';
import CustomerDetailView from './components/CustomerDetailView';
import ProjectDetailView from './components/ProjectDetailView';
import SettingsView from './components/SettingsView';
import Modal from './components/Modal';

// Mirrors the DC root's editable-settings defaults (see Tempo.dc.html's
// data-props block: accentColor / hoursPerDay / showWeekend).
const SETTINGS: TempoSettings = {
  accentColor: '#2563eb',
  hoursPerDay: 8,
  showWeekend: false,
};

const App: FC = () => {
  const {
    showWeek,
    showDay,
    showMonth,
    showProjects,
    showCustomers,
    showCustomerDetail,
    showProjectDetail,
    showSettings,
    modalOpen,
    sidebarProps,
    headerProps,
    weekProps,
    dayProps,
    monthProps,
    projectsProps,
    customersProps,
    customerDetailProps,
    projectDetailProps,
    settingsProps,
    modalProps,
  } = useTempoState(SETTINGS);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <Sidebar {...sidebarProps} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f5f6f8' }}>
        <AppHeader {...headerProps} />

        {showWeek && weekProps && <WeekView {...weekProps} />}
        {showDay && dayProps && <DayView {...dayProps} />}
        {showMonth && monthProps && <MonthView {...monthProps} />}
        {showProjects && projectsProps && <ProjectsView {...projectsProps} />}
        {showCustomers && customersProps && <CustomersView {...customersProps} />}
        {showCustomerDetail && customerDetailProps && <CustomerDetailView {...customerDetailProps} />}
        {showProjectDetail && projectDetailProps && <ProjectDetailView {...projectDetailProps} />}
        {showSettings && settingsProps && <SettingsView {...settingsProps} />}
      </main>

      {modalOpen && modalProps && <Modal {...modalProps} />}
    </div>
  );
};

export default App;
