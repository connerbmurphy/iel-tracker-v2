export const uid = (p='id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
export const todayStr = () => new Date().toISOString().slice(0,10);
export const nowTimeStr = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; };
export const fmtMoney = (n) => `$${(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
export const fmtMoney2 = (n) => `$${(Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtTime = (t) => { if(!t) return '--'; const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };

export function hoursFromPunch(inTime, outTime) {
  if (!inTime||!outTime) return 0;
  const [ih,im]=inTime.split(':').map(Number);
  const [oh,om]=outTime.split(':').map(Number);
  const inM=ih*60+im; let outM=oh*60+om;
  if (outM<inM) outM+=1440;
  return Math.max(0,(outM-inM)/60);
}

export function calcPersonLaborCost(hrs, rate) {
  return Math.min(hrs,8)*rate + Math.max(0,hrs-8)*rate*1.5;
}

export function tenurePoints(hireDateStr) {
  if (!hireDateStr) return 0;
  const hire = new Date(hireDateStr);
  const now = new Date();
  const days = (now - hire) / (1000*60*60*24);
  const years = days / 365.25;
  if (days < 90) return 0;
  if (years < 1) return 1;
  if (years < 2) return 2;
  if (years < 3) return 3;
  if (years < 4) return 4;
  return 5;
}

export function rolePoints(role, status) {
  if (role === 'Lead') return 20;
  if (role === 'Foreman') return 17;
  if (role === 'Install Tech' && status === 'Experienced') return 14;
  return 12;
}

export function perfMultiplier(score, isLead) {
  if (isLead) return 1.2;
  if (score >= 13) return 1.2;
  if (score >= 9)  return 1.0;
  if (score >= 5)  return 0.85;
  return 0.7;
}

export function weekStr(dateStr) {
  const d = new Date(dateStr || Date.now());
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function monthStr(dateStr) {
  return (dateStr || todayStr()).slice(0,7);
}

export function fmtDate(dateStr) {
  if (!dateStr) return '--';
  const [y,m,d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
