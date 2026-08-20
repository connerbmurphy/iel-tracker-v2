import React, { useState } from 'react';
import { LogIn, LogOut, Check, Clock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { nowTimeStr, todayStr, hoursFromPunch, fmtTime, fmtMoney2, calcPersonLaborCost } from '../utils/helpers';
import { Card, FieldLabel, S, C } from '../components/UI';

export function ClockInScreen({ jobId, onDone, onBack }) {
  const { jobs, punches, employees, actions } = useApp();
  const job = jobs.find(j => j.id === jobId);
  const [clockIn, setClockIn] = useState(nowTimeStr());
  const [date, setDate] = useState(todayStr());
  const [selected, setSelected] = useState([]);

  if (!job) return null;

  const alreadyIn = punches.filter(p => p.jobId === jobId && p.date === date && p.clockIn && !p.clockOut).map(p => p.crewId);
  const available = employees.filter(e => !alreadyIn.includes(e.id));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSave = async () => {
    await actions.addPunchBatch(selected.map(crewId => ({ type:'punch', jobId, crewId, date, clockIn, clockOut: null })));
    onDone();
  };

  return (
    <div style={S.screen}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <LogIn size={20} color={C.primary} />
        <div><div style={{ fontWeight:700, fontSize:19 }}>Clock in</div><div style={{ fontSize:12.5, color:C.inkFaint }}>{job.name}</div></div>
      </div>

      <Card>
        <FieldLabel icon={Clock}>Clock-in time</FieldLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div><div style={S.hourLabel}>Date</div><input type="date" style={S.timeInput} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><div style={S.hourLabel}>Time</div><input type="time" style={S.timeInput} value={clockIn} onChange={e => setClockIn(e.target.value)} /></div>
        </div>
        <div style={S.hint}>Clock-in is at the shop - drive time included.</div>
      </Card>

      <Card>
        <FieldLabel>Who's starting this job?</FieldLabel>
        {available.length === 0 && <div style={S.hint}>All employees already clocked in for this job today.</div>}
        {available.map(emp => (
          <div key={emp.id} style={{ ...S.crewSelectRow, background: selected.includes(emp.id) ? '#eef6f1' : '#fafaf8', borderColor: selected.includes(emp.id) ? C.primary : C.border }}
            onClick={() => toggle(emp.id)}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{emp.name}</div>
              <div style={{ fontSize:12, color:C.inkFaint }}>{emp.role}{emp.status ? ` - ${emp.status}` : ''}</div>
            </div>
            {selected.includes(emp.id) && <Check size={18} color={C.primary} />}
          </div>
        ))}
      </Card>

      <div style={S.bottomBar}>
        <button style={S.btnSecondary} onClick={onBack}>Cancel</button>
        <button style={{ ...S.btnPrimary, opacity: selected.length ? 1 : 0.4 }} onClick={handleSave} disabled={!selected.length}>
          Clock in {selected.length > 0 ? `(${selected.length})` : ''}
        </button>
      </div>
    </div>
  );
}

export function ClockOutScreen({ jobId, onDone, onBack }) {
  const { jobs, punches, employees, actions } = useApp();
  const job = jobs.find(j => j.id === jobId);
  const openPunches = punches.filter(p => p.jobId === jobId && p.clockIn && !p.clockOut);
  const [selected, setSelected] = useState([]);
  const [states, setStates] = useState(() => Object.fromEntries(openPunches.map(p => [p.id, { clockOut: nowTimeStr(), overrideHrs: '', showOverride: false }])));

  if (!job) return null;

  const upd = (id, patch) => setStates(s => ({ ...s, [id]: { ...s[id], ...patch } }));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSave = async () => {
    const updates = selected.map(id => {
      const st = states[id] || {};
      return { id, clockOut: st.clockOut, ...(st.overrideHrs !== '' ? { overrideHrs: Number(st.overrideHrs) } : {}) };
    });
    await actions.clockOutBatch(updates);
    onDone();
  };

  return (
    <div style={S.screen}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <LogOut size={20} color={C.primary} />
        <div><div style={{ fontWeight:700, fontSize:19 }}>Clock out</div><div style={{ fontSize:12.5, color:C.inkFaint }}>{job.name}</div></div>
      </div>

      {openPunches.length === 0 && <div style={S.hint}>No one is currently clocked in on this job.</div>}

      <Card>
        <FieldLabel>Who's clocking out?</FieldLabel>
        {openPunches.map(punch => {
          const emp = employees.find(e => e.id === punch.crewId);
          const isSel = selected.includes(punch.id);
          return (
            <div key={punch.id} style={{ ...S.crewSelectRow, background: isSel ? '#eef6f1' : '#fafaf8', borderColor: isSel ? C.primary : C.border }}
              onClick={() => toggle(punch.id)}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{emp?.name || '?'}</div>
                <div style={{ fontSize:12, color:C.inkFaint }}>{emp?.role} - in {fmtTime(punch.clockIn)}</div>
              </div>
              {isSel && <Check size={18} color={C.primary} />}
            </div>
          );
        })}
      </Card>

      {selected.length > 0 && (
        <Card>
          <FieldLabel icon={Clock}>Clock-out time</FieldLabel>
          {selected.map(id => {
            const punch = openPunches.find(p => p.id === id);
            const emp = employees.find(e => e.id === punch?.crewId);
            const st = states[id] || { clockOut: nowTimeStr(), overrideHrs: '', showOverride: false };
            const autoHrs = hoursFromPunch(punch?.clockIn, st.clockOut);
            const finalHrs = st.overrideHrs !== '' ? Number(st.overrideHrs) : autoHrs;
            const ot = Math.max(0, finalHrs - 8);
            const cost = calcPersonLaborCost(finalHrs, emp ? emp.burdenedRate : 0);
            return (
              <div key={id} style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>{emp?.name || '?'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><div style={S.hourLabel}>Clock-out time</div><input type="time" style={S.timeInput} value={st.clockOut} onChange={e => upd(id, { clockOut: e.target.value })} /></div>
                  <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                    <div style={{ fontSize:12, color:C.inkSoft }}>{finalHrs.toFixed(2)}h{ot > 0 ? ` - ${ot.toFixed(2)} OT` : ''}</div>
                    <div style={{ marginLeft:'auto', fontWeight:700, color: ot>0 ? C.gold : C.primary, fontSize:13 }}>{fmtMoney2(cost)}</div>
                  </div>
                </div>
                {!st.showOverride
                  ? <button style={{ ...S.addChip, marginTop:8 }} onClick={() => upd(id, { showOverride:true, overrideHrs:finalHrs.toFixed(2) })}>Override hours</button>
                  : <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
                      <div style={{ flex:1 }}><input type="number" inputMode="decimal" style={S.numberInput} value={st.overrideHrs} onChange={e => upd(id, { overrideHrs: e.target.value })} onFocus={e => e.target.select()} /><span style={S.numberSuffix}>hrs (manual)</span></div>
                      <button style={S.removeBtn} onClick={() => upd(id, { showOverride:false, overrideHrs:'' })}>X</button>
                    </div>}
              </div>
            );
          })}
        </Card>
      )}

      <div style={S.bottomBar}>
        <button style={S.btnSecondary} onClick={onBack}>Cancel</button>
        <button style={{ ...S.btnPrimary, opacity: selected.length ? 1 : 0.4 }} onClick={handleSave} disabled={!selected.length}>
          Clock out {selected.length > 0 ? `(${selected.length})` : ''}
        </button>
      </div>
    </div>
  );
}
