import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { fsSet, fsLoadAll } from './db';
import { Plus, Truck, Sprout, Package, Wrench, ChevronRight, Check, X, AlertTriangle, Settings, Clock, LogIn, LogOut, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';

// Storage backed by Firebase Firestore via fsSet/fsLoadAll from db.js

// ---------- Seed data ----------
const DEFAULT_JOBS = [
  { id: 'job_1', name: 'Antonio Dollar', status: 'active', targetMargin: 45, bidTotal: 8500, bidLaborHours: 24, notes: '' },
  { id: 'job_2', name: 'Kimberly Lague', status: 'active', targetMargin: 45, bidTotal: 6200, bidLaborHours: 18, notes: '' },
  { id: 'job_3', name: 'Russell Andrews', status: 'active', targetMargin: 45, bidTotal: 11400, bidLaborHours: 30, notes: '' },
];
const DEFAULT_CREW = [
  { id: 'crew_1', name: 'Conner', role: 'Team Leader', burdenedRate: 38 },
  { id: 'crew_2', name: 'Installer A', role: 'Installer', burdenedRate: 28 },
  { id: 'crew_3', name: 'Laborer A', role: 'Laborer', burdenedRate: 22 },
];
const DEFAULT_EQUIPMENT = [
  { id: 'eq_excavator', name: 'Mini Excavator', hourlyCost: 35 },
  { id: 'eq_tractor', name: 'Compact Tractor', hourlyCost: 22 },
];
const DEFAULT_TRUCKS = [
  { id: 'truck_1', name: 'Main Truck' },
  { id: 'truck_2', name: 'Second Truck' },
];
const DEFAULT_TRAILERS = [
  { id: 'trailer_1', name: '7x16 Enclosed', dayRate: 7.80 },
  { id: 'trailer_2', name: '20ft Flatbed', dayRate: 7.80 },
  { id: 'trailer_3', name: 'Dump Trailer', dayRate: 13.00 },
];
const DEFAULT_RATES = { mileageRate: 0.67 };
const DEFAULT_STOCK_ITEMS = [
  { id: 'stock_pvc', name: 'PVC Pipe (per ft)', unit: 'ft', avgUnitCost: 0.85 },
  { id: 'stock_fabric', name: 'Weed Fabric (per ft)', unit: 'ft', avgUnitCost: 0.18 },
  { id: 'stock_drip', name: 'Drip Tubing (per ft)', unit: 'ft', avgUnitCost: 0.32 },
  { id: 'stock_fittings', name: 'Irrigation Fittings (per unit)', unit: 'unit', avgUnitCost: 2.10 },
];

// plantsRecord: { jobId, items:[{id,name,size,qty}], totalCost, notes }
// materialsRecord: { jobId, items: [{ id, date, description, source, type:'purchase'|'stockDraw'|'other', stockItemId?, qty?, unit?, receiptAmount?, isReturn, notes }] }
// equipmentLog: array of { id, jobId, date, equipmentId, startMeter, endMeter }
// trailerLog: array of { id, jobId, date, trailerId, days }
// truckLog: array of { id, jobId, date, truckId, miles }

const uid = (p='id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const todayStr = () => new Date().toISOString().slice(0,10);
const nowTimeStr = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; };
const fmtMoney = (n) => `$${(Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const fmtMoney2 = (n) => `$${(Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtTime = (t) => { if(!t) return '-'; const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };

function hoursFromPunch(inTime, outTime) {
  if (!inTime||!outTime) return 0;
  const [ih,im]=inTime.split(':').map(Number);
  const [oh,om]=outTime.split(':').map(Number);
  const inM=ih*60+im; let outM=oh*60+om;
  if (outM<inM) outM+=1440;
  return Math.max(0,(outM-inM)/60);
}
function calcPersonLaborCost(hrs, rate) {
  return Math.min(hrs,8)*rate + Math.max(0,hrs-8)*rate*1.5;
}

// ---------- Material cost helper ----------
function materialItemCost(item, stockItems) {
  if (item.isReturn) return 0; // returns handled separately
  if (item.type === 'purchase') return Number(item.receiptAmount) || 0;
  if (item.type === 'stockDraw') {
    const si = stockItems.find(s => s.id === item.stockItemId);
    return (si ? si.avgUnitCost : 0) * (Number(item.qty) || 0);
  }
  return 0;
}
function materialReturnCredit(item, stockItems) {
  if (!item.isReturn) return 0;
  if (item.type === 'purchase') return Number(item.receiptAmount) || 0;
  if (item.type === 'stockDraw') {
    const si = stockItems.find(s => s.id === item.stockItemId);
    return (si ? si.avgUnitCost : 0) * (Number(item.qty) || 0);
  }
  return 0;
}

// ---------- Costing engine ----------
function computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, crew) {
  // Labor
  let laborHours=0, laborCost=0, laborOTHours=0;
  const jobPunches = punches.filter(p => p.jobId===job.id);
  jobPunches.forEach(p => {
    const member = crew.find(c=>c.id===p.crewId);
    const rate = member ? member.burdenedRate : 0;
    const hrs = p.overrideHrs!=null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
    const ot = Math.max(0, hrs-8);
    laborHours += hrs; laborOTHours += ot;
    laborCost += calcPersonLaborCost(hrs, rate);
  });

  // Plants - totalCost entered as lump sum at job close
  const pr = plantsRec[job.id] || {};
  const plantItems = pr.items || [];
  const totalPlantQty = plantItems.reduce((s,i)=>s+(Number(i.qty)||0),0);
  const plantCost = Number(pr.totalCost) || 0;

  // Materials
  const mr = materialsRec[job.id] || { items: [], miscExpenses: [] };
  let materialsCost = 0;
  (mr.items||[]).forEach(item => {
    materialsCost += materialItemCost(item, stockItems);
    materialsCost -= materialReturnCredit(item, stockItems);
  });
  (mr.miscExpenses||[]).forEach(e => { materialsCost += Number(e.amount)||0; });
  materialsCost = Math.max(0, materialsCost);

  // Equipment
  let equipmentHours={}, equipmentCost=0;
  equipmentLog.filter(e=>e.jobId===job.id).forEach(e => {
    const hrs = Math.max(0,(Number(e.endMeter)||0)-(Number(e.startMeter)||0));
    equipmentHours[e.equipmentId] = (equipmentHours[e.equipmentId]||0)+hrs;
    const ei = equipment.find(x=>x.id===e.equipmentId);
    equipmentCost += hrs*(ei?ei.hourlyCost:0);
  });

  // Trucks
  let truckMiles={}, truckCost=0;
  truckLog.filter(t=>t.jobId===job.id).forEach(t => {
    const miles=Number(t.miles)||0;
    truckMiles[t.truckId]=(truckMiles[t.truckId]||0)+miles;
    truckCost += miles*(rates.mileageRate||0);
  });

  // Trailers
  let trailerDays={}, trailerCost=0;
  (trailerLog||[]).filter(t=>t.jobId===job.id).forEach(t => {
    const days=Number(t.days)||0;
    trailerDays[t.trailerId]=(trailerDays[t.trailerId]||0)+days;
    const ti=(trailers||[]).find(x=>x.id===t.trailerId);
    trailerCost += days*(ti?ti.dayRate:0);
  });

  const totalCOGS = laborCost+plantCost+materialsCost+equipmentCost+truckCost+trailerCost;
  const revenue = Number(job.bidTotal)||0;
  const grossProfit = revenue-totalCOGS;
  const margin = revenue>0 ? (grossProfit/revenue)*100 : 0;
  const fev = margin>=(job.targetMargin||0);
  const activePunches = jobPunches.filter(p=>p.clockIn&&!p.clockOut);

  return { laborHours,laborOTHours,laborCost, totalPlantQty,plantCost, materialsCost, equipmentHours,equipmentCost, truckMiles,truckCost, trailerDays,trailerCost, totalCOGS,revenue,grossProfit,margin,fev, activePunches };
}

// ---------- App ----------
export default function App({ accountId }) {
  const [view, setView] = useState('home');
  const [jobs, setJobs] = useState(DEFAULT_JOBS);
  const [punches, setPunches] = useState([]);           // clock in/out records
  const [plantsRec, setPlantsRec] = useState({});       // { jobId: { plantsLoaded, plantsCost, plantsReturned, notes } }
  const [materialsRec, setMaterialsRec] = useState({}); // { jobId: { items: [...] } }
  const [equipmentLog, setEquipmentLog] = useState([]);
  const [truckLog, setTruckLog] = useState([]);
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [equipment, setEquipment] = useState(DEFAULT_EQUIPMENT);
  const [trucks, setTrucks] = useState(DEFAULT_TRUCKS);
  const [trailers, setTrailers] = useState(DEFAULT_TRAILERS);
  const [trailerLog, setTrailerLog] = useState([]);
  const [stockItems, setStockItems] = useState(DEFAULT_STOCK_ITEMS);
  const [crew, setCrew] = useState(DEFAULT_CREW);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null),2500); };

  useEffect(()=>{
    if (!accountId) return;
    (async()=>{
      const data = await fsLoadAll(accountId);
      setJobs(data['iel:jobs'] ?? DEFAULT_JOBS);
      setPunches(data['iel:punches'] ?? []);
      setPlantsRec(data['iel:plantsRec'] ?? {});
      setMaterialsRec(data['iel:materialsRec'] ?? {});
      setEquipmentLog(data['iel:equipmentLog'] ?? []);
      setTruckLog(data['iel:truckLog'] ?? []);
      setTrailerLog(data['iel:trailerLog'] ?? []);
      setRates(data['iel:rates'] ?? DEFAULT_RATES);
      setEquipment(data['iel:equipment'] ?? DEFAULT_EQUIPMENT);
      setTrucks(data['iel:trucks'] ?? DEFAULT_TRUCKS);
      setTrailers(data['iel:trailers'] ?? DEFAULT_TRAILERS);
      setStockItems(data['iel:stockItems'] ?? DEFAULT_STOCK_ITEMS);
      setCrew(data['iel:crew'] ?? DEFAULT_CREW);
      setLoading(false);
    })();
  },[accountId]);

  const persist = useCallback(async (key, setter, val) => { setter(val); await fsSet(accountId, key, val); },[accountId]);
  const pJobs = useCallback(v=>persist('iel:jobs',setJobs,v),[persist]);
  const pPunches = useCallback(v=>persist('iel:punches',setPunches,v),[persist]);
  const pPlants = useCallback(v=>persist('iel:plantsRec',setPlantsRec,v),[persist]);
  const pMaterials = useCallback(v=>persist('iel:materialsRec',setMaterialsRec,v),[persist]);
  const pEquipmentLog = useCallback(v=>persist('iel:equipmentLog',setEquipmentLog,v),[persist]);
  const pTruckLog = useCallback(v=>persist('iel:truckLog',setTruckLog,v),[persist]);
  const pRates = useCallback(v=>persist('iel:rates',setRates,v),[persist]);
  const pEquipment = useCallback(v=>persist('iel:equipment',setEquipment,v),[persist]);
  const pTrucks = useCallback(v=>persist('iel:trucks',setTrucks,v),[persist]);
  const pTrailers = useCallback(v=>persist('iel:trailers',setTrailers,v),[persist]);
  const pTrailerLog = useCallback(v=>persist('iel:trailerLog',setTrailerLog,v),[persist]);
  const pStock = useCallback(v=>persist('iel:stockItems',setStockItems,v),[persist]);
  const pCrew = useCallback(v=>persist('iel:crew',setCrew,v),[persist]);

  const addPunchBatch = async (newPunches) => { const next=[...punches,...newPunches.map(p=>({...p,id:uid('punch')}))]; await pPunches(next); showToast(`Clocked in (${newPunches.length})`); };
  const updatePunch = async (id,patch) => { const next=punches.map(p=>p.id===id?{...p,...patch}:p); await pPunches(next); showToast('Clocked out'); };
  const updatePunchBatch = async (updates) => { let next=[...punches]; updates.forEach(({id,...patch})=>{next=next.map(p=>p.id===id?{...p,...patch}:p);}); await pPunches(next); showToast(`Clocked out (${updates.length})`); };
  const deleteJob = async (jobId) => {
    await pJobs(jobs.filter(j=>j.id!==jobId));
    await pPunches(punches.filter(p=>p.jobId!==jobId));
    const {[jobId]:_p,...restPlants}=plantsRec; await pPlants(restPlants);
    const {[jobId]:_m,...restMats}=materialsRec; await pMaterials(restMats);
    await pEquipmentLog(equipmentLog.filter(e=>e.jobId!==jobId));
    await pTruckLog(truckLog.filter(t=>t.jobId!==jobId));
    await pTrailerLog(trailerLog.filter(t=>t.jobId!==jobId));
    setView('home'); showToast('Job deleted');
  };
  const updatePlants = async (jobId, data) => { const next={...plantsRec,[jobId]:data}; await pPlants(next); showToast('Saved'); };
  const updateMaterials = async (jobId, data) => { const next={...materialsRec,[jobId]:data}; await pMaterials(next); showToast('Saved'); };
  const addEquipmentEntry = async (entry) => { const next=[...equipmentLog,{...entry,id:uid('eq')}]; await pEquipmentLog(next); showToast('Saved'); };
  const addTruckEntry = async (entry) => { const next=[...truckLog,{...entry,id:uid('tr')}]; await pTruckLog(next); showToast('Saved'); };
  const deleteEquipmentEntry = async (id) => { const next=equipmentLog.filter(e=>e.id!==id); await pEquipmentLog(next); showToast('Deleted'); };
  const deleteTruckEntry = async (id) => { const next=truckLog.filter(t=>t.id!==id); await pTruckLog(next); showToast('Deleted'); };
  const addTrailerEntry = async (entry) => { const next=[...trailerLog,{...entry,id:uid('trl')}]; await pTrailerLog(next); showToast('Saved'); };
  const deleteTrailerEntry = async (id) => { const next=trailerLog.filter(t=>t.id!==id); await pTrailerLog(next); showToast('Deleted'); };
  const updatePunchFull = async (id, patch) => { const next=punches.map(p=>p.id===id?{...p,...patch}:p); await pPunches(next); showToast('Saved'); };
  const deletePunch = async (id) => { const next=punches.filter(p=>p.id!==id); await pPunches(next); showToast('Deleted'); };

  const nav = (v,jobId=null) => { if(jobId) setSelectedJobId(jobId); setView(v); };

  if(loading) return <div style={styles.loadingScreen}><div style={styles.loadingLogo}>IEL</div><div style={{color:'#8a9a8e',fontSize:13}}>LOADING...</div></div>;

  const sharedProps = { jobs,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew };

  return (
    <div style={styles.app}>
      <style>{globalCSS}</style>
      <Header view={view} onHome={()=>setView('home')} onSettings={()=>setView('settings')} />
      <div style={styles.body}>
        {view==='home' && <HomeView {...sharedProps} onNav={nav} />}
        {view==='clockIn' && <ClockInView job={jobs.find(j=>j.id===selectedJobId)} {...{crew,punches}} onSaveBatch={async(ps)=>{await addPunchBatch(ps);setView('home');}} onCancel={()=>setView('home')} />}
        {view==='clockOut' && <ClockOutView job={jobs.find(j=>j.id===selectedJobId)} {...{crew,punches}} onClockOutBatch={async(updates)=>{await updatePunchBatch(updates);setView('home');}} onCancel={()=>setView('home')} />}
        {view==='jobDetail' && <JobDetail job={jobs.find(j=>j.id===selectedJobId)} {...sharedProps}
          onUpdateJob={async u=>{await pJobs(jobs.map(j=>j.id===u.id?u:j));}} onDeleteJob={deleteJob}
          onUpdatePlants={updatePlants} onUpdateMaterials={updateMaterials}
          onAddEquipment={addEquipmentEntry} onAddTruck={addTruckEntry}
          onNav={nav} onClockOutNow={async(id)=>{await updatePunch(id,{clockOut:nowTimeStr()});}}
          onDeleteEquipment={deleteEquipmentEntry} onDeleteTruck={deleteTruckEntry}
          onAddTrailer={addTrailerEntry} onDeleteTrailer={deleteTrailerEntry}
          onUpdatePunch={updatePunchFull} onDeletePunch={deletePunch}
          onBack={()=>setView('home')} />}
        {view==='settings' && <SettingsView {...{jobs,rates,equipment,trucks,trailers,stockItems,crew}}
          onUpdateJobs={pJobs} onUpdateRates={pRates} onUpdateEquipment={pEquipment}
          onUpdateTrucks={pTrucks} onUpdateTrailers={pTrailers} onUpdateStock={pStock} onUpdateCrew={pCrew}
          onBack={()=>setView('home')} />}
      </div>
      {toast && <div style={styles.toast}><Check size={15} style={{marginRight:6}}/>{toast}</div>}
    </div>
  );
}

