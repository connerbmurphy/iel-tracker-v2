import React from 'react';
import { ChevronRight, LogIn, LogOut, Sprout, Package } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { computeJobCosts } from '../utils/costing';
import { fmtMoney, nowTimeStr } from '../utils/helpers';
import { C, S, SectionLabel } from '../components/UI';

export default function HomeScreen({ onNav }) {
  const app = useApp();
  const { jobs, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog,
          rates, equipment, trucks, trailers, stockItems, employees, actions } = app;

  const active = jobs.filter(j => j.status === 'active');
  const completed = jobs.filter(j => j.status === 'complete');

  return (
    <div style={S.screen}>
      <SectionLabel>ACTIVE JOBS - {active.length}</SectionLabel>
      {active.length === 0 && (
        <div style={{ color:C.inkSoft, fontSize:14, padding:'20px 0' }}>
          No active jobs. Add one in <span style={{ color:C.primary, fontWeight:600, cursor:'pointer' }} onClick={() => onNav('settings')}>Settings</span>.
        </div>
      )}
      {active.map(job => {
        const c = computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, employees);
        const hasData = c.laborHours > 0 || c.plantCost > 0 || c.materialsCost > 0;
        return (
          <div key={job.id} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:16, display:'flex', flexDirection:'column', gap:12, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }} onClick={() => onNav('jobDetail', job.id)}>
              <div>
                <div style={{ fontWeight:700, fontSize:16.5, color:C.ink }}>{job.name}</div>
                <div style={{ fontSize:12.5, color:C.inkFaint, marginTop:2 }}>
                  {c.activePunches.length > 0
                    ? <span style={{ color:C.gold, fontWeight:600 }}>* {c.activePunches.length} clocked in</span>
                    : hasData ? `${c.laborHours.toFixed(1)} labor hrs - ${fmtMoney(c.totalCOGS)} COGS` : 'No data yet'}
                </div>
              </div>
              <ChevronRight size={18} color="#a8b5ac" />
            </div>
            {hasData && (
              <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => onNav('jobDetail', job.id)}>
                <div style={{ flex:1, height:6, borderRadius:3, background:'#ece9df', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, transition:'width 0.3s', width:`${Math.min(100,Math.max(0,c.margin))}%`, background: c.margin>=job.targetMargin ? '#3f7d5c' : c.margin>=job.targetMargin-5 ? '#c98a3a' : '#b8502f' }} />
                </div>
                <div style={{ fontWeight:700, fontSize:13, minWidth:44, textAlign:'right', color: c.margin>=job.targetMargin ? '#3f7d5c' : c.margin>=job.targetMargin-5 ? '#c98a3a' : '#b8502f' }}>
                  {c.margin.toFixed(1)}%
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 8px', borderRadius:9, border:'none', background:C.primary, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
                onClick={() => onNav('clockIn', job.id)}>
                <LogIn size={14} /> Clock in
              </button>
              {c.activePunches.length > 0 && (
                <button style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 8px', borderRadius:9, border:'none', background:C.gold, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
                  onClick={() => onNav('clockOut', job.id)}>
                  <LogOut size={14} /> Clock out
                </button>
              )}
              <button style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:10, borderRadius:9, border:`1px solid ${C.border}`, background:'#fafaf7', color:C.ink, cursor:'pointer' }}
                title="Plants & load-out" onClick={() => onNav('jobDetail', job.id)}>
                <Sprout size={15} />
              </button>
              <button style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:10, borderRadius:9, border:`1px solid ${C.border}`, background:'#fafaf7', color:C.ink, cursor:'pointer' }}
                title="Materials & equipment" onClick={() => onNav('jobDetail', job.id)}>
                <Package size={15} />
              </button>
            </div>
          </div>
        );
      })}

      {completed.length > 0 && (
        <>
          <SectionLabel style={{ marginTop:24 }}>RECENT COMPLETED</SectionLabel>
          {completed.slice(0,3).map(job => {
            const c = computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, employees);
            return (
              <div key={job.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}
                onClick={() => onNav('jobDetail', job.id)}>
                <div><div style={{ fontWeight:700, fontSize:15, color:C.ink }}>{job.name}</div><div style={{ fontSize:12, color:C.inkFaint }}>Completed</div></div>
                <div style={{ fontWeight:700, fontSize:17, color: c.fev ? '#3f7d5c' : '#b8502f' }}>{c.margin.toFixed(1)}%</div>
              </div>
            );
          })}
          {completed.length > 3 && (
            <div style={{ textAlign:'center', padding:'8px 0', color:C.primary, fontSize:13, fontWeight:600, cursor:'pointer' }} onClick={() => onNav('history')}>
              View all job history ({completed.length} jobs) ->
            </div>
          )}
        </>
      )}
    </div>
  );
}
