import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { computeJobCosts } from '../utils/costing';
import { fmtMoney, fmtDate } from '../utils/helpers';
import { S, C, SectionLabel, Hint } from '../components/UI';

export default function HistoryScreen({ onNav }) {
  const app = useApp();
  const { jobs, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog,
          rates, equipment, trucks, trailers, stockItems, employees } = app;

  const completed = jobs.filter(j => j.status === 'complete')
    .sort((a,b) => (b.completedAt||'').localeCompare(a.completedAt||''));

  // Group by year
  const byYear = {};
  completed.forEach(job => {
    const yr = (job.completedAt||'').slice(0,4) || 'Unknown';
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(job);
  });

  return (
    <div style={S.screen}>
      <div style={{ fontWeight:700, fontSize:19, marginBottom:4 }}>Job History</div>
      <div style={{ fontSize:12.5, color:C.inkFaint, marginBottom:16 }}>{completed.length} completed jobs on record</div>

      {completed.length === 0 && <Hint>No completed jobs yet. Mark a job complete to add it to history.</Hint>}

      {Object.entries(byYear).sort((a,b) => b[0].localeCompare(a[0])).map(([year, yearJobs]) => (
        <div key={year}>
          <SectionLabel>{year} - {yearJobs.length} jobs</SectionLabel>
          {yearJobs.map(job => {
            const c = computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, employees);
            return (
              <div key={job.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 16px', marginBottom:10, cursor:'pointer' }}
                onClick={() => onNav('jobDetail', job.id)}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:C.ink }}>{job.name}</div>
                    <div style={{ fontSize:12, color:C.inkFaint, marginTop:2 }}>
                      Revenue: {fmtMoney(c.revenue)} - COGS: {fmtMoney(c.totalCOGS)} - {c.laborHours.toFixed(1)} hrs
                    </div>
                  </div>
                  <div style={{ textAlign:'right', marginLeft:12 }}>
                    <div style={{ fontWeight:800, fontSize:18, color: c.fev ? '#3f7d5c' : '#b8502f' }}>{c.margin.toFixed(1)}%</div>
                    <div style={{ fontSize:11, color:C.inkFaint }}>{c.fev ? 'FEV' : 'No FEV'}</div>
                  </div>
                </div>
                <div style={{ marginTop:8, height:4, borderRadius:2, background:'#ece9df', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, width:`${Math.min(100,Math.max(0,c.margin))}%`, background: c.margin>=job.targetMargin ? '#3f7d5c' : '#b8502f' }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
