import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { tenurePoints, rolePoints, hoursFromPunch, monthStr, fmtDate } from '../utils/helpers';
import { Card, FieldLabel, NumberInput, S, C, SectionLabel, Hint, useToast, Toast } from '../components/UI';

const ROLES = ['Lead', 'Foreman', 'Install Tech'];
const ALL_STATUSES = ['In Training', 'Experienced', 'Qualified', 'Active'];
const EMP_ID_COUNTER = () => `IEL-${String(Date.now()).slice(-4)}`;

export default function EmployeesScreen() {
  const { employees } = useApp();
  const [selected, setSelected] = useState(null);

  if (selected) return <EmployeeDetail empId={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={S.screen}>
      <SectionLabel>CREW ROSTER - {(employees||[]).length}</SectionLabel>
      {(employees||[]).length === 0 && <Hint>No employees yet. Add your first crew member below.</Hint>}
      {(employees||[]).map(emp => (
        <div key={emp.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}
          onClick={() => setSelected(emp.id)}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>{emp.name}</div>
            <div style={{ fontSize:12, color:C.inkFaint }}>{emp.role}{emp.status ? ` - ${emp.status}` : ''} - EID: {emp.employeeId}</div>
          </div>
          <ChevronRight size={18} color="#a8b5ac" />
        </div>
      ))}
      <AddEmployeeForm />
    </div>
  );
}

function AddEmployeeForm() {
  const { actions } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:'', employeeId:EMP_ID_COUNTER(), role:'Install Tech', status:'In Training', hireDate:'', burdenedRate:'' });
  const [toast, showToast] = useToast();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    await actions.addEmployee({ ...form, burdenedRate: Number(form.burdenedRate)||0 });
    setForm({ name:'', employeeId:EMP_ID_COUNTER(), role:'Install Tech', status:'In Training', hireDate:'', burdenedRate:'' });
    setOpen(false);
    showToast('Employee added');
  };

  return (
    <>
      <Toast message={toast} />
      {!open && (
        <button style={{ ...S.addChip, width:'100%', justifyContent:'center', marginTop:8 }} onClick={() => setOpen(true)}>
          + Add employee
        </button>
      )}
      {open && (
        <Card>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:14 }}>New Employee</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'span 2' }}>
              <div style={S.hourLabel}>Full name</div>
              <input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={form.name} onChange={e => set('name', e.target.value)} placeholder="First and last name" />
            </div>
            <div>
              <div style={S.hourLabel}>Employee ID</div>
              <input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={form.employeeId} onChange={e => set('employeeId', e.target.value)} />
            </div>
            <div>
              <div style={S.hourLabel}>Hire date</div>
              <input type="date" style={S.timeInput} value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
            </div>
            <div>
              <div style={S.hourLabel}>Role</div>
              <select style={{ ...S.select, flex:'unset', width:'100%' }} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={S.hourLabel}>Status</div>
              <select style={{ ...S.select, flex:'unset', width:'100%' }} value={form.status} onChange={e => set('status', e.target.value)}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <div style={S.hourLabel}>Burdened rate ($/hr)</div>
              <NumberInput value={form.burdenedRate} onChange={v => set('burdenedRate', v)} suffix="$/hr" />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button style={{ ...S.btnSecondary, flex:1, padding:'10px 0', fontSize:13 }} onClick={() => setOpen(false)}>Cancel</button>
            <button style={{ ...S.btnPrimary, flex:2, padding:'10px 0', fontSize:13 }} onClick={save}>Add employee</button>
          </div>
        </Card>
      )}
    </>
  );
}

