import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { computeEmployeeHours } from '../utils/costing';
import { tenurePoints, rolePoints, perfMultiplier, fmtMoney2 } from '../utils/helpers';
import { Card, S, C, Hint, Divider } from '../components/UI';
import ScorecardPanel from './ScorecardPanel';

export default function BonusPanel({ job, c, employees, punches }) {
  const { scorecards, bonusCalcs, actions } = useApp();
  const [tab, setTab] = useState('scorecard'); // scorecard | bonus

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {['scorecard','bonus'].map(t => (
          <button key={t} style={{ flex:1, padding:'9px 4px', borderRadius:8, border:`1px solid ${C.border}`, background: tab===t ? C.primary : '#fff', color: tab===t ? '#fff' : C.inkSoft, fontSize:13, fontWeight:600, cursor:'pointer' }} onClick={() => setTab(t)}>
            {t === 'scorecard' ? 'Scorecards' : 'Bonus Calc'}
          </button>
        ))}
      </div>

      {tab === 'scorecard' && <ScorecardPanel job={job} employees={employees} punches={punches} />}
      {tab === 'bonus' && <BonusCalc job={job} c={c} employees={employees} punches={punches} scorecards={scorecards} bonusCalcs={bonusCalcs} actions={actions} />}
    </div>
  );
}

function BonusCalc({ job, c, employees, punches, scorecards, bonusCalcs, actions }) {
  const empHours = computeEmployeeHours(job.id, punches);
  const maxHours = Object.values(empHours).length > 0 ? Math.max(...Object.values(empHours)) : 0;
  const jobEmployees = employees.filter(e => empHours[e.id] > 0);

  if (!c.fev) {
    return (
      <Card>
        <div style={{ textAlign:'center', padding:'16px 0' }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.clay, marginBottom:8 }}>No FEV on this job</div>
          <div style={{ fontSize:13, color:C.inkFaint }}>Gross margin ({c.margin.toFixed(1)}%) did not exceed the {c.targetMargin}% target. No bonus pool generated.</div>
        </div>
      </Card>
    );
  }

  // Calculate per-person points
  const personData = jobEmployees.map(emp => {
    const sc = scorecards.find(s => s.jobId===job.id && s.employeeId===emp.id);
    const isLead = emp.role === 'Lead';
    const rPts = rolePoints(emp.role, emp.status);
    const tPts = tenurePoints(emp.hireDate);
    const basePts = rPts + tPts;
    const mult = isLead ? 1.2 : (sc ? perfMultiplier(sc.total, false) : null);
    const hrs = empHours[emp.id] || 0;
    const attFrac = maxHours > 0 ? hrs / maxHours : 0;
    const finalPts = mult != null ? basePts * mult * attFrac : null;
    return { emp, rPts, tPts, basePts, mult, attFrac, hrs, finalPts, hasScore: isLead || !!sc };
  });

  const allScored = personData.every(p => p.hasScore);
  const totalPts = personData.reduce((s,p) => s + (p.finalPts||0), 0);
  const pool = c.bonusPool;
  const csrBonus = c.csrBonus;

  const savedCalc = bonusCalcs.find(b => b.jobId === job.id);

  const saveCalc = async () => {
    const calc = {
      jobId: job.id,
      pool, csrBonus,
      margin: c.margin,
      targetMargin: c.targetMargin,
      fevValue: c.fevValue,
      perEmployee: personData.map(p => ({
        employeeId: p.emp.id,
        name: p.emp.name,
        rolePoints: p.rPts,
        tenurePoints: p.tPts,
        basePts: p.basePts,
        multiplier: p.mult,
        attendanceFraction: p.attFrac,
        finalPoints: p.finalPts,
        sharePercent: totalPts > 0 ? (p.finalPts||0)/totalPts*100 : 0,
        payout: totalPts > 0 ? (p.finalPts||0)/totalPts*pool : 0,
      })),
      savedAt: new Date().toISOString(),
    };
    await actions.saveBonusCalc(calc);
  };

  const missingScores = personData.filter(p => !p.hasScore).map(p => p.emp.name);

  return (
    <div>
      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>FEV Summary</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:8 }}>
          {[
            ['Gross Margin', `${c.margin.toFixed(1)}%`],
            ['FEV', `${(c.margin-c.targetMargin).toFixed(1)}%`],
            ['FEV Value', fmtMoney2(c.fevValue)],
            ['Team Pool (50%)', fmtMoney2(pool)],
            ['CSR Bonus (5%)', fmtMoney2(csrBonus)],
          ].map(([label,val]) => (
            <div key={label} style={{ flex:'1 1 120px', background:'#f0f7f3', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontSize:11, color:C.inkFaint, fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.primary }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      {missingScores.length > 0 && (
        <div style={{ background:'#fef9ee', border:`1px solid #f0d8c0`, borderRadius:10, padding:'10px 14px', fontSize:13, color:'#9c6a1a', marginBottom:12 }}>
          Missing scorecards: {missingScores.join(', ')}. Go to Scorecards tab to score them first.
        </div>
      )}

      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Point Breakdown</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                {['Employee','Role+Tenure','Multiplier','Attend.','Pts','Share','Payout'].map(h => (
                  <th key={h} style={{ padding:'6px 8px', textAlign:'left', color:C.inkFaint, fontWeight:700, fontSize:10.5, letterSpacing:'0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personData.map(p => {
                const share = totalPts > 0 ? (p.finalPts||0)/totalPts : 0;
                const payout = share * pool;
                return (
                  <tr key={p.emp.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:'8px 8px', fontWeight:600 }}>{p.emp.name}</td>
                    <td style={{ padding:'8px 8px' }}>{p.rPts}+{p.tPts}={p.basePts}</td>
                    <td style={{ padding:'8px 8px' }}>{p.mult != null ? `${p.mult}x` : <span style={{ color:C.clay }}>--</span>}</td>
                    <td style={{ padding:'8px 8px' }}>{(p.attFrac*100).toFixed(0)}%</td>
                    <td style={{ padding:'8px 8px', fontWeight:600 }}>{p.finalPts != null ? p.finalPts.toFixed(1) : <span style={{ color:C.clay }}>--</span>}</td>
                    <td style={{ padding:'8px 8px' }}>{(share*100).toFixed(1)}%</td>
                    <td style={{ padding:'8px 8px', fontWeight:700, color:C.primary }}>{p.finalPts != null ? fmtMoney2(payout) : '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Divider />
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.inkSoft, marginTop:8 }}>
          <span>Total points: {totalPts.toFixed(1)}</span>
          <span>Pool: {fmtMoney2(pool)}</span>
        </div>
      </Card>

      {allScored && (
        <button style={{ ...S.btnPrimary, width:'100%', marginTop:8 }} onClick={saveCalc}>
          {savedCalc ? 'Update saved calculation' : 'Save bonus calculation'}
        </button>
      )}
      {savedCalc && (
        <div style={{ textAlign:'center', fontSize:12, color:C.inkFaint, marginTop:8 }}>
          Last saved: {new Date(savedCalc.savedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
