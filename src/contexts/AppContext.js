import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fsSet, fsLoadAll } from '../db';
import { uid } from '../utils/helpers';

const EMPTY = {
  jobs:[],punches:[],plantsRec:{},materialsRec:{},
  equipmentLog:[],truckLog:[],trailerLog:[],
  rates:{mileageRate:0.80},
  equipment:[],trucks:[],trailers:[],stockItems:[],
  employees:[],scorecards:[],bonusCalcs:[],
  settings:{managerPin:'',csr:''},
  managerUnlocked:false,accountId:null,actions:{}
};
const AppContext = createContext(EMPTY);
export const useApp = () => useContext(AppContext);

const DEFAULTS = {
  jobs: [],
  punches: [],
  plantsRec: {},
  materialsRec: {},
  equipmentLog: [],
  truckLog: [],
  trailerLog: [],
  rates: { mileageRate: 0.80 },
  equipment: [
    { id: 'eq_excavator', name: 'Mini Excavator', hourlyCost: 35 },
    { id: 'eq_tractor', name: 'Compact Tractor', hourlyCost: 22 },
  ],
  trucks: [
    { id: 'truck_1', name: 'Main Truck' },
    { id: 'truck_2', name: 'Second Truck' },
  ],
  trailers: [
    { id: 'trailer_1', name: '7x16 Enclosed', dayRate: 13.16 },
    { id: 'trailer_2', name: '20ft Flatbed', dayRate: 13.16 },
    { id: 'trailer_3', name: 'Dump Trailer', dayRate: 24.36 },
  ],
  stockItems: [
    { id: 'si_1', name: '1" PVC CL200', unit: 'ft', avgUnitCost: 0.45 },
    { id: 'si_2', name: '1" PVC SCH40', unit: 'ft', avgUnitCost: 1.12 },
    { id: 'si_3', name: '1" PVC Fittings', unit: 'unit', avgUnitCost: 0.90 },
    { id: 'si_4', name: 'Solenoid Valve 1"', unit: 'unit', avgUnitCost: 18.00 },
    { id: 'si_5', name: 'Hunter NODE-100', unit: 'unit', avgUnitCost: 175.00 },
    { id: 'si_6', name: '1/2" Drip Tubing (brown)', unit: 'ft', avgUnitCost: 0.63 },
    { id: 'si_7', name: '1" Black Poly Tubing', unit: 'ft', avgUnitCost: 0.32 },
    { id: 'si_8', name: 'Spot Spitters', unit: 'unit', avgUnitCost: 0.28 },
    { id: 'si_9', name: '1/4" Leash Tubing', unit: 'ft', avgUnitCost: 0.07 },
    { id: 'si_10', name: 'DeWitt Fabric 6ft', unit: 'lin ft', avgUnitCost: 0.85 },
    { id: 'si_11', name: 'DeWitt Fabric 12ft', unit: 'lin ft', avgUnitCost: 1.65 },
    { id: 'si_12', name: 'Landscape Staples', unit: 'unit', avgUnitCost: 0.146 },
    { id: 'si_13', name: 'Harmony 5-4-3', unit: '40lb bag', avgUnitCost: 25.21 },
    { id: 'si_14', name: 'Azomite', unit: '44lb bag', avgUnitCost: 34.76 },
    { id: 'si_15', name: 'Mirimichi Green Biochar', unit: '40lb bag', avgUnitCost: 35.00 },
  ],
  employees: [],
  scorecards: [],
  bonusCalcs: [],
  settings: { managerPin: '', csr: '' },
};

const KEYS = Object.keys(DEFAULTS);

