import { hoursFromPunch, calcPersonLaborCost } from './helpers';

export function materialItemCost(item, stockItems) {
  if (!item || item.isReturn) return 0;
  if (item.type === 'purchase') return Number(item.receiptAmount) || 0;
  if (item.type === 'stockDraw') {
    const si = (stockItems||[]).find(s => s && s.id === item.stockItemId);
    return (si ? si.avgUnitCost : 0) * (Number(item.qty) || 0);
  }
  return 0;
}

export function materialReturnCredit(item, stockItems) {
  if (!item || !item.isReturn) return 0;
  if (item.type === 'purchase') return Number(item.receiptAmount) || 0;
  if (item.type === 'stockDraw') {
    const si = (stockItems||[]).find(s => s && s.id === item.stockItemId);
    return (si ? si.avgUnitCost : 0) * (Number(item.qty) || 0);
  }
  return 0;
}

export function computeEmployeeHours(jobId, punches) {
  const safe = punches || [];
  const jobPunches = safe.filter(p => p && p.jobId === jobId && p.clockIn && p.clockOut);
  const byEmployee = {};
  jobPunches.forEach(p => {
    const hrs = p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
    if (!byEmployee[p.crewId]) byEmployee[p.crewId] = 0;
    byEmployee[p.crewId] += hrs;
  });
  return byEmployee;
}

export function computeTotalJobHours(jobId, punches) {
  const byEmp = computeEmployeeHours(jobId, punches || []);
  const vals = Object.values(byEmp);
  return vals.length > 0 ? Math.max(...vals) : 0;
}

export function computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, employees) {
  if (!job) return {
    laborHours:0, laborOTHours:0, laborCost:0,
    totalPlantQty:0, plantCost:0, materialsCost:0,
    equipmentHours:{}, equipmentCost:0,
    truckMiles:{}, truckCost:0,
    trailerDays:{}, trailerCost:0,
    totalCOGS:0, revenue:0, grossProfit:0, margin:0,
    targetMargin:45, fev:false, fevValue:0, bonusPool:0, csrBonus:0,
    activePunches:[], empHours:{}, maxHours:0, attendanceFractions:{}, entryCount:0,
  };

  const safeEmployees = employees || [];
  const safePunches = punches || [];
  const safeEquipmentLog = equipmentLog || [];
  const safeTruckLog = truckLog || [];
  const safeTrailerLog = trailerLog || [];
  const safeEquipment = equipment || [];
  const safeTrucks = trucks || [];
  const safeTrailers = trailers || [];
  const safeStockItems = stockItems || [];
  const safeRates = rates || { mileageRate: 0.80 };

  const jobPunches = safePunches.filter(p => p && p.jobId === job.id);

  // Labor
  let laborHours = 0, laborCost = 0, laborOTHours = 0;
  jobPunches.filter(p => p.clockIn && p.clockOut).forEach(p => {
    const emp = safeEmployees.find(e => e && e.id === p.crewId);
    const rate = emp ? (emp.burdenedRate || 0) : 0;
    const hrs = p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
    const ot = Math.max(0, hrs - 8);
    laborHours += hrs;
    laborOTHours += ot;
    laborCost += calcPersonLaborCost(hrs, rate);
  });

  // Plants
  const pr = (plantsRec || {})[job.id] || {};
  const plantItems = pr.items || [];
  const totalPlantQty = plantItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const plantCost = Number(pr.totalCost) || 0;

  // Materials
  const mr = (materialsRec || {})[job.id] || { items: [], miscExpenses: [] };
  let materialsCost = 0;
  (mr.items || []).forEach(item => {
    materialsCost += materialItemCost(item, safeStockItems);
    materialsCost -= materialReturnCredit(item, safeStockItems);
  });
  (mr.miscExpenses || []).forEach(e => { materialsCost += Number(e.amount) || 0; });
  materialsCost = Math.max(0, materialsCost);

  // Equipment
  let equipmentHours = {}, equipmentCost = 0;
  safeEquipmentLog.filter(e => e && e.jobId === job.id).forEach(e => {
    const hrs = Math.max(0, (Number(e.endMeter) || 0) - (Number(e.startMeter) || 0));
    equipmentHours[e.equipmentId] = (equipmentHours[e.equipmentId] || 0) + hrs;
    const ei = safeEquipment.find(x => x && x.id === e.equipmentId);
    equipmentCost += hrs * (ei ? ei.hourlyCost : 0);
  });

  // Trucks
  let truckMiles = {}, truckCost = 0;
  safeTruckLog.filter(t => t && t.jobId === job.id).forEach(t => {
    const miles = Number(t.miles) || 0;
    truckMiles[t.truckId] = (truckMiles[t.truckId] || 0) + miles;
    truckCost += miles * (safeRates.mileageRate || 0);
  });

  // Trailers
  let trailerDays = {}, trailerCost = 0;
  safeTrailerLog.filter(t => t && t.jobId === job.id).forEach(t => {
    const days = Number(t.days) || 0;
    trailerDays[t.trailerId] = (trailerDays[t.trailerId] || 0) + days;
    const ti = safeTrailers.find(x => x && x.id === t.trailerId);
    trailerCost += days * (ti ? ti.dayRate : 0);
  });

  const totalCOGS = laborCost + plantCost + materialsCost + equipmentCost + truckCost + trailerCost;
  const revenue = Number(job.bidTotal) || 0;
  const grossProfit = revenue - totalCOGS;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const targetMargin = job.targetMargin || 45;
  const fev = margin >= targetMargin;

  const fevPct = Math.max(0, margin - targetMargin) / 100;
  const fevValue = revenue * fevPct;
  const bonusPool = fevValue * 0.5;
  const csrBonus = fevValue * 0.05;

  const activePunches = jobPunches.filter(p => p.clockIn && !p.clockOut);

  const empHours = computeEmployeeHours(job.id, safePunches);
  const maxHours = Object.values(empHours).length > 0 ? Math.max(...Object.values(empHours)) : 0;
  const attendanceFractions = {};
  Object.entries(empHours).forEach(([eid, hrs]) => {
    attendanceFractions[eid] = maxHours > 0 ? hrs / maxHours : 0;
  });

  return {
    laborHours, laborOTHours, laborCost,
    totalPlantQty, plantCost,
    materialsCost, equipmentHours, equipmentCost,
    truckMiles, truckCost, trailerDays, trailerCost,
    totalCOGS, revenue, grossProfit, margin, targetMargin, fev,
    fevValue, bonusPool, csrBonus,
    activePunches, empHours, maxHours, attendanceFractions,
    entryCount: jobPunches.length,
  };
}
