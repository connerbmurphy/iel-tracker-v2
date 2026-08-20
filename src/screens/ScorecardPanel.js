import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { computeEmployeeHours } from '../utils/costing';
import { perfMultiplier } from '../utils/helpers';
import { Card, FieldLabel, S, C, Hint } from '../components/UI';

const CRITERIA = [
  { key:'pace', label:'Work Pace & Initiative', desc:'Were they pushing forward or waiting to be directed?' },
  { key:'detail', label:'Attention to Detail', desc:'On point or making repeated mistakes? Took care with their work?' },
  { key:'customer', label:'Customer Interaction', desc:'Attentive and professional toward the client? Represented IEL well?' },
  { key:'cleanup', label:'Site Cleanup & Wrap-Up', desc:'Site clean? Remembered everything and closed the job properly?' },
];

const RATINGS = [
  { val:1, label:'1 - Below expectations' },
  { val:2, label:'2 - Met expectations' },
  { val:3, label:'3 - Exceeded expectations' },
  { val:4, label:'4 - Exceptional' },
];

export default function ScorecardPanel({ job, employees, punches }) {
  const { scorecards, actions } = useApp();
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [scores, setScores] = useState({ pace:0, detail:0, customer:0, cleanup:0 });

  // Only employees who worked this job
  const empHours = computeEmployeeHours(job.id, punches);
  const jobEmployees = employees.filter(e => empHours[e.id] > 0);

  const loadScorecard = (empId) => {
    setSelectedEmp(empId);
    const existing = scorecards.find(s => s.jobId===job.id && s.employeeId===empId);
    setScores(existing?.scores || { pace:0, detail:0, customer:0, cleanup:0 });
  };

  const saveScorecard = async () => {
    const total = scores.pace + scores.detail + scores.customer + scores.cleanup;
    const emp = employees.find(e => e.id === selectedEmp);
    const isLead = emp?.role === 'Lead';
    const mult = perfMultiplier(total, isLead);
    await actions.saveScorecard({ jobId:job.id, employeeId:selectedEmp, scores, total, multiplier:mult });
    setSelectedEmp(null);
  };

  return (
    <div>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Performance Scorecards</div>
      {jobEmployees.length === 0 && <Hint>No employees have punches on this job yet.</Hint>}
      {jobEmployees.map(emp => {
        const sc = scorecards.find(s => s.jobId===job.id && s.employeeId===emp.id);
        const isLead = emp.role === 'Lead';
        return (
          <Card key={emp.id} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{emp.name}</div>
                <div style={{ fontSize:12, color:C.inkFaint }}>{emp.role}{emp.status ? ` - ${emp.status}` : ''}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                {isLead ? (
                  <div style={{ fontSize:12, color:C.primary, fontWeight:600 }}>Fixed 1.2x (Lead)</div>
                ) : sc ? (
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.primary }}>{sc.total}/16 - {sc.multiplier}x</div>
                    <button style={{ fontSize:12, color:C.inkFaint, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }} onClick={() => loadScorecard(emp.id)}>Edit</button>
                  </div>
                ) : (
                  <button style={{ ...S.btnPrimarySmall, fontSize:12, padding:'8px 14px' }} onClick={() => loadScorecard(emp.id)}>Score</button>
                )}
              </div>
            </div>
            {selectedEmp === emp.id && !isLead && (
              <div style={{ marginTop:14 }}>
                {CRITERIA.map(c => (
                  <div key={c.key} style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{c.label}</div>
                    <div style={{ fontSize:12, color:C.inkFaint, marginBottom:8 }}>{c.desc}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      {RATINGS.map(r => (
                        <button key={r.val} style={{ flex:1, padding:'10px 0', borderRadius:9, border:`1.5px solid ${scores[c.key]===r.val ? C.primary : C.border}`, background: scores[c.key]===r.val ? '#eef6f1' : '#fafaf8', color: scores[c.key]===r.val ? C.primary : C.inkSoft, fontSize:16, fontWeight:700, cursor:'pointer' }}
                          onClick={() => setScores(s => ({ ...s, [c.key]: r.val }))}>
                          {r.val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ background:'#f0f7f3', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13 }}>
                  Total: <strong>{scores.pace+scores.detail+scores.customer+scores.cleanup}/16</strong> - Multiplier: <strong>{perfMultiplier(scores.pace+scores.detail+scores.customer+scores.cleanup, false)}x</strong>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button style={{ ...S.btnSecondary, flex:1, padding:'10px 0', fontSize:13 }} onClick={() => setSelectedEmp(null)}>Cancel</button>
                  <button style={{ ...S.btnPrimary, flex:2, padding:'10px 0', fontSize:13 }} onClick={saveScorecard}>Save scorecard</button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