function Header({view,onHome,onSettings}) {
  return (
    <div style={styles.header}>
      <div style={styles.headerInner}>
        <div style={styles.brandRow} onClick={onHome}>
          <div style={styles.brandMark}>IEL</div>
          <div><div style={styles.brandTitle}>Field Cost Log</div><div style={styles.brandSub}>Incredible Edible Landscapes</div></div>
        </div>
        {view==='home' ? <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button style={styles.headerSettings} onClick={onSettings}><Settings size={17}/></button>
            <button style={styles.headerSignOut} onClick={()=>signOut(auth)}>Sign out</button>
          </div>
          : <button style={styles.headerBack} onClick={onHome}>Back</button>}
      </div>
    </div>
  );
}

function HomeView({jobs,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew,onNav}) {
  const active = jobs.filter(j=>j.status==='active');
  return (
    <div style={styles.screen}>
      <div style={styles.sectionLabel}>ACTIVE JOBS - {active.length}</div>
      {active.length===0 && <div style={styles.emptyState}>No active jobs. Add one in Settings.</div>}
      {active.map(job=>{
        const c=computeJobCosts(job,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew);
        const hasData = c.laborHours>0||c.plantCost>0||c.materialsCost>0;
        return (
          <div key={job.id} style={styles.jobCard}>
            <div style={styles.jobCardTop} onClick={()=>onNav('jobDetail',job.id)}>
              <div>
                <div style={styles.jobName}>{job.name}</div>
                <div style={styles.jobMeta}>
                  {c.activePunches.length>0
                    ? <span style={{color:'#c98a3a',fontWeight:600}}>* {c.activePunches.length} clocked in</span>
                    : hasData ? `${c.laborHours.toFixed(1)} labor hrs - ${fmtMoney(c.totalCOGS)} COGS` : 'No data yet'}
                </div>
              </div>
              <ChevronRight size={18} color="#a8b5ac"/>
            </div>
            {hasData && (
              <div style={styles.marginRow} onClick={()=>onNav('jobDetail',job.id)}>
                <div style={styles.marginBarTrack}>
                  <div style={{...styles.marginBarFill,width:`${Math.min(100,Math.max(0,c.margin))}%`,background:c.margin>=job.targetMargin?'#3f7d5c':c.margin>=job.targetMargin-5?'#c98a3a':'#b8502f'}}/>
                </div>
                <div style={{...styles.marginValue,color:c.margin>=job.targetMargin?'#3f7d5c':c.margin>=job.targetMargin-5?'#c98a3a':'#b8502f'}}>{c.margin.toFixed(1)}%</div>
              </div>
            )}
            <div style={styles.jobActions}>
              <button style={styles.btnClockIn} onClick={()=>onNav('clockIn',job.id)}><LogIn size={14}/> Clock in</button>
              {c.activePunches.length>0 && <button style={styles.btnClockOut} onClick={()=>onNav('clockOut',job.id)}><LogOut size={14}/> Clock out</button>}
              <button style={styles.btnIcon} onClick={()=>onNav('jobDetail',job.id)} title="View job"><Package size={15}/></button>
            </div>
          </div>
        );
      })}
      {jobs.filter(j=>j.status==='complete').length>0 && (
        <>
          <div style={{...styles.sectionLabel,marginTop:24}}>COMPLETED</div>
          {jobs.filter(j=>j.status==='complete').sort((a,b)=>(b.completedAt||b.id).localeCompare(a.completedAt||a.id)).map(job=>{
            const c=computeJobCosts(job,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew);
            return (
              <div key={job.id} style={styles.completedCard} onClick={()=>onNav('jobDetail',job.id)}>
                <div><div style={styles.jobName}>{job.name}</div><div style={styles.jobMeta}>{c.fev?'Bonus eligible':'Below target'}</div></div>
                <div style={{fontWeight:700,fontSize:17,color:c.fev?'#3f7d5c':'#b8502f'}}>{c.margin.toFixed(1)}%</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------- Clock In ----------
function ClockInView({job,crew,punches,onSaveBatch,onCancel}) {
  const [clockIn,setClockIn]=useState(nowTimeStr());
  const [date,setDate]=useState(todayStr());
  const [selected,setSelected]=useState([]);
  if(!job) return null;
  const alreadyIn=punches.filter(p=>p.jobId===job.id&&p.date===date&&p.clockIn&&!p.clockOut).map(p=>p.crewId);
  const available=crew.filter(c=>!alreadyIn.includes(c.id));
  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const handleSave=()=>{ onSaveBatch(selected.map(crewId=>({type:'punch',jobId:job.id,crewId,date,clockIn,clockOut:null}))); };
  return (
    <div style={styles.screen}>
      <div style={styles.entryHeader}><LogIn size={20} color="#2f5d4a"/><div><div style={styles.entryTitle}>Clock in</div><div style={styles.entrySub}>{job.name}</div></div></div>
      <Card>
        <FieldLabel icon={Clock}>Clock-in time</FieldLabel>
        <div style={styles.settingsGrid}>
          <div><div style={styles.hourLabel}>Date</div><input type="date" style={styles.timeInput} value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div><div style={styles.hourLabel}>Time</div><input type="time" style={styles.timeInput} value={clockIn} onChange={e=>setClockIn(e.target.value)}/></div>
        </div>
        <div style={styles.hint}>Clock-in is at the shop - drive time is included.</div>
      </Card>
      <Card>
        <FieldLabel>Who's starting this job?</FieldLabel>
        {available.length===0&&<div style={styles.hint}>All crew members already clocked in for this job today.</div>}
        {available.map(m=>(
          <div key={m.id} style={{...styles.crewSelectRow,background:selected.includes(m.id)?'#eef6f1':'#fafaf8',borderColor:selected.includes(m.id)?'#2f5d4a':'#e2e0d6'}} onClick={()=>toggle(m.id)}>
            <div><div style={{fontWeight:600,fontSize:14}}>{m.name}</div><div style={{fontSize:12,color:'#8a9a8e'}}>{m.role} - ${m.burdenedRate}/hr</div></div>
            {selected.includes(m.id)&&<Check size={18} color="#2f5d4a"/>}
          </div>
        ))}
      </Card>
      <div style={styles.bottomBar}>
        <button style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        <button style={{...styles.btnPrimary,opacity:selected.length?1:0.4}} onClick={handleSave} disabled={!selected.length}>Clock in {selected.length>0?`(${selected.length})`:''}</button>
      </div>
    </div>
  );
}

// ---------- Clock Out ----------
function ClockOutView({job,crew,punches,onClockOutBatch,onCancel}) {
  const openPunches=(job ? punches.filter(p=>p.jobId===job.id&&p.clockIn&&!p.clockOut) : []);
  const [selected,setSelected]=useState([]);
  const [states,setStates]=useState(()=>Object.fromEntries(openPunches.map(p=>[p.id,{clockOut:nowTimeStr(),overrideHrs:'',showOverride:false}])));
  if(!job) return null;
  const upd=(id,patch)=>setStates(s=>({...s,[id]:{...s[id],...patch}}));
  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const handleSave=()=>{
    const updates=selected.map(id=>{const st=states[id]||{}; return {id,clockOut:st.clockOut,...(st.overrideHrs!==''?{overrideHrs:Number(st.overrideHrs)}:{})}; });
    onClockOutBatch(updates);
  };
  return (
    <div style={styles.screen}>
      <div style={styles.entryHeader}><LogOut size={20} color="#2f5d4a"/><div><div style={styles.entryTitle}>Clock out</div><div style={styles.entrySub}>{job.name}</div></div></div>
      {openPunches.length===0&&<div style={styles.hint}>No one is currently clocked in on this job.</div>}

      <Card>
        <FieldLabel>Who's clocking out?</FieldLabel>
        {openPunches.length===0&&<div style={styles.hint}>No open punches.</div>}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {openPunches.map(punch=>{
            const m=crew.find(c=>c.id===punch.crewId);
            const isSelected=selected.includes(punch.id);
            return (
              <div key={punch.id} style={{...styles.crewSelectRow,background:isSelected?'#eef6f1':'#fafaf8',borderColor:isSelected?'#2f5d4a':'#e2e0d6'}} onClick={()=>toggle(punch.id)}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{m?.name||'?'}</div>
                  <div style={{fontSize:12,color:'#8a9a8e'}}>{m?.role} - in {fmtTime(punch.clockIn)}</div>
                </div>
                {isSelected&&<Check size={18} color="#2f5d4a"/>}
              </div>
            );
          })}
        </div>
      </Card>

      {selected.length>0&&(
        <Card>
          <FieldLabel icon={Clock}>Clock-out time</FieldLabel>
          {selected.map(id=>{
            const punch=openPunches.find(p=>p.id===id);
            const m=crew.find(c=>c.id===punch?.crewId);
            const st=states[id]||{clockOut:nowTimeStr(),overrideHrs:'',showOverride:false};
            const autoHrs=hoursFromPunch(punch?.clockIn,st.clockOut);
            const finalHrs=st.overrideHrs!==''?Number(st.overrideHrs):autoHrs;
            const ot=Math.max(0,finalHrs-8);
            const cost=calcPersonLaborCost(finalHrs,m?m.burdenedRate:0);
            return (
              <div key={id} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid #e2e0d6'}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>{m?.name||'?'}</div>
                <div style={styles.settingsGrid}>
                  <div><div style={styles.hourLabel}>Clock-out time</div><input type="time" style={styles.timeInput} value={st.clockOut} onChange={e=>upd(id,{clockOut:e.target.value})}/></div>
                  <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
                    <div style={{fontSize:12,color:'#5c6b56'}}>{finalHrs.toFixed(2)}h{ot>0?` - ${ot.toFixed(2)}OT`:''}</div>
                    <div style={{marginLeft:'auto',fontWeight:700,color:ot>0?'#c98a3a':'#2f5d4a',fontSize:13}}>{fmtMoney2(cost)}</div>
                  </div>
                </div>
                {!st.showOverride
                  ? <button style={{...styles.addChip,marginTop:8}} onClick={()=>upd(id,{showOverride:true,overrideHrs:finalHrs.toFixed(2)})}>Override hours</button>
                  : <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                      <div style={styles.numberInputWrap}><input type="number" inputMode="decimal" style={styles.numberInput} value={st.overrideHrs} onChange={e=>upd(id,{overrideHrs:e.target.value})} onFocus={e=>e.target.select()}/><span style={styles.numberSuffix}>hrs (manual)</span></div>
                      <button style={styles.removeBtn} onClick={()=>upd(id,{showOverride:false,overrideHrs:''})}><X size={15}/></button>
                    </div>}
              </div>
            );
          })}
        </Card>
      )}

      <div style={styles.bottomBar}>
        <button style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        <button style={{...styles.btnPrimary,opacity:selected.length?1:0.4}} onClick={handleSave} disabled={!selected.length}>
          Clock out {selected.length>0?`(${selected.length})`:''}
        </button>
      </div>
    </div>
  );
}

// ---------- Shared ----------
function FieldLabel({icon:Icon,children}) { return <div style={styles.fieldLabel}>{Icon&&<Icon size={14} style={{marginRight:6,opacity:0.6}}/>}{children}</div>; }
function NumberInput({value,onChange,suffix,placeholder='0'}) {
  return <div style={styles.numberInputWrap}><input type="number" inputMode="decimal" style={styles.numberInput} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} onFocus={e=>e.target.select()}/>{suffix&&<span style={styles.numberSuffix}>{suffix}</span>}</div>;
}
function Card({children,style}) { return <div style={{...styles.card,...style}}>{children}</div>; }
function TI({value,onChange,placeholder='',style={}}) { return <input style={{...styles.textInput,...style}} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>; }

// ---------- Plants Panel (collapsible, itemized) ----------
const PLANT_SIZES = ['4"','1g','3g','7g','15g','25g','45g','Other'];

function PlantsPanel({jobId,plantsRec,onUpdate}) {
  const [open,setOpen]=useState(false);
  const rec=plantsRec[jobId]||{items:[],totalCost:'',notes:''};
  const items=rec.items||[];
  const totalQty=items.reduce((s,i)=>s+(Number(i.qty)||0),0);

  const set=(patch)=>onUpdate(jobId,{...rec,...patch});
  const setItems=(next)=>set({items:next});
  const addItem=()=>setItems([...items,{id:uid('pl'),name:'',size:'3g',qty:1}]);
  const updItem=(id,patch)=>setItems(items.map(i=>i.id===id?{...i,...patch}:i));
  const removeItem=(id)=>setItems(items.filter(i=>i.id!==id));
  const adjustQty=(id,delta)=>setItems(items.map(i=>i.id===id?{...i,qty:Math.max(0,(Number(i.qty)||0)+delta)}:i));

  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Sprout size={16} color="#2f5d4a"/>
          <div>
            <div style={styles.panelTitle}>Plants</div>
            <div style={styles.panelSub}>
              {items.length>0
                ? `${items.length} line${items.length!==1?'s':''} - ${totalQty} plants total${rec.totalCost?` - ${fmtMoney2(Number(rec.totalCost))} wholesale`:''}` 
                : 'No plants logged yet'}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {items.length>0&&<Edit2 size={13} color="#8a9a8e"/>}
          {open?<ChevronUp size={18} color="#8a9a8e"/>:<ChevronDown size={18} color="#8a9a8e"/>}
        </div>
      </div>
      {open&&(
        <div style={styles.panelBody}>
          {items.length===0&&<div style={styles.hint}>Add each plant type being installed on this job.</div>}

          {/* Column headers */}
          {items.length>0&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 32px',gap:6,marginBottom:4,padding:'0 2px'}}>
              <div style={{fontSize:10.5,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.04em'}}>PLANT NAME</div>
              <div style={{fontSize:10.5,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.04em'}}>SIZE</div>
              <div style={{fontSize:10.5,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.04em',textAlign:'center'}}>QTY</div>
              <div/>
            </div>
          )}

          {items.map(item=>(
            <div key={item.id} style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 32px',gap:6,alignItems:'center',marginBottom:8}}>
              <input
                style={{...styles.textInput,flex:'unset',width:'100%',padding:'9px 10px',fontSize:13}}
                placeholder="e.g. Mango, Kent"
                value={item.name}
                onChange={e=>updItem(item.id,{name:e.target.value})}
              />
              <select
                style={{...styles.select,flex:'unset',width:'100%',padding:'9px 6px',fontSize:13}}
                value={item.size}
                onChange={e=>updItem(item.id,{size:e.target.value})}
              >
                {PLANT_SIZES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {/* Qty ticker */}
              <div style={styles.qtyTicker}>
                <button style={styles.qtyBtn} onClick={()=>adjustQty(item.id,-1)}>-</button>
                <input
                  type="number"
                  inputMode="numeric"
                  style={styles.qtyInput}
                  value={item.qty}
                  onChange={e=>updItem(item.id,{qty:e.target.value})}
                  onFocus={e=>e.target.select()}
                />
                <button style={styles.qtyBtn} onClick={()=>adjustQty(item.id,1)}>+</button>
              </div>
              <button style={{...styles.removeBtn,padding:4}} onClick={()=>removeItem(item.id)}><X size={14}/></button>
            </div>
          ))}

          <button style={{...styles.addChip,marginTop:4}} onClick={addItem}><Plus size={13}/> Add plant</button>

          <div style={{height:1,background:'#e2e0d6',margin:'14px 0'}}/>
          <div style={styles.settingsGrid}>
            <div>
              <div style={styles.hourLabel}>Total wholesale cost (enter at job close)</div>
              <NumberInput value={rec.totalCost||''} onChange={v=>set({totalCost:v})} suffix="$"/>
            </div>
            <div>
              <div style={styles.hourLabel}>Notes</div>
              <TI value={rec.notes||''} onChange={v=>set({notes:v})} placeholder="e.g. nursery block C"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Materials Panel (collapsible) ----------
function MaterialsPanel({jobId,materialsRec,stockItems,onUpdate}) {
  const [open,setOpen]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const rec=materialsRec[jobId]||{items:[]};
  const items=rec.items||[];

  const misc=rec.miscExpenses||[];
  const miscTotal=misc.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const totalCost=items.reduce((sum,item)=>sum+materialItemCost(item,stockItems)-materialReturnCredit(item,stockItems),0)+miscTotal;

  const setItems=(next)=>onUpdate(jobId,{...rec,items:next});
  const setMisc=(next)=>onUpdate(jobId,{...rec,miscExpenses:next});
  const addMisc=()=>setMisc([...misc,{id:uid('misc'),title:'',amount:'',notes:''}]);
  const updMisc=(id,patch)=>setMisc(misc.map(e=>e.id===id?{...e,...patch}:e));
  const removeMisc=(id)=>setMisc(misc.filter(e=>e.id!==id));
  const addItem=(type)=>{ const ni={id:uid('mat'),date:todayStr(),description:'',source:'',type,stockItemId:stockItems[0]?.id||'',qty:'',unit:'',receiptAmount:'',isReturn:false,notes:''}; setItems([...items,ni]); setEditingId(ni.id); };
  const updateItem=(id,patch)=>setItems(items.map(it=>it.id===id?{...it,...patch}:it));
  const removeItem=(id)=>{ setItems(items.filter(it=>it.id!==id)); if(editingId===id)setEditingId(null); };

  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Package size={16} color="#2f5d4a"/>
          <div>
            <div style={styles.panelTitle}>Materials</div>
            <div style={styles.panelSub}>{items.length>0?`${items.length} item${items.length!==1?'s':''} - ${fmtMoney2(Math.max(0,totalCost))}`:'No materials logged yet'}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {items.length>0&&<Edit2 size={13} color="#8a9a8e"/>}
          {open?<ChevronUp size={18} color="#8a9a8e"/>:<ChevronDown size={18} color="#8a9a8e"/>}
        </div>
      </div>
      {open&&(
        <div style={styles.panelBody}>
          {items.length===0&&<div style={styles.hint}>No materials logged yet. Add purchase, stock draw, or return below.</div>}
          {items.map(item=>{
            const isEditing=editingId===item.id;
            const itemCost=materialItemCost(item,stockItems)-materialReturnCredit(item,stockItems);
            const si=item.type==='stockDraw'?stockItems.find(s=>s.id===item.stockItemId):null;
            return (
              <div key={item.id} style={{...styles.matItem,borderColor:item.isReturn?'#f0d8d3':isEditing?'#2f5d4a':'#e2e0d6',background:item.isReturn?'#fdf5f3':isEditing?'#f5fbf7':'#fafaf8'}}>
                <div style={styles.matItemHeader} onClick={()=>setEditingId(isEditing?null:item.id)}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13.5,color:item.isReturn?'#b8502f':'#22301f'}}>{item.description||<span style={{color:'#aaa',fontStyle:'italic'}}>Untitled</span>}{item.isReturn?' (return)':''}</div>
                    <div style={{fontSize:11.5,color:'#8a9a8e',marginTop:2}}>
                      {item.date} {item.source?`- ${item.source}`:''} {item.type==='stockDraw'&&si?`- ${item.qty} ${si.unit||''} ${si.name}`:''} - <span style={{fontWeight:600,color:item.isReturn?'#b8502f':'#2f5d4a'}}>{item.isReturn?'-':''}{fmtMoney2(Math.abs(itemCost))}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    {isEditing?<ChevronUp size={15} color="#8a9a8e"/>:<ChevronDown size={15} color="#8a9a8e"/>}
                    <button style={styles.removeBtn} onClick={e=>{e.stopPropagation();removeItem(item.id);}}><X size={14}/></button>
                  </div>
                </div>
                {isEditing&&(
                  <div style={{paddingTop:10,display:'flex',flexDirection:'column',gap:10}}>
                    <div style={styles.settingsGrid}>
                      <div><div style={styles.hourLabel}>Description</div><TI value={item.description} onChange={v=>updateItem(item.id,{description:v})} placeholder="e.g. 3/4 PVC pipe"/></div>
                      <div><div style={styles.hourLabel}>Date</div><input type="date" style={styles.timeInput} value={item.date} onChange={e=>updateItem(item.id,{date:e.target.value})}/></div>
                    </div>
                    <div style={styles.settingsGrid}>
                      <div><div style={styles.hourLabel}>Source / supplier</div><TI value={item.source} onChange={v=>updateItem(item.id,{source:v})} placeholder="e.g. Home Depot"/></div>
                      <div><div style={styles.hourLabel}>Type</div>
                        <select style={{...styles.select,flex:'unset',width:'100%'}} value={item.type} onChange={e=>updateItem(item.id,{type:e.target.value})}>
                          <option value="purchase">Purchase (has receipt)</option>
                          <option value="stockDraw">Shop stock draw</option>
                          <option value="other">Other / no cost</option>
                        </select>
                      </div>
                    </div>
                    {item.type==='purchase'&&(
                      <div style={styles.settingsGrid}>
                        <div><div style={styles.hourLabel}>Receipt amount</div><NumberInput value={item.receiptAmount} onChange={v=>updateItem(item.id,{receiptAmount:v})} suffix="$"/></div>
                        <div><div style={styles.hourLabel}>Qty (optional)</div><TI value={item.qty} onChange={v=>updateItem(item.id,{qty:v})} placeholder="e.g. 10"/></div>
                      </div>
                    )}
                    {item.type==='stockDraw'&&(
                      <div style={styles.settingsGrid}>
                        <div><div style={styles.hourLabel}>Stock item</div>
                          <select style={{...styles.select,flex:'unset',width:'100%'}} value={item.stockItemId} onChange={e=>updateItem(item.id,{stockItemId:e.target.value})}>
                            {stockItems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div><div style={styles.hourLabel}>Quantity</div><NumberInput value={item.qty} onChange={v=>updateItem(item.id,{qty:v})} suffix={si?.unit||'units'}/></div>
                      </div>
                    )}
                    <div style={styles.settingsGrid}>
                      <div><div style={styles.hourLabel}>Notes</div><TI value={item.notes} onChange={v=>updateItem(item.id,{notes:v})} placeholder="Optional notes"/></div>
                      <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,cursor:'pointer',color:item.isReturn?'#b8502f':'#5c6b56'}}>
                          <input type="checkbox" checked={item.isReturn} onChange={e=>updateItem(item.id,{isReturn:e.target.checked})} style={{accentColor:'#b8502f'}}/>
                          Mark as return
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            <button style={styles.addChip} onClick={()=>addItem('purchase')}><Plus size={13}/> Purchase</button>
            <button style={styles.addChip} onClick={()=>addItem('stockDraw')}><Plus size={13}/> Shop stock</button>
            <button style={styles.addChip} onClick={()=>addItem('other')}><Plus size={13}/> Other</button>
          </div>

          <div style={{height:1,background:'#e2e0d6',margin:'16px 0 12px'}}/>
          <div style={{fontSize:11,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.06em',marginBottom:8}}>MISC. EXPENSES</div>
          {misc.length===0&&<div style={styles.hint}>Landfill fees, permit costs, one-off charges that don't fit elsewhere.</div>}
          {misc.map(e=>(
            <div key={e.id} style={{border:'1.5px solid #e2e0d6',borderRadius:10,padding:10,marginBottom:8,background:'#fafaf8'}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:8}}>
                <input style={{...styles.textInput,flex:2,padding:'9px 10px',fontSize:13}} placeholder="e.g. Landfill dump fee" value={e.title} onChange={v=>updMisc(e.id,{title:v.target.value})}/>
                <div style={styles.numberInputWrap}>
                  <input type="number" inputMode="decimal" style={styles.numberInput} placeholder="0.00" value={e.amount} onChange={v=>updMisc(e.id,{amount:v.target.value})} onFocus={v=>v.target.select()}/>
                  <span style={styles.numberSuffix}>$</span>
                </div>
                <button style={{...styles.removeBtn,padding:4}} onClick={()=>removeMisc(e.id)}><X size={14}/></button>
              </div>
              <input style={{...styles.textInput,flex:'unset',width:'100%',padding:'8px 10px',fontSize:12}} placeholder="Notes (optional)" value={e.notes} onChange={v=>updMisc(e.id,{notes:v.target.value})}/>
            </div>
          ))}
          <button style={styles.addChip} onClick={addMisc}><Plus size={13}/> Add misc. expense</button>
        </div>
      )}
    </div>
  );
}

// ---------- Equipment + Truck Log ----------
function EquipmentTruckPanel({jobId,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,onAddEquipment,onAddTruck,onDeleteEquipment,onDeleteTruck,onAddTrailer,onDeleteTrailer}) {
  const [open,setOpen]=useState(false);
  const [newEq,setNewEq]=useState({equipmentId:equipment[0]?.id||'',startMeter:'',endMeter:''});
  const [newTr,setNewTr]=useState({truckId:trucks[0]?.id||'',miles:''});
  const [newTrl,setNewTrl]=useState({trailerId:(trailers||[])[0]?.id||'',days:'1'});

  const jobEq=equipmentLog.filter(e=>e.jobId===jobId);
  const jobTr=truckLog.filter(t=>t.jobId===jobId);
  const jobTrl=(trailerLog||[]).filter(t=>t.jobId===jobId);

  const totalEqCost=jobEq.reduce((sum,e)=>{const hrs=Math.max(0,(Number(e.endMeter)||0)-(Number(e.startMeter)||0));const ei=equipment.find(x=>x.id===e.equipmentId);return sum+hrs*(ei?ei.hourlyCost:0);},0);
  const totalTrCost=jobTr.reduce((sum,t)=>sum+(Number(t.miles)||0)*(rates.mileageRate||0),0);
  const totalTrlCost=jobTrl.reduce((sum,t)=>{const ti=(trailers||[]).find(x=>x.id===t.trailerId);return sum+(Number(t.days)||0)*(ti?ti.dayRate:0);},0);
  const totalCount=jobEq.length+jobTr.length+jobTrl.length;

  return (
    <div style={styles.panelCard}>
      <div style={styles.panelHeader} onClick={()=>setOpen(o=>!o)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Wrench size={16} color="#2f5d4a"/>
          <div>
            <div style={styles.panelTitle}>Equipment & Trucks</div>
            <div style={styles.panelSub}>{totalCount>0?`${jobEq.length} equip - ${jobTrl.length} trailer - ${jobTr.length} truck - ${fmtMoney2(totalEqCost+totalTrlCost+totalTrCost)}`:'None logged yet'}</div>
          </div>
        </div>
        {open?<ChevronUp size={18} color="#8a9a8e"/>:<ChevronDown size={18} color="#8a9a8e"/>}
      </div>
      {open&&(
        <div style={styles.panelBody}>

          {/* EQUIPMENT */}
          {jobEq.length>0&&<>
            <div style={{fontSize:11,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.06em',marginBottom:6}}>EQUIPMENT LOG</div>
            {jobEq.map(e=>{const hrs=Math.max(0,(Number(e.endMeter)||0)-(Number(e.startMeter)||0));const ei=equipment.find(x=>x.id===e.equipmentId);return(
              <div key={e.id} style={{...styles.logLine,alignItems:'center'}}>
                <span>{e.date} - {ei?.name||'?'} - {hrs.toFixed(1)}hr - {fmtMoney2(hrs*(ei?.hourlyCost||0))}</span>
                <button style={{...styles.removeBtn,padding:'2px 4px',marginLeft:4}} onClick={()=>onDeleteEquipment(e.id)}><X size={13}/></button>
              </div>
            );})}
          </>}
          <div style={{marginTop:10}}>
            <div style={styles.hourLabel}>Add equipment entry</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
              <select style={{...styles.select,flex:'1 1 120px'}} value={newEq.equipmentId} onChange={e=>setNewEq(s=>({...s,equipmentId:e.target.value}))}>
                {equipment.map(eq=><option key={eq.id} value={eq.id}>{eq.name}</option>)}
              </select>
              <NumberInput value={newEq.startMeter} onChange={v=>setNewEq(s=>({...s,startMeter:v}))} suffix="start hr"/>
              <NumberInput value={newEq.endMeter} onChange={v=>setNewEq(s=>({...s,endMeter:v}))} suffix="end hr"/>
              <button style={styles.btnPrimarySmall} onClick={()=>{onAddEquipment({jobId,date:todayStr(),...newEq});setNewEq({equipmentId:equipment[0]?.id||'',startMeter:'',endMeter:''});}}>Add</button>
            </div>
          </div>

          <div style={{height:1,background:'#e2e0d6',margin:'14px 0'}}/>

          {/* TRAILERS */}
          {jobTrl.length>0&&<>
            <div style={{fontSize:11,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.06em',marginBottom:6}}>TRAILER LOG</div>
            {jobTrl.map(t=>{const ti=(trailers||[]).find(x=>x.id===t.trailerId);return(
              <div key={t.id} style={{...styles.logLine,alignItems:'center'}}>
                <span>{t.date} - {ti?.name||'?'} - {t.days} day{Number(t.days)!==1?'s':''} - {fmtMoney2((Number(t.days)||0)*(ti?.dayRate||0))}</span>
                <button style={{...styles.removeBtn,padding:'2px 4px',marginLeft:4}} onClick={()=>onDeleteTrailer(t.id)}><X size={13}/></button>
              </div>
            );})}
          </>}
          <div style={{marginTop:10}}>
            <div style={styles.hourLabel}>Add trailer deployment</div>
            <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
              <select style={{...styles.select,flex:'1 1 120px'}} value={newTrl.trailerId} onChange={e=>setNewTrl(s=>({...s,trailerId:e.target.value}))}>
                {(trailers||[]).map(t=><option key={t.id} value={t.id}>{t.name} (${t.dayRate}/day)</option>)}
              </select>
              <NumberInput value={newTrl.days} onChange={v=>setNewTrl(s=>({...s,days:v}))} suffix="days"/>
              <button style={styles.btnPrimarySmall} onClick={()=>{onAddTrailer({jobId,date:todayStr(),...newTrl});setNewTrl({trailerId:(trailers||[])[0]?.id||'',days:'1'});}}>Add</button>
            </div>
            <div style={styles.hint}>Log each day a trailer is deployed to this job.</div>
          </div>

          <div style={{height:1,background:'#e2e0d6',margin:'14px 0'}}/>

          {/* TRUCKS */}
          {jobTr.length>0&&<>
            <div style={{fontSize:11,fontWeight:700,color:'#8a9a8e',letterSpacing:'0.06em',marginBottom:6}}>TRUCK LOG</div>
            {jobTr.map(t=>{const tr=trucks.find(x=>x.id===t.truckId);return(
              <div key={t.id} style={{...styles.logLine,alignItems:'center'}}>
                <span>{t.date} - {tr?.name||'?'} - {t.miles}mi - {fmtMoney2((Number(t.miles)||0)*(rates.mileageRate||0))}</span>
                <button style={{...styles.removeBtn,padding:'2px 4px',marginLeft:4}} onClick={()=>onDeleteTruck(t.id)}><X size={13}/></button>
              </div>
            );})}
          </>}
          <div style={{marginTop:10}}>
            <div style={styles.hourLabel}>Add truck mileage</div>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <select style={{...styles.select,flex:'1 1 120px'}} value={newTr.truckId} onChange={e=>setNewTr(s=>({...s,truckId:e.target.value}))}>
                {trucks.map(tr=><option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
              <NumberInput value={newTr.miles} onChange={v=>setNewTr(s=>({...s,miles:v}))} suffix="miles"/>
              <button style={styles.btnPrimarySmall} onClick={()=>{onAddTruck({jobId,date:todayStr(),...newTr});setNewTr({truckId:trucks[0]?.id||'',miles:''});}}>Add</button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ---------- Punch Log (editable) ----------
function PunchLog({punches,crew,onUpdate,onClockOutNow,onDelete}) {
  const [editingId,setEditingId]=useState(null);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
      {punches.map(p=>{
        const m=crew.find(c=>c.id===p.crewId);
        const hrs=p.overrideHrs!=null?Number(p.overrideHrs):hoursFromPunch(p.clockIn,p.clockOut);
        const ot=Math.max(0,hrs-8);
        const cost=calcPersonLaborCost(hrs,m?m.burdenedRate:0);
        const isOpen=p.clockIn&&!p.clockOut;
        const isEditing=editingId===p.id;

        return (
          <div key={p.id} style={{...styles.logEntry,flexDirection:'column',alignItems:'stretch',borderColor:isOpen?'#c98a3a':isEditing?'#2f5d4a':'#e2e0d6',background:isOpen?'#fefaf3':isEditing?'#f5fbf7':'#fff',padding:0,overflow:'hidden'}}>
            {/* Summary row */}
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',cursor:'pointer'}} onClick={()=>setEditingId(isEditing?null:p.id)}>
              {isOpen?<Clock size={14} color="#c98a3a"/>:<Check size={14} color="#2f5d4a"/>}
              <div style={{flex:1}}>
                <div style={styles.logEntryTitle}>{m?.name||'Unknown'} - {m?.role||''}</div>
                <div style={styles.logEntrySub}>
                  {isOpen
                    ?`In ${fmtTime(p.clockIn)} - still on clock - ${p.date}`
                    :`${fmtTime(p.clockIn)} -> ${fmtTime(p.clockOut)}${p.overrideHrs!=null?' (manual hrs)':''} - ${hrs.toFixed(2)}hr${ot>0?` - ${ot.toFixed(2)} OT`:''} - ${fmtMoney2(cost)} - ${p.date}`}
                  {p.notes&&!isEditing&&<div style={{fontSize:11.5,color:'#8a9a8e',marginTop:2,fontStyle:'italic'}}>{p.notes}</div>}
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {isOpen&&<button style={{...styles.btnClockOut,flex:0,padding:'5px 10px',fontSize:12}} onClick={e=>{e.stopPropagation();onClockOutNow(p.id);}}>Out now</button>}
                <Edit2 size={14} color={isEditing?'#2f5d4a':'#a8b5ac'}/>
                <button style={{...styles.removeBtn,padding:'4px',marginLeft:0}} onClick={e=>{e.stopPropagation();onDelete(p.id);}} title="Delete entry"><X size={14} color="#b8502f"/></button>
              </div>
            </div>

            {/* Inline edit form */}
            {isEditing&&(
              <div style={{borderTop:'1px solid #e2e0d6',padding:'12px 13px',display:'flex',flexDirection:'column',gap:10,background:'#f9fdf9'}}>
                <div style={styles.settingsGrid}>
                  <div>
                    <div style={styles.hourLabel}>Crew member</div>
                    <select style={{...styles.select,flex:'unset',width:'100%'}} value={p.crewId} onChange={e=>onUpdate(p.id,{crewId:e.target.value})}>
                      {crew.map(c=><option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={styles.hourLabel}>Date</div>
                    <input type="date" style={styles.timeInput} value={p.date} onChange={e=>onUpdate(p.id,{date:e.target.value})}/>
                  </div>
                </div>
                <div style={styles.settingsGrid}>
                  <div>
                    <div style={styles.hourLabel}>Clock-in time</div>
                    <input type="time" style={styles.timeInput} value={p.clockIn||''} onChange={e=>onUpdate(p.id,{clockIn:e.target.value,overrideHrs:null})}/>
                  </div>
                  <div>
                    <div style={styles.hourLabel}>Clock-out time</div>
                    <input type="time" style={styles.timeInput} value={p.clockOut||''} onChange={e=>onUpdate(p.id,{clockOut:e.target.value,overrideHrs:null})}/>
                  </div>
                </div>
                <div style={styles.settingsGrid}>
                  <div>
                    <div style={styles.hourLabel}>Manual hour override <span style={{fontWeight:400,color:'#aaa'}}>(overrides timestamps)</span></div>
                    <div style={styles.numberInputWrap}>
                      <input type="number" inputMode="decimal" style={styles.numberInput} value={p.overrideHrs??''} placeholder={hrs.toFixed(2)} onChange={e=>onUpdate(p.id,{overrideHrs:e.target.value===''?null:Number(e.target.value)})} onFocus={e=>e.target.select()}/>
                      <span style={styles.numberSuffix}>hrs</span>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:4}}>
                    <div style={{fontSize:12,color:'#5c6b56',fontWeight:600}}>{hrs.toFixed(2)}hr{ot>0?` - ${ot.toFixed(2)} OT`:''}</div>
                    <div style={{fontSize:13,fontWeight:700,color:ot>0?'#c98a3a':'#2f5d4a'}}>{fmtMoney2(cost)}</div>
                  </div>
                </div>
                <div>
                  <div style={styles.hourLabel}>Performance notes</div>
                  <input style={{...styles.textInput,flex:'unset',width:'100%'}} placeholder="e.g. strong on irrigation, needs guidance on planting depth" value={p.notes||''} onChange={e=>onUpdate(p.id,{notes:e.target.value})}/>
                </div>
                <button style={{...styles.btnSecondary,padding:'8px 0',fontSize:13}} onClick={()=>setEditingId(null)}>Done editing</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Delete Job Confirm ----------
function DeleteJobConfirm({jobName, onConfirm}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return (
    <button style={styles.deleteJobBtn} onClick={()=>setConfirming(true)}>Delete job</button>
  );
  return (
    <div style={{marginTop:12,background:'#fdf3f1',border:'1.5px solid #f0d8d3',borderRadius:10,padding:'14px 16px'}}>
      <div style={{fontSize:13.5,fontWeight:600,color:'#b8502f',marginBottom:10}}>Delete "{jobName}"? This removes all logged data and cannot be undone.</div>
      <div style={{display:'flex',gap:8}}>
        <button style={{...styles.btnSecondary,flex:1,padding:'10px 0',fontSize:13}} onClick={()=>setConfirming(false)}>Cancel</button>
        <button style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',background:'#b8502f',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}} onClick={onConfirm}>Yes, delete</button>
      </div>
    </div>
  );
}

// ---------- Job Detail ----------
function JobDetail({job,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew,onUpdateJob,onDeleteJob,onUpdatePlants,onUpdateMaterials,onAddEquipment,onAddTruck,onDeleteEquipment,onDeleteTruck,onAddTrailer,onDeleteTrailer,onNav,onClockOutNow,onUpdatePunch,onDeletePunch,onBack}) {
  if(!job) return null;
  const c=computeJobCosts(job,punches,plantsRec,materialsRec,equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers,stockItems,crew);
  const overBudget=job.bidLaborHours&&c.laborHours>job.bidLaborHours*1.15;
  const jobPunches=punches.filter(p=>p.jobId===job.id).sort((a,b)=>(a.date+(a.clockIn||'')).localeCompare(b.date+(b.clockIn||'')));

  return (
    <div style={styles.screen}>
      <div style={styles.entryHeader}><div><div style={styles.entryTitle}>{job.name}</div><div style={styles.entrySub}>{job.status==='active'?'Active job':'Completed'}</div></div></div>
      {job.notes&&<div style={{background:'#f0f7f3',border:'1px solid #c8e0d4',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#2f5d4a',marginBottom:14,lineHeight:1.5}}>{job.notes}</div>}

      <div style={styles.marginHero}>
        <div style={styles.marginHeroLabel}>GROSS MARGIN</div>
        <div style={{...styles.marginHeroValue,color:c.margin>=job.targetMargin?'#7dd9a8':c.margin>=job.targetMargin-5?'#f5c97a':'#f4856a'}}>{c.margin.toFixed(1)}%</div>
        <div style={styles.marginHeroSub}>{c.fev?'FEV achieved':`${(job.targetMargin-c.margin).toFixed(1)}pt below ${job.targetMargin}% target`}</div>
      </div>

      {overBudget&&<div style={styles.warningBanner}><AlertTriangle size={16} style={{marginRight:8,flexShrink:0}}/>Labor hrs running {((c.laborHours/job.bidLaborHours-1)*100).toFixed(0)}% over {job.bidLaborHours}-hr target.</div>}
      {c.activePunches.length>0&&<div style={{...styles.warningBanner,background:'#fef9ee',color:'#9c6a1a'}}><Clock size={16} style={{marginRight:8,flexShrink:0}}/>{c.activePunches.length} crew member{c.activePunches.length>1?'s':''} still clocked in.</div>}

      <Card>
        <div style={styles.detailGrid}>
          <DetailRow label="Revenue (bid)" value={fmtMoney(c.revenue)}/>
          <DetailRow label="Labor" value={fmtMoney(c.laborCost)} sub={`${c.laborHours.toFixed(1)} crew-hrs${c.laborOTHours>0?` - ${c.laborOTHours.toFixed(1)} OT`:''}`}/>
          <DetailRow label="Plants" value={fmtMoney(c.plantCost)} sub={`${c.totalPlantQty} plants - ${fmtMoney2(c.plantCost)} total wholesale cost`}/>
          <DetailRow label="Materials" value={fmtMoney(c.materialsCost)} sub={((materialsRec[job.id]?.miscExpenses||[]).length>0)?`incl. ${(materialsRec[job.id]?.miscExpenses||[]).length} misc expense(s)`:undefined}/>
          <DetailRow label="Equipment" value={fmtMoney(c.equipmentCost)} sub={Object.entries(c.equipmentHours).map(([k,h])=>`${equipment.find(e=>e.id===k)?.name||k}: ${h.toFixed(1)}hr`).join(' - ')||'-'}/>
          <DetailRow label="Truck fuel" value={fmtMoney(c.truckCost)} sub={Object.entries(c.truckMiles).map(([k,m])=>`${trucks.find(t=>t.id===k)?.name||k}: ${m}mi`).join(' - ')||'-'}/>
          <DetailRow label="Trailers" value={fmtMoney(c.trailerCost)} sub={Object.entries(c.trailerDays).map(([k,d])=>`${trailers.find(t=>t.id===k)?.name||k}: ${d}d`).join(' - ')||'-'}/>
          <div style={styles.divider}/>
          <DetailRow label="Total COGS" value={fmtMoney(c.totalCOGS)} bold/>
          <DetailRow label="Gross profit" value={fmtMoney(c.grossProfit)} bold/>
        </div>
      </Card>

      <div style={styles.sectionLabel}>PLANTS & MATERIALS</div>
      <PlantsPanel jobId={job.id} plantsRec={plantsRec} onUpdate={onUpdatePlants}/>
      <MaterialsPanel jobId={job.id} materialsRec={materialsRec} stockItems={stockItems} onUpdate={onUpdateMaterials}/>

      <div style={styles.sectionLabel}>EQUIPMENT & TRUCKS</div>
      <EquipmentTruckPanel jobId={job.id} {...{equipmentLog,truckLog,trailerLog,rates,equipment,trucks,trailers}} onAddEquipment={onAddEquipment} onAddTruck={onAddTruck} onDeleteEquipment={onDeleteEquipment} onDeleteTruck={onDeleteTruck} onAddTrailer={onAddTrailer} onDeleteTrailer={onDeleteTrailer}/>

      <div style={styles.sectionLabel}>PUNCH LOG</div>
      {jobPunches.length===0&&<div style={styles.hint}>No punches yet. Use Clock In on the home screen.</div>}
      <PunchLog punches={jobPunches} crew={crew} onUpdate={onUpdatePunch} onClockOutNow={onClockOutNow} onDelete={onDeletePunch}/>

      {job.status==='active'&&<button style={styles.markCompleteBtn} onClick={()=>onUpdateJob({...job,status:'complete',completedAt:new Date().toISOString()})}>Mark job complete</button>}
      {job.status==='complete'&&(
        <DeleteJobConfirm jobName={job.name} onConfirm={()=>onDeleteJob(job.id)}/>
      )}
    </div>
  );
}

function DetailRow({label,value,sub,bold}) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailRowLeft}><div style={{...styles.detailLabel,fontWeight:bold?700:500}}>{label}</div>{sub&&<div style={styles.detailSub}>{sub}</div>}</div>
      <div style={{...styles.detailValue,fontWeight:bold?700:600}}>{value}</div>
    </div>
  );
}

// ---------- Settings ----------
function SettingsView({jobs,rates,equipment,trucks,trailers,stockItems,crew,onUpdateJobs,onUpdateRates,onUpdateEquipment,onUpdateTrucks,onUpdateTrailers,onUpdateStock,onUpdateCrew,onBack}) {
  const [tab,setTab]=useState('jobs');
  const [newJobName,setNewJobName]=useState('');
  const addJob=()=>{ if(!newJobName.trim())return; onUpdateJobs([...jobs,{id:uid('job'),name:newJobName.trim(),status:'active',targetMargin:45,bidTotal:0,bidLaborHours:0,notes:''}]); setNewJobName(''); };
  const updJob=(id,p)=>onUpdateJobs(jobs.map(j=>j.id===id?{...j,...p}:j));
  const updStock=(id,p)=>onUpdateStock(stockItems.map(s=>s.id===id?{...s,...p}:s));
  const moveStock=(id,d)=>{ const i=stockItems.findIndex(s=>s.id===id),n=i+d; if(n<0||n>=stockItems.length)return; const a=[...stockItems];[a[i],a[n]]=[a[n],a[i]];onUpdateStock(a); };
  const updCrew=(id,p)=>onUpdateCrew(crew.map(c=>c.id===id?{...c,...p}:c));
  const moveCrew=(id,d)=>{ const i=crew.findIndex(c=>c.id===id),n=i+d; if(n<0||n>=crew.length)return; const a=[...crew];[a[i],a[n]]=[a[n],a[i]];onUpdateCrew(a); };

  return (
    <div style={styles.screen}>
      <div style={styles.entryTitle}>Settings</div>
      <div style={styles.tabRow}>
        {['jobs','crew','equipment','stock'].map(t=>(
          <button key={t} style={{...styles.tab,...(tab===t?styles.tabActive:{})}} onClick={()=>setTab(t)}>
            {t==='jobs'?'Jobs':t==='crew'?'Crew':t==='equipment'?'Equipment':'Stock'}
          </button>
        ))}
      </div>

      {tab==='jobs'&&<>
        {jobs.map(job=>(
          <Card key={job.id}>
            <input style={styles.textInputBig} value={job.name} onChange={e=>updJob(job.id,{name:e.target.value})}/>
            <div style={styles.settingsGrid}>
              <div><div style={styles.hourLabel}>Bid total</div><NumberInput value={job.bidTotal} onChange={v=>updJob(job.id,{bidTotal:v})} suffix="$"/></div>
              <div><div style={styles.hourLabel}>Target margin</div><NumberInput value={job.targetMargin} onChange={v=>updJob(job.id,{targetMargin:v})} suffix="%"/></div>
              <div><div style={styles.hourLabel}>Target labor hours</div><NumberInput value={job.bidLaborHours} onChange={v=>updJob(job.id,{bidLaborHours:v})} suffix="hrs"/></div>
              <div style={{gridColumn:'span 2'}}><div style={styles.hourLabel}>Notes (start date, gate code, client instructions...)</div><input style={{...styles.textInput,flex:'unset',width:'100%'}} value={job.notes||''} placeholder="e.g. Start 7/10 - gate code 1234 - call client daily" onChange={e=>updJob(job.id,{notes:e.target.value})}/></div>
              <div><div style={styles.hourLabel}>Status</div><select style={{...styles.select,flex:'unset',width:'100%'}} value={job.status} onChange={e=>{const s=e.target.value;updJob(job.id,{status:s,...(s==='complete'&&!job.completedAt?{completedAt:new Date().toISOString()}:{})});}}><option value="active">Active</option><option value="complete">Complete</option></select></div>
            </div>
          </Card>
        ))}
        <Card><FieldLabel>Add a job</FieldLabel><div style={{display:'flex',gap:8}}><input style={styles.textInput} placeholder="Client first and last name" value={newJobName} onChange={e=>setNewJobName(e.target.value)}/><button style={styles.btnPrimarySmall} onClick={addJob}>Add</button></div></Card>
      </>}

      {tab==='crew'&&<>
        {crew.map((m,i)=>(
          <Card key={m.id}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}><button style={styles.reorderBtn} onClick={()=>moveCrew(m.id,-1)} disabled={i===0}>^</button><button style={styles.reorderBtn} onClick={()=>moveCrew(m.id,1)} disabled={i===crew.length-1}>v</button></div>
              <input style={{...styles.textInputBig,flex:1,marginBottom:0}} value={m.name} onChange={e=>updCrew(m.id,{name:e.target.value})}/>
              <button style={styles.deleteBtnSmall} onClick={()=>onUpdateCrew(crew.filter(c=>c.id!==m.id))}><X size={15}/></button>
            </div>
            <div style={styles.settingsGrid}>
              <div><div style={styles.hourLabel}>Role</div><select style={{...styles.select,flex:'unset',width:'100%'}} value={m.role} onChange={e=>updCrew(m.id,{role:e.target.value})}><option>Team Leader</option><option>Foreman</option><option>Installer</option><option>Laborer</option></select></div>
              <div><div style={styles.hourLabel}>Burdened rate</div><NumberInput value={m.burdenedRate} onChange={v=>updCrew(m.id,{burdenedRate:Number(v)||0})} suffix="$/hr"/></div>
            </div>
          </Card>
        ))}
        <button style={styles.addChip} onClick={()=>onUpdateCrew([...crew,{id:uid('crew'),name:'New crew member',role:'Installer',burdenedRate:0}])}><Plus size={13}/> Add crew member</button>
        <div style={styles.hint}>Burdened rate = base wage x burden multiplier. OT at 1.5x after 8 hrs/day.</div>
      </>}

      {tab==='equipment'&&<>
        <div style={styles.sectionLabel}>EQUIPMENT</div>
        {equipment.map((eq,i)=>(
          <Card key={eq.id}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}><button style={styles.reorderBtn} onClick={()=>{const a=[...equipment];if(i>0){[a[i],a[i-1]]=[a[i-1],a[i]];onUpdateEquipment(a);}}} disabled={i===0}>^</button><button style={styles.reorderBtn} onClick={()=>{const a=[...equipment];if(i<a.length-1){[a[i],a[i+1]]=[a[i+1],a[i]];onUpdateEquipment(a);}}} disabled={i===equipment.length-1}>v</button></div>
              <input style={{...styles.textInputBig,flex:1,marginBottom:0}} value={eq.name} onChange={e=>onUpdateEquipment(equipment.map(x=>x.id===eq.id?{...x,name:e.target.value}:x))}/>
              <button style={styles.deleteBtnSmall} onClick={()=>onUpdateEquipment(equipment.filter(x=>x.id!==eq.id))}><X size={15}/></button>
            </div>
            <div style={styles.hourLabel}>Hourly cost</div>
            <NumberInput value={eq.hourlyCost} onChange={v=>onUpdateEquipment(equipment.map(x=>x.id===eq.id?{...x,hourlyCost:Number(v)||0}:x))} suffix="$/hr"/>
          </Card>
        ))}
        <button style={styles.addChip} onClick={()=>onUpdateEquipment([...equipment,{id:uid('eq'),name:'New equipment',hourlyCost:0}])}><Plus size={13}/> Add equipment</button>
        <div style={{...styles.sectionLabel,marginTop:20}}>TRUCKS</div>
        {trucks.map((tr,i)=>(
          <Card key={tr.id}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}><button style={styles.reorderBtn} onClick={()=>{const a=[...trucks];if(i>0){[a[i],a[i-1]]=[a[i-1],a[i]];onUpdateTrucks(a);}}} disabled={i===0}>^</button><button style={styles.reorderBtn} onClick={()=>{const a=[...trucks];if(i<a.length-1){[a[i],a[i+1]]=[a[i+1],a[i]];onUpdateTrucks(a);}}} disabled={i===trucks.length-1}>v</button></div>
              <input style={{...styles.textInputBig,flex:1,marginBottom:0}} value={tr.name} onChange={e=>onUpdateTrucks(trucks.map(x=>x.id===tr.id?{...x,name:e.target.value}:x))}/>
              <button style={styles.deleteBtnSmall} onClick={()=>onUpdateTrucks(trucks.filter(x=>x.id!==tr.id))}><X size={15}/></button>
            </div>
          </Card>
        ))}
        <button style={styles.addChip} onClick={()=>onUpdateTrucks([...trucks,{id:uid('truck'),name:'New Truck'}])}><Plus size={13}/> Add truck</button>

        <div style={{...styles.sectionLabel,marginTop:20}}>TRAILERS</div>
        {(trailers||[]).map((tr,i)=>(
          <Card key={tr.id}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <button style={styles.reorderBtn} onClick={()=>{const a=[...trailers];if(i>0){[a[i],a[i-1]]=[a[i-1],a[i]];onUpdateTrailers(a);}}} disabled={i===0}>^</button>
                <button style={styles.reorderBtn} onClick={()=>{const a=[...trailers];if(i<a.length-1){[a[i],a[i+1]]=[a[i+1],a[i]];onUpdateTrailers(a);}}} disabled={i===trailers.length-1}>v</button>
              </div>
              <input style={{...styles.textInputBig,flex:1,marginBottom:0}} value={tr.name} onChange={e=>onUpdateTrailers((trailers||[]).map(x=>x.id===tr.id?{...x,name:e.target.value}:x))}/>
              <button style={styles.deleteBtnSmall} onClick={()=>onUpdateTrailers((trailers||[]).filter(x=>x.id!==tr.id))}><X size={15}/></button>
            </div>
            <div style={styles.hourLabel}>Day rate (depreciation-based)</div>
            <NumberInput value={tr.dayRate} onChange={v=>onUpdateTrailers((trailers||[]).map(x=>x.id===tr.id?{...x,dayRate:Number(v)||0}:x))} suffix="$/day"/>
          </Card>
        ))}
        <button style={styles.addChip} onClick={()=>onUpdateTrailers([...(trailers||[]),{id:uid('trailer'),name:'New Trailer',dayRate:0}])}><Plus size={13}/> Add trailer</button>
        <div style={styles.hint}>Day rate = annual depreciation divided by deployment days/year.</div>

        <div style={{...styles.sectionLabel,marginTop:20}}>MILEAGE RATE</div>
        <Card><FieldLabel icon={Truck}>Cost per mile</FieldLabel><NumberInput value={rates.mileageRate} onChange={v=>onUpdateRates({...rates,mileageRate:Number(v)||0})} suffix="$/mile"/></Card>
      </>}

      {tab==='stock'&&<>
        {stockItems.map((item,i)=>(
          <Card key={item.id}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}><button style={styles.reorderBtn} onClick={()=>moveStock(item.id,-1)} disabled={i===0}>^</button><button style={styles.reorderBtn} onClick={()=>moveStock(item.id,1)} disabled={i===stockItems.length-1}>v</button></div>
              <input style={{...styles.textInputBig,flex:1,marginBottom:0}} value={item.name} onChange={e=>updStock(item.id,{name:e.target.value})}/>
              <button style={styles.deleteBtnSmall} onClick={()=>onUpdateStock(stockItems.filter(s=>s.id!==item.id))}><X size={15}/></button>
            </div>
            <div style={styles.settingsGrid}>
              <div><div style={styles.hourLabel}>Avg unit cost</div><NumberInput value={item.avgUnitCost} onChange={v=>updStock(item.id,{avgUnitCost:Number(v)||0})} suffix={`$/${item.unit}`}/></div>
              <div><div style={styles.hourLabel}>Unit</div><input style={{...styles.textInput,flex:'unset',width:'100%'}} value={item.unit} onChange={e=>updStock(item.id,{unit:e.target.value})}/></div>
            </div>
          </Card>
        ))}
        <button style={styles.addChip} onClick={()=>onUpdateStock([...stockItems,{id:uid('stock'),name:'New item',unit:'unit',avgUnitCost:0}])}><Plus size={13}/> Add stock item</button>
        <div style={styles.hint}>Use blended average costs - fine-tune periodically.</div>
      </>}

      <button style={{...styles.btnSecondary,marginTop:20,width:'100%'}} onClick={onBack}>Done</button>
    </div>
  );
}

// ---------- Styles ----------
const globalCSS=`* { box-sizing: border-box; } body { margin: 0; } input,select { font-family: inherit; } input:focus,select:focus { outline: none; border-color: #2f5d4a !important; } input::-webkit-outer-spin-button,input::-webkit-inner-spin-button { margin: 0; }`;
const COLORS={bg:'#f7f5f0',card:'#ffffff',ink:'#22301f',inkSoft:'#5c6b56',inkFaint:'#8a9a8e',border:'#e2e0d6',primary:'#2f5d4a',primaryDark:'#244a3b'};
const styles={
  app:{fontFamily:"'Source Sans Pro','Segoe UI',system-ui,sans-serif",background:COLORS.bg,minHeight:'100vh',color:COLORS.ink,maxWidth:480,margin:'0 auto',position:'relative'},
  loadingScreen:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:COLORS.bg,gap:8},
  loadingLogo:{fontFamily:"'Georgia',serif",fontWeight:700,fontSize:28,color:COLORS.primary},
  header:{background:COLORS.primaryDark,padding:'16px 18px',paddingTop:'calc(env(safe-area-inset-top, 0px) + 16px)',position:'sticky',top:0,zIndex:10},
  headerInner:{display:'flex',alignItems:'center',justifyContent:'space-between'},
  brandRow:{display:'flex',alignItems:'center',gap:10,cursor:'pointer'},
  brandMark:{width:38,height:38,borderRadius:8,background:'#ffffff15',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Georgia',serif",fontWeight:700,fontSize:14,color:'#fff'},
  brandTitle:{color:'#fff',fontWeight:700,fontSize:15,lineHeight:1.2},
  brandSub:{color:'#ffffff99',fontSize:11},
  headerBack:{background:'transparent',border:'none',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',padding:'6px 8px'},
  headerSettings:{background:'transparent',border:'none',color:'#ffffffcc',cursor:'pointer',padding:6},
  headerSignOut:{background:'transparent',border:'none',color:'#ffffff88',cursor:'pointer',padding:'6px 4px',fontSize:12,fontWeight:600},
  body:{padding:'18px 16px 40px'},
  screen:{display:'flex',flexDirection:'column'},
  sectionLabel:{fontSize:11,fontWeight:700,letterSpacing:'0.08em',color:COLORS.inkFaint,marginBottom:10,marginTop:4},
  emptyState:{color:COLORS.inkSoft,fontSize:14,padding:'20px 0'},
  jobCard:{background:COLORS.card,borderRadius:14,border:`1px solid ${COLORS.border}`,padding:16,display:'flex',flexDirection:'column',gap:12,marginBottom:14},
  jobCardTop:{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'},
  jobName:{fontWeight:700,fontSize:16.5,color:COLORS.ink},
  jobMeta:{fontSize:12.5,color:COLORS.inkFaint,marginTop:2},
  marginRow:{display:'flex',alignItems:'center',gap:10,cursor:'pointer'},
  marginBarTrack:{flex:1,height:6,borderRadius:3,background:'#ece9df',overflow:'hidden'},
  marginBarFill:{height:'100%',borderRadius:3,transition:'width 0.3s'},
  marginValue:{fontWeight:700,fontSize:13,minWidth:44,textAlign:'right'},
  jobActions:{display:'flex',gap:8},
  btnClockIn:{flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 8px',borderRadius:9,border:'none',background:COLORS.primary,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'},
  btnClockOut:{flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 8px',borderRadius:9,border:'none',background:'#c98a3a',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'},
  btnIcon:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'10px',borderRadius:9,border:`1px solid ${COLORS.border}`,background:'#fafaf7',color:COLORS.ink,cursor:'pointer'},
  completedCard:{background:COLORS.card,borderRadius:12,border:`1px solid ${COLORS.border}`,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',marginBottom:10},
  entryHeader:{display:'flex',alignItems:'center',gap:10,marginBottom:18},
  entryTitle:{fontWeight:700,fontSize:19,color:COLORS.ink},
  entrySub:{fontSize:12.5,color:COLORS.inkFaint,marginTop:2},
  card:{background:COLORS.card,borderRadius:14,border:`1px solid ${COLORS.border}`,padding:16,marginBottom:12},
  panelCard:{background:COLORS.card,borderRadius:14,border:`1px solid ${COLORS.border}`,marginBottom:10,overflow:'hidden'},
  panelHeader:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',cursor:'pointer'},
  panelTitle:{fontWeight:700,fontSize:14,color:COLORS.ink},
  panelSub:{fontSize:12,color:COLORS.inkFaint,marginTop:1},
  panelBody:{padding:'0 16px 16px',borderTop:`1px solid ${COLORS.border}`},
  matItem:{border:'1.5px solid',borderRadius:10,padding:10,marginBottom:8},
  matItemHeader:{display:'flex',alignItems:'flex-start',gap:8,cursor:'pointer'},
  logLine:{display:'flex',justifyContent:'space-between',fontSize:12.5,color:COLORS.inkSoft,padding:'5px 0',borderBottom:`1px solid #f0ede8`},
  fieldLabel:{display:'flex',alignItems:'center',fontSize:13,fontWeight:700,color:COLORS.ink,marginBottom:10},
  numberInputWrap:{position:'relative',flex:1},
  numberInput:{width:'100%',padding:'11px 12px',borderRadius:9,border:`1.5px solid ${COLORS.border}`,fontSize:15,fontWeight:600,color:COLORS.ink,background:'#fcfbf8'},
  numberSuffix:{display:'block',fontSize:10.5,color:COLORS.inkFaint,marginTop:4,fontWeight:500},
  hint:{fontSize:12,color:COLORS.inkFaint,marginTop:8,lineHeight:1.5},
  materialRow:{display:'flex',gap:8,alignItems:'flex-start',marginBottom:10},
  textInput:{flex:1.4,padding:'11px 12px',borderRadius:9,border:`1.5px solid ${COLORS.border}`,fontSize:14,color:COLORS.ink,background:'#fcfbf8'},
  textInputBig:{width:'100%',padding:'10px 0',border:'none',borderBottom:`2px solid ${COLORS.border}`,fontSize:17,fontWeight:700,color:COLORS.ink,marginBottom:14,background:'transparent'},
  timeInput:{width:'100%',padding:'11px 12px',borderRadius:9,border:`1.5px solid ${COLORS.border}`,fontSize:14,fontWeight:600,color:COLORS.ink,background:'#fcfbf8'},
  select:{flex:1.4,padding:'11px 8px',borderRadius:9,border:`1.5px solid ${COLORS.border}`,fontSize:13.5,color:COLORS.ink,background:'#fcfbf8'},
  removeBtn:{background:'transparent',border:'none',color:COLORS.inkFaint,cursor:'pointer',padding:8,flexShrink:0},
  addChip:{display:'flex',alignItems:'center',gap:5,padding:'8px 12px',borderRadius:20,border:`1.5px dashed ${COLORS.border}`,background:'transparent',color:COLORS.primary,fontSize:12.5,fontWeight:600,cursor:'pointer'},
  hourGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
  hourLabel:{fontSize:11.5,color:COLORS.inkSoft,fontWeight:600,marginBottom:5},
  crewSelectRow:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius:10,border:'1.5px solid',cursor:'pointer',marginBottom:8},
  bottomBar:{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,display:'flex',gap:10,padding:'14px 16px',background:COLORS.bg,borderTop:`1px solid ${COLORS.border}`},
  btnSecondary:{flex:1,padding:'13px 0',borderRadius:10,border:`1.5px solid ${COLORS.border}`,background:'#fff',color:COLORS.ink,fontSize:14.5,fontWeight:700,cursor:'pointer'},
  btnPrimary:{flex:2,padding:'13px 0',borderRadius:10,border:'none',background:COLORS.primary,color:'#fff',fontSize:14.5,fontWeight:700,cursor:'pointer'},
  btnPrimarySmall:{padding:'10px 16px',borderRadius:9,border:'none',background:COLORS.primary,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'},
  toast:{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:COLORS.ink,color:'#fff',padding:'10px 18px',borderRadius:30,fontSize:13.5,fontWeight:600,display:'flex',alignItems:'center',boxShadow:'0 6px 20px rgba(0,0,0,0.2)',zIndex:20},
  marginHero:{background:`linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primary})`,borderRadius:16,padding:'24px 20px',textAlign:'center',marginBottom:14},
  marginHeroLabel:{color:'#ffffff99',fontSize:11,fontWeight:700,letterSpacing:'0.08em',marginBottom:6},
  marginHeroValue:{fontSize:44,fontWeight:800,lineHeight:1,fontFamily:"'Georgia',serif"},
  marginHeroSub:{color:'#ffffffcc',fontSize:13,marginTop:8,fontWeight:500},
  warningBanner:{display:'flex',alignItems:'center',background:'#fdf0e8',color:'#9c4a26',padding:'12px 14px',borderRadius:10,fontSize:13,fontWeight:500,marginBottom:14,lineHeight:1.4},
  detailGrid:{display:'flex',flexDirection:'column'},
  detailRow:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'9px 0'},
  detailRowLeft:{flex:1},
  detailLabel:{fontSize:14,color:COLORS.ink},
  detailSub:{fontSize:11.5,color:COLORS.inkFaint,marginTop:2},
  detailValue:{fontSize:14,color:COLORS.ink,textAlign:'right',whiteSpace:'nowrap',marginLeft:12},
  divider:{height:1,background:COLORS.border,margin:'6px 0'},
  logEntry:{display:'flex',alignItems:'center',gap:10,background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:10,padding:'11px 13px'},
  logEntryTitle:{fontSize:13.5,fontWeight:600,color:COLORS.ink},
  logEntrySub:{fontSize:12,color:COLORS.inkFaint,marginTop:1},
  markCompleteBtn:{marginTop:16,width:'100%',padding:'13px 0',borderRadius:10,border:`1.5px solid ${COLORS.primary}`,background:'transparent',color:COLORS.primary,fontSize:14,fontWeight:700,cursor:'pointer'},
  deleteJobBtn:{marginTop:12,width:'100%',padding:'10px 0',background:'transparent',border:'none',color:'#b8502f',fontSize:14,fontWeight:600,cursor:'pointer',textDecoration:'underline'},
  tabRow:{display:'flex',gap:6,marginBottom:16,marginTop:12},
  tab:{flex:1,padding:'9px 4px',borderRadius:8,border:`1px solid ${COLORS.border}`,background:'#fff',color:COLORS.inkSoft,fontSize:12.5,fontWeight:600,cursor:'pointer'},
  tabActive:{background:COLORS.primary,color:'#fff',border:`1px solid ${COLORS.primary}`},
  settingsGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12},
  reorderBtn:{background:'transparent',border:`1px solid #e2e0d6`,borderRadius:4,color:'#8a9a8e',cursor:'pointer',padding:'1px 5px',fontSize:10,lineHeight:1.4,display:'block'},
  deleteBtnSmall:{background:'transparent',border:`1.5px solid #f0d8d3`,borderRadius:8,color:'#b8502f',cursor:'pointer',padding:'6px 8px',flexShrink:0},
  qtyTicker:{display:'flex',alignItems:'center',borderRadius:9,border:`1.5px solid #e2e0d6`,overflow:'hidden',background:'#fcfbf8'},
  qtyBtn:{background:'transparent',border:'none',color:'#2f5d4a',fontWeight:700,fontSize:16,cursor:'pointer',padding:'0 10px',height:40,lineHeight:1,flexShrink:0},
  qtyInput:{width:32,border:'none',background:'transparent',textAlign:'center',fontSize:14,fontWeight:700,color:'#22301f',padding:0},
};