function EmployeeDetail({ empId, onBack }) {
  const { employees, punches, jobs, scorecards, actions, managerUnlocked } = useApp();
  const [toast, showToast] = useToast();
  const [editing, setEditing] = useState(false);

  const emp = (employees||[]).find(e => e.id === empId);
  const [form, setForm] = useState(emp || {});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!emp) return null;

  const empPunches = (punches||[]).filter(p => p.crewId === empId && p.clockIn && p.clockOut);
  const totalHours = empPunches.reduce((s, p) => s + (p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut)), 0);

  const monthlyHours = {};
  empPunches.forEach(p => {
    const m = monthStr(p.date);
    const hrs = p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
    monthlyHours[m] = (monthlyHours[m] || 0) + hrs;
  });

  const jobsWorked = (jobs||[]).filter(j => empPunches.some(p => p.jobId === j.id));
  const rPts = rolePoints(emp.role, emp.status);
  const tPts = tenurePoints(emp.hireDate);

  const save = async () => {
    await actions.updateEmployee({ ...form, burdenedRate: Number(form.burdenedRate)||0 });
    setEditing(false);
    showToast('Saved');
  };

  return (
    <div style={S.screen}>
      <Toast message={toast} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button style={{ background:'transparent', border:'none', color:C.primary, fontSize:14, fontWeight:600, cursor:'pointer', padding:0 }} onClick={onBack}>
            Back
          </button>
          <div>
            <div style={{ fontWeight:700, fontSize:19 }}>{emp.name}</div>
            <div style={{ fontSize:12.5, color:C.inkFaint }}>EID: {emp.employeeId} - Hired: {fmtDate(emp.hireDate)}</div>
          </div>
        </div>
        <button style={{ background:'transparent', border:'none', color:C.primary, fontSize:13, fontWeight:600, cursor:'pointer' }} onClick={() => setEditing(e => !e)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'span 2' }}>
              <div style={S.hourLabel}>Full name</div>
              <input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={form.name||''} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <div style={S.hourLabel}>Employee ID</div>
              <input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={form.employeeId||''} onChange={e => set('employeeId', e.target.value)} />
            </div>
            <div>
              <div style={S.hourLabel}>Hire date</div>
              <input type="date" style={S.timeInput} value={form.hireDate||''} onChange={e => set('hireDate', e.target.value)} />
            </div>
            <div>
              <div style={S.hourLabel}>Role</div>
              <select style={{ ...S.select, flex:'unset', width:'100%' }} value={form.role||'Install Tech'} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={S.hourLabel}>Status</div>
              <select style={{ ...S.select, flex:'unset', width:'100%' }} value={form.status||'In Training'} onChange={e => set('status', e.target.value)}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {managerUnlocked && (
              <div style={{ gridColumn:'span 2' }}>
                <div style={S.hourLabel}>Burdened rate ($/hr)</div>
                <NumberInput value={form.burdenedRate||''} onChange={v => set('burdenedRate', v)} suffix="$/hr" />
              </div>
            )}
          </div>
          <button style={{ ...S.btnPrimary, width:'100%', marginTop:14, padding:'12px 0', fontSize:14 }} onClick={save}>Save changes</button>
        </Card>
      ) : (
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              ['Role', emp.role],
              ['Status', emp.status || '--'],
              ['Role points', rPts],
              ['Tenure points', tPts],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>{val}</div>
              </div>
            ))}
            {managerUnlocked && (
              <div>
                <div style={{ fontSize:11, color:C.inkFaint, fontWeight:600 }}>Burdened rate</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>${emp.burdenedRate}/hr</div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Hours Summary</div>
        <div style={{ display:'flex', gap:12, marginBottom:12 }}>
          <div style={{ flex:1, background:'#f0f7f3', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:C.inkFaint, fontWeight:600 }}>YTD HOURS</div>
            <div style={{ fontSize:22, fontWeight:800, color:C.primary }}>{totalHours.toFixed(1)}</div>
          </div>
          <div style={{ flex:1, background:'#f0f7f3', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:C.inkFaint, fontWeight:600 }}>JOBS WORKED</div>
            <div style={{ fontSize:22, fontWeight:800, color:C.primary }}>{jobsWorked.length}</div>
          </div>
        </div>
        <div style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>Monthly breakdown</div>
        {Object.keys(monthlyHours).length === 0 && <Hint>No hours logged yet.</Hint>}
        {Object.entries(monthlyHours).sort((a, b) => b[0].localeCompare(a[0])).map(([month, hrs]) => (
          <div key={month} style={S.logLine}>
            <span>{month}</span>
            <span style={{ fontWeight:600, color:C.ink }}>{hrs.toFixed(2)} hrs</span>
          </div>
        ))}
      </Card>

      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Job History</div>
        {jobsWorked.length === 0 && <Hint>No jobs logged yet.</Hint>}
        {jobsWorked.map(j => {
          const jobHrs = empPunches.filter(p => p.jobId === j.id).reduce((s, p) => s + (p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut)), 0);
          const sc = (scorecards||[]).find(s => s.jobId === j.id && s.employeeId === empId);
          return (
            <div key={j.id} style={S.logLine}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{j.name}</div>
                <div style={{ fontSize:11.5, color:C.inkFaint }}>{jobHrs.toFixed(2)} hrs{sc ? ` - Score: ${sc.total}/16 (${sc.multiplier}x)` : ' - Not scored'}</div>
              </div>
            </div>
          );
        })}
      </Card>

      <button style={{ marginTop:12, width:'100%', padding:'10px 0', background:'transparent', border:'none', color:C.clay, fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}
        onClick={async () => { await actions.deleteEmployee(empId); onBack(); }}>
        Remove employee
      </button>
    </div>
  );
}
