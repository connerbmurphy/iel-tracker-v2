import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { hoursFromPunch, weekStr, monthStr, fmtMoney2, todayStr, downloadCSV } from '../utils/helpers';
import { Card, S, C, SectionLabel, Hint } from '../components/UI';
import ManagerPinGate from '../components/ManagerPin';

export default function ReportsScreen() {
  return (
    <ManagerPinGate>
      <ReportsContent />
    </ManagerPinGate>
  );
}

function ReportsContent() {
  const { punches, employees, jobs, bonusCalcs } = useApp();
  const [selectedWeek, setSelectedWeek] = useState(weekStr(todayStr()));
  const [selectedMonth, setSelectedMonth] = useState(monthStr(todayStr()));

  // Build list of available weeks from punches
  const weeks = [...new Set(punches.filter(p=>p.clockIn&&p.clockOut).map(p=>weekStr(p.date)))].sort().reverse();
  const months = [...new Set(punches.filter(p=>p.clockIn&&p.clockOut).map(p=>monthStr(p.date)))].sort().reverse();

  // Weekly punch data for selected week
  const weekPunches = punches.filter(p => p.clockIn && p.clockOut && weekStr(p.date) === selectedWeek);
  const monthPunches = punches.filter(p => p.clockIn && p.clockOut && monthStr(p.date) === selectedMonth);

  // Monthly bonus for selected month
  const monthBonuses = bonusCalcs.filter(b => {
    const job = jobs.find(j => j.id === b.jobId);
    return job && monthStr(b.savedAt?.slice(0,10) || todayStr()) === selectedMonth;
  });

  const getHrs = (p) => p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
  const getJob = (jobId) => jobs.find(j => j.id === jobId)?.name || jobId;
  const getEmp = (crewId) => employees.find(e => e.id === crewId);

  // Export weekly CSV
  const exportWeekly = () => {
    const header = 'Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Total_Hours,Job_Name\n';
    const rows = weekPunches.map(p => {
      const emp = getEmp(p.crewId);
      const hrs = getHrs(p);
      return `${emp?.employeeId||''},${emp?.name||''},${p.date},${p.clockIn||''},${p.clockOut||''},${hrs.toFixed(2)},${getJob(p.jobId)}`;
    }).join('\n');
    downloadCSV(`IEL_Weekly_Payroll_${selectedWeek}.csv`, header+rows);
  };

  // Export monthly CSV (hours + bonuses)
  const exportMonthly = () => {
    let content = `IEL Monthly Report - ${selectedMonth}\n\n`;

    // Hours section
    content += 'HOURS LOG\n';
    content += 'Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Total_Hours,Job_Name\n';
    monthPunches.forEach(p => {
      const emp = getEmp(p.crewId);
      const hrs = getHrs(p);
      content += `${emp?.employeeId||''},${emp?.name||''},${p.date},${p.clockIn||''},${p.clockOut||''},${hrs.toFixed(2)},${getJob(p.jobId)}\n`;
    });

    // Monthly hours summary per employee
    content += '\nMONTHLY HOURS SUMMARY\n';
    content += 'Employee_ID,Employee_Name,Total_Hours\n';
    employees.forEach(emp => {
      const hrs = monthPunches.filter(p=>p.crewId===emp.id).reduce((s,p)=>s+getHrs(p),0);
      if (hrs > 0) content += `${emp.employeeId},${emp.name},${hrs.toFixed(2)}\n`;
    });

    // Bonus section
    if (monthBonuses.length > 0) {
      content += '\nBONUS CALCULATIONS\n';
      content += 'Job,Employee_ID,Employee_Name,Final_Points,Share_%,Payout\n';
      monthBonuses.forEach(b => {
        const jobName = getJob(b.jobId);
        (b.perEmployee||[]).forEach(pe => {
          const emp = getEmp(pe.employeeId);
          content += `${jobName},${emp?.employeeId||''},${pe.name||''},${(pe.finalPoints||0).toFixed(1)},${(pe.sharePercent||0).toFixed(1)}%,${fmtMoney2(pe.payout||0)}\n`;
        });
      });

      content += '\nBONUS TOTALS PER EMPLOYEE\n';
      content += 'Employee_ID,Employee_Name,Total_Bonus\n';
      employees.forEach(emp => {
        let total = 0;
        monthBonuses.forEach(b => {
          const pe = (b.perEmployee||[]).find(p=>p.employeeId===emp.id);
          if (pe) total += pe.payout||0;
        });
        if (total > 0) content += `${emp.employeeId},${emp.name},${fmtMoney2(total)}\n`;
      });
    }

    downloadCSV(`IEL_Monthly_Report_${selectedMonth}.csv`, content);
  };

  // Export YTD CSV
  const exportYTD = () => {
    const allPunches = punches.filter(p=>p.clockIn&&p.clockOut);
    let content = 'IEL Year-to-Date Report\n\n';
    content += 'ALL PUNCH RECORDS\n';
    content += 'Employee_ID,Employee_Name,Date,Clock_In,Clock_Out,Total_Hours,Job_Name\n';
    allPunches.sort((a,b)=>a.date.localeCompare(b.date)).forEach(p => {
      const emp = getEmp(p.crewId);
      content += `${emp?.employeeId||''},${emp?.name||''},${p.date},${p.clockIn||''},${p.clockOut||''},${getHrs(p).toFixed(2)},${getJob(p.jobId)}\n`;
    });

    content += '\nYTD HOURS PER EMPLOYEE\n';
    content += 'Employee_ID,Employee_Name,Total_Hours\n';
    employees.forEach(emp => {
      const hrs = allPunches.filter(p=>p.crewId===emp.id).reduce((s,p)=>s+getHrs(p),0);
      content += `${emp.employeeId},${emp.name},${hrs.toFixed(2)}\n`;
    });

    downloadCSV(`IEL_YTD_Report.csv`, content);
  };

  return (
    <div style={S.screen}>
      <div style={{ fontWeight:700, fontSize:19, marginBottom:16 }}>Reports & Export</div>

      <SectionLabel>WEEKLY PAYROLL</SectionLabel>
      <Card>
        <div style={S.hourLabel}>Select week</div>
        <select style={{ ...S.select, flex:'unset', width:'100%', marginBottom:12 }} value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)}>
          {weeks.length === 0 && <option>No data yet</option>}
          {weeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <div style={{ fontSize:13, color:C.inkSoft, marginBottom:12 }}>
          {weekPunches.length} punch records for {selectedWeek}
        </div>
        {weekPunches.length > 0 && (
          <div style={{ marginBottom:12 }}>
            {employees.map(emp => {
              const hrs = weekPunches.filter(p=>p.crewId===emp.id).reduce((s,p)=>s+getHrs(p),0);
              if (!hrs) return null;
              return <div key={emp.id} style={S.logLine}><span>{emp.name}</span><span style={{ fontWeight:600 }}>{hrs.toFixed(2)} hrs</span></div>;
            })}
          </div>
        )}
        <button style={{ ...S.btnPrimary, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }} onClick={exportWeekly}>
          <Download size={16} /> Export weekly CSV
        </button>
      </Card>

      <SectionLabel>MONTHLY REPORT (WC + BONUS)</SectionLabel>
      <Card>
        <div style={S.hourLabel}>Select month</div>
        <select style={{ ...S.select, flex:'unset', width:'100%', marginBottom:12 }} value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>
          {months.length === 0 && <option>No data yet</option>}
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ fontSize:13, color:C.inkSoft, marginBottom:12 }}>
          {monthPunches.length} punch records - {monthBonuses.length} bonus calc{monthBonuses.length!==1?'s':''}
        </div>
        {employees.map(emp => {
          const hrs = monthPunches.filter(p=>p.crewId===emp.id).reduce((s,p)=>s+getHrs(p),0);
          let bonus = 0;
          monthBonuses.forEach(b => { const pe=(b.perEmployee||[]).find(p=>p.employeeId===emp.id); if(pe) bonus+=pe.payout||0; });
          if (!hrs && !bonus) return null;
          return <div key={emp.id} style={S.logLine}><span>{emp.name}</span><span style={{ fontSize:12 }}>{hrs.toFixed(2)} hrs{bonus>0?` + ${fmtMoney2(bonus)} bonus`:''}</span></div>;
        })}
        <button style={{ ...S.btnPrimary, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12 }} onClick={exportMonthly}>
          <Download size={16} /> Export monthly CSV
        </button>
      </Card>

      <SectionLabel>YEAR-TO-DATE</SectionLabel>
      <Card>
        <div style={{ fontSize:13, color:C.inkSoft, marginBottom:12 }}>
          Full audit trail - all employees, all punches, all records.
        </div>
        {employees.map(emp => {
          const hrs = punches.filter(p=>p.crewId===emp.id&&p.clockIn&&p.clockOut).reduce((s,p)=>s+getHrs(p),0);
          if (!hrs) return null;
          return <div key={emp.id} style={S.logLine}><span>{emp.name} ({emp.employeeId})</span><span style={{ fontWeight:600 }}>{hrs.toFixed(2)} hrs YTD</span></div>;
        })}
        <button style={{ ...S.btnPrimary, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12 }} onClick={exportYTD}>
          <Download size={16} /> Export YTD CSV
        </button>
      </Card>
    </div>
  );
}