export function AppProvider({ accountId, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [managerUnlocked, setManagerUnlocked] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      const raw = await fsLoadAll(accountId);
      const merged = {};
      KEYS.forEach(k => { merged[k] = raw[k] ?? DEFAULTS[k]; });

      // Migrate old v1 crew array to employees if needed
      if ((!merged.employees || merged.employees.length === 0) && raw['crew'] && raw['crew'].length > 0) {
        merged.employees = raw['crew'].map((c, i) => ({
          id: c.id || `emp_migrated_${i}`,
          name: c.name || 'Unknown',
          employeeId: `IEL-${String(i+1).padStart(3,'0')}`,
          role: c.role === 'Team Leader' ? 'Lead' : (c.role || 'Install Tech'),
          status: c.role === 'Team Leader' ? 'Active' : (c.status || 'Experienced'),
          hireDate: '',
          burdenedRate: Number(c.burdenedRate) || 0,
        }));
      }

      // Ensure correct types
      if (!Array.isArray(merged.employees)) merged.employees = [];
      if (!Array.isArray(merged.punches)) merged.punches = [];
      if (!Array.isArray(merged.jobs)) merged.jobs = [];
      if (!Array.isArray(merged.equipmentLog)) merged.equipmentLog = [];
      if (!Array.isArray(merged.truckLog)) merged.truckLog = [];
      if (!Array.isArray(merged.trailerLog)) merged.trailerLog = [];
      if (!Array.isArray(merged.scorecards)) merged.scorecards = [];
      if (!Array.isArray(merged.bonusCalcs)) merged.bonusCalcs = [];
      if (typeof merged.plantsRec !== 'object' || Array.isArray(merged.plantsRec)) merged.plantsRec = {};
      if (typeof merged.materialsRec !== 'object' || Array.isArray(merged.materialsRec)) merged.materialsRec = {};

      setData(merged);
      setLoading(false);
    })();
  }, [accountId]);

  const save = useCallback(async (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
    await fsSet(accountId, key, value);
  }, [accountId]);

  const saveJobs = useCallback(v => save('jobs', v), [save]);
  const savePunches = useCallback(v => save('punches', v), [save]);
  const savePlantsRec = useCallback(v => save('plantsRec', v), [save]);
  const saveMaterialsRec = useCallback(v => save('materialsRec', v), [save]);
  const saveEquipmentLog = useCallback(v => save('equipmentLog', v), [save]);
  const saveTruckLog = useCallback(v => save('truckLog', v), [save]);
  const saveTrailerLog = useCallback(v => save('trailerLog', v), [save]);
  const saveRates = useCallback(v => save('rates', v), [save]);
  const saveEquipment = useCallback(v => save('equipment', v), [save]);
  const saveTrucks = useCallback(v => save('trucks', v), [save]);
  const saveTrailers = useCallback(v => save('trailers', v), [save]);
  const saveStockItems = useCallback(v => save('stockItems', v), [save]);
  const saveEmployees = useCallback(v => save('employees', v), [save]);
  const saveScorecards = useCallback(v => save('scorecards', v), [save]);
  const saveBonusCalcs = useCallback(v => save('bonusCalcs', v), [save]);
  const saveSettings = useCallback(v => save('settings', v), [save]);

  const actions = !data ? {} : {
    addJob: async (job) => { await saveJobs([...(data.jobs||[]), { ...job, id: uid('job') }]); },
    updateJob: async (updated) => { await saveJobs((data.jobs||[]).map(j => j.id === updated.id ? updated : j)); },
    deleteJob: async (jobId) => {
      await saveJobs((data.jobs||[]).filter(j => j.id !== jobId));
      await savePunches((data.punches||[]).filter(p => p.jobId !== jobId));
      const { [jobId]: _p, ...rp } = (data.plantsRec||{}); await savePlantsRec(rp);
      const { [jobId]: _m, ...rm } = (data.materialsRec||{}); await saveMaterialsRec(rm);
      await saveEquipmentLog((data.equipmentLog||[]).filter(e => e.jobId !== jobId));
      await saveTruckLog((data.truckLog||[]).filter(t => t.jobId !== jobId));
      await saveTrailerLog((data.trailerLog||[]).filter(t => t.jobId !== jobId));
    },
    addPunchBatch: async (newPunches) => {
      await savePunches([...(data.punches||[]), ...newPunches.map(p => ({ ...p, id: uid('punch') }))]);
    },
    clockOutBatch: async (updates) => {
      let next = [...(data.punches||[])];
      updates.forEach(({ id, ...patch }) => { next = next.map(p => p.id === id ? { ...p, ...patch } : p); });
      await savePunches(next);
    },
    updatePunch: async (id, patch) => { await savePunches((data.punches||[]).map(p => p.id === id ? { ...p, ...patch } : p)); },
    deletePunch: async (id) => { await savePunches((data.punches||[]).filter(p => p.id !== id)); },
    updatePlants: async (jobId, rec) => { await savePlantsRec({ ...(data.plantsRec||{}), [jobId]: rec }); },
    updateMaterials: async (jobId, rec) => { await saveMaterialsRec({ ...(data.materialsRec||{}), [jobId]: rec }); },
    addEquipmentEntry: async (e) => { await saveEquipmentLog([...(data.equipmentLog||[]), { ...e, id: uid('eq') }]); },
    deleteEquipmentEntry: async (id) => { await saveEquipmentLog((data.equipmentLog||[]).filter(e => e.id !== id)); },
    addTruckEntry: async (t) => { await saveTruckLog([...(data.truckLog||[]), { ...t, id: uid('tr') }]); },
    deleteTruckEntry: async (id) => { await saveTruckLog((data.truckLog||[]).filter(t => t.id !== id)); },
    addTrailerEntry: async (t) => { await saveTrailerLog([...(data.trailerLog||[]), { ...t, id: uid('trl') }]); },
    deleteTrailerEntry: async (id) => { await saveTrailerLog((data.trailerLog||[]).filter(t => t.id !== id)); },
    addEmployee: async (emp) => { await saveEmployees([...(data.employees||[]), { ...emp, id: uid('emp') }]); },
    updateEmployee: async (updated) => { await saveEmployees((data.employees||[]).map(e => e.id === updated.id ? updated : e)); },
    deleteEmployee: async (id) => { await saveEmployees((data.employees||[]).filter(e => e.id !== id)); },
    saveScorecard: async (sc) => {
      const existing = (data.scorecards||[]).find(s => s.jobId === sc.jobId && s.employeeId === sc.employeeId);
      if (existing) {
        await saveScorecards((data.scorecards||[]).map(s => (s.jobId===sc.jobId&&s.employeeId===sc.employeeId) ? {...s,...sc} : s));
      } else {
        await saveScorecards([...(data.scorecards||[]), { ...sc, id: uid('sc') }]);
      }
    },
    saveBonusCalc: async (calc) => {
      const existing = (data.bonusCalcs||[]).find(b => b.jobId === calc.jobId);
      if (existing) {
        await saveBonusCalcs((data.bonusCalcs||[]).map(b => b.jobId===calc.jobId ? {...b,...calc} : b));
      } else {
        await saveBonusCalcs([...(data.bonusCalcs||[]), { ...calc, id: uid('bc') }]);
      }
    },
    unlockManager: (pin) => {
      if (data && pin === data.settings.managerPin) { setManagerUnlocked(true); return true; }
      return false;
    },
    lockManager: () => setManagerUnlocked(false),
    saveSettings,
    saveRates, saveEquipment, saveTrucks, saveTrailers, saveStockItems, saveEmployees,
  };

  if (loading || !data) return (
    <div style={{ minHeight:'100vh', background:'#f7f5f0', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, fontFamily:'sans-serif' }}>
      <div style={{ width:48, height:48, borderRadius:12, background:'#244a3b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontWeight:700, fontSize:18, color:'#fff' }}>IEL</div>
      <div style={{ color:'#8a9a8e', fontSize:13 }}>Loading...</div>
    </div>
  );

  return (
    <AppContext.Provider value={{ ...data, managerUnlocked, accountId, actions }}>
      {children}
    </AppContext.Provider>
  );
}
