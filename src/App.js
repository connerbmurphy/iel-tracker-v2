import React, { useState } from 'react';
import { Home, Users, History, BarChart2, Settings } from 'lucide-react';
import { AppProvider } from './contexts/AppContext';
import Header from './components/Header';
import { S, C, globalCSS, Toast, useToast } from './components/UI';
import HomeScreen from './screens/HomeScreen';
import JobDetailScreen from './screens/JobDetailScreen';
import { ClockInScreen, ClockOutScreen } from './screens/ClockInOut';
import EmployeesScreen from './screens/EmployeesScreen';
import HistoryScreen from './screens/HistoryScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App({ accountId }) {
  return (
    <AppProvider accountId={accountId}>
      <AppInner />
    </AppProvider>
  );
}

function AppInner() {
  const [view, setView] = useState('home');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [toast, showToast] = useToast();

  const nav = (screen, jobId=null) => {
    if (jobId) setSelectedJobId(jobId);
    setView(screen);
  };

  const back = () => setView('home');

  const navScreens = ['home','employees','history','reports','settings'];
  const isNav = navScreens.includes(view);
  const isDetail = !isNav;

  const screenTitle = {
    employees: 'Crew', history: 'History', reports: 'Reports', settings: 'Settings',
    jobDetail: null, clockIn: 'Clock In', clockOut: 'Clock Out',
  }[view];

  return (
    <div style={S.app}>
      <style>{globalCSS}</style>
      <Header
        title={view === 'home' ? undefined : screenTitle}
        onBack={isDetail ? back : undefined}
        onSettings={view === 'home' ? () => nav('settings') : undefined}
        showSettings={view === 'home'}
      />
      <div style={S.body}>
        {view === 'home' && <HomeScreen onNav={nav} />}
        {view === 'jobDetail' && <JobDetailScreen jobId={selectedJobId} onBack={back} onNav={nav} />}
        {view === 'clockIn' && <ClockInScreen jobId={selectedJobId} onDone={back} onBack={back} />}
        {view === 'clockOut' && <ClockOutScreen jobId={selectedJobId} onDone={back} onBack={back} />}
        {view === 'employees' && <EmployeesScreen />}
        {view === 'history' && <HistoryScreen onNav={nav} />}
        {view === 'reports' && <ReportsScreen />}
        {view === 'settings' && <SettingsScreen />}
      </div>
      <Toast message={toast} />
      <BottomNav view={view} onNav={nav} />
    </div>
  );
}

function BottomNav({ view, onNav }) {
  const tabs = [
    { id:'home', icon:Home, label:'Jobs' },
    { id:'employees', icon:Users, label:'Crew' },
    { id:'history', icon:History, label:'History' },
    { id:'reports', icon:BarChart2, label:'Reports' },
    { id:'settings', icon:Settings, label:'Settings' },
  ];
  const activeId = ['home','jobDetail','clockIn','clockOut'].includes(view) ? 'home' : view;
  return (
    <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:C.card, borderTop:`1px solid ${C.border}`, display:'flex', zIndex:20, paddingBottom:'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = activeId === tab.id;
        return (
          <button key={tab.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'10px 0 8px', background:'transparent', border:'none', cursor:'pointer', color: active ? C.primary : C.inkFaint }}
            onClick={() => onNav(tab.id)}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span style={{ fontSize:10, fontWeight: active ? 700 : 500, marginTop:3 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
