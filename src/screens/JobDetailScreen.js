import React, { useState } from 'react';
import { Plus, Sprout, Package, Wrench, Clock, Check, AlertTriangle, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { computeJobCosts, materialItemCost, materialReturnCredit } from '../utils/costing';
import { uid, todayStr, nowTimeStr, fmtMoney, fmtMoney2, fmtTime, hoursFromPunch, calcPersonLaborCost } from '../utils/helpers';
import { Card, FieldLabel, NumberInput, S, C, SectionLabel, DetailRow, Divider, Hint, MarginHero, WarningBanner, useToast, Toast } from '../components/UI';
import ManagerPinGate from '../components/ManagerPin';
import ScorecardPanel from './ScorecardPanel';
import BonusPanel from './BonusPanel';

const PLANT_SIZES = ['4"','1g','3g','7g','15g','25g','45g','Other'];

export default function JobDetailScreen({ jobId, onBack, onNav }) {
  const app = useApp();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState('costs');
  const [error, setError] = useState(null);

  if (!app) return <div style={{ padding:20, color:'#8a9a8e' }}>Loading...</div>;

  const { jobs, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog,
          rates, equipment, trucks, trailers, stockItems, employees, actions, managerUnlocked } = app;
  const job = (jobs||[]).find(j => j.id === jobId);
  if (!job) return <div style={{ padding:20, color:'#8a9a8e' }}>Job not found.</div>;
  if (error) return (
    <div style={{ padding:20 }}>
      <div style={{ fontWeight:700, fontSize:16, color:'#b8502f', marginBottom:8 }}>Something went wrong loading this job.</div>
      <div style={{ fontSize:13, color:'#8a9a8e', marginBottom:16 }}>{error}</div>
      <button style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'#2f5d4a', color:'#fff', fontWeight:700, cursor:'pointer' }} onClick={onBack}>Back to jobs</button>
    </div>
  );

  const c = computeJobCosts(job, punches, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, stockItems, employees);
  const jobPunches = punches.filter(p => p.jobId === jobId).sort((a,b) => (a.date+(a.clockIn||'')).localeCompare(b.date+(b.clockIn||'')));

  const autoSave = async (key, val) => {
    if (key === 'plants') await actions.updatePlants(jobId, val);
    if (key === 'materials') await actions.updateMaterials(jobId, val);
    showToast('Saved');
  };

  return (
    <div style={S.screen}>
      <Toast message={toast} />
      <div style={{ fontWeight:700, fontSize:19, marginBottom:4 }}>{job.name}</div>
      <div style={{ fontSize:12.5, color:C.inkFaint, marginBottom:16 }}>{job.status === 'active' ? 'Active job' : 'Completed'}</div>

      {job.notes && <div style={C.infoBanner || { background:'#f0f7f3', border:`1px solid #c8e0d4`, borderRadius:10, padding:'10px 14px', fontSize:13, color:C.primary, marginBottom:14, lineHeight:1.5 }}>{job.notes}</div>}

      {/* Tabs */}
      <div style={S.tabRow}>
        {['costs','labor','bonus'].map(t => (
          <button key={t} style={{ ...S.tab, ...(tab===t ? S.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === 'costs' ? 'Costs' : t === 'labor' ? 'Labor' : 'Bonus'}
          </button>
        ))}
      </div>

      {tab === 'costs' && <CostsTab job={job} c={c} rates={rates} equipment={equipment} trucks={trucks} trailers={trailers} stockItems={stockItems} plantsRec={plantsRec} materialsRec={materialsRec} equipmentLog={equipmentLog} truckLog={truckLog} trailerLog={trailerLog} actions={actions} autoSave={autoSave} onUpdateJob={actions.updateJob} onDeleteJob={async () => { await actions.deleteJob(jobId); onBack(); }} />}
      {tab === 'labor' && <LaborTab job={job} c={c} punches={jobPunches} employees={employees} actions={actions} showToast={showToast} managerUnlocked={managerUnlocked} onNav={onNav} jobId={jobId} />}
      {tab === 'bonus' && (
        <ManagerPinGate>
          <BonusPanel job={job} c={c} employees={employees} punches={punches} />
        </ManagerPinGate>
      )}
    </div>
  );
}

function CostsTab({ job, c, rates, equipment, trucks, trailers, stockItems, plantsRec, materialsRec, equipmentLog, truckLog, trailerLog, actions, autoSave, onUpdateJob, onDeleteJob }) {
  return (
    <>
      <MarginHero margin={c.margin} targetMargin={c.targetMargin} fev={c.fev} />
      {c.activePunches.length > 0 && <WarningBanner icon={Clock}>{c.activePunches.length} crew member{c.activePunches.length>1?'s':''} still clocked in.</WarningBanner>}

      <Card>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <DetailRow label="Revenue (bid)" value={fmtMoney(c.revenue)} />
          <DetailRow label="Labor" value={fmtMoney(c.laborCost)} sub={`${c.laborHours.toFixed(1)} crew-hrs${c.laborOTHours>0?` - ${c.laborOTHours.toFixed(1)} OT`:''}`} />
          <DetailRow label="Plants" value={fmtMoney(c.plantCost)} sub={`${c.totalPlantQty} total qty`} />
          <DetailRow label="Materials" value={fmtMoney(c.materialsCost)} />
          <DetailRow label="Equipment" value={fmtMoney(c.equipmentCost)} sub={Object.entries(c.equipmentHours).map(([k,h])=>`${equipment.find(e=>e.id===k)?.name||k}: ${h.toFixed(1)}hr`).join(' - ')||'--'} />
          <DetailRow label="Truck fuel" value={fmtMoney(c.truckCost)} sub={Object.entries(c.truckMiles).map(([k,m])=>`${trucks.find(t=>t.id===k)?.name||k}: ${m}mi`).join(' - ')||'--'} />
          <DetailRow label="Trailers" value={fmtMoney(c.trailerCost)} sub={Object.entries(c.trailerDays).map(([k,d])=>`${trailers.find(t=>t.id===k)?.name||k}: ${d}d`).join(' - ')||'--'} />
          <Divider />
          <DetailRow label="Total COGS" value={fmtMoney(c.totalCOGS)} bold />
          <DetailRow label="Gross profit" value={fmtMoney(c.grossProfit)} bold />
        </div>
      </Card>

      <SectionLabel>PLANTS & MATERIALS</SectionLabel>
      <PlantsPanel jobId={job.id} plantsRec={plantsRec} onUpdate={(id, val) => autoSave('plants', val)} />
      <MaterialsPanel jobId={job.id} materialsRec={materialsRec} stockItems={stockItems} onUpdate={(id, val) => autoSave('materials', val)} />

      <SectionLabel>EQUIPMENT & TRUCKS</SectionLabel>
      <EquipmentPanel jobId={job.id} equipmentLog={equipmentLog} truckLog={truckLog} trailerLog={trailerLog} rates={rates || { mileageRate:0.80 }} equipment={equipment} trucks={trucks} trailers={trailers} actions={actions} />

      {job.status === 'active' && (
        <button style={{ marginTop:16, width:'100%', padding:'13px 0', borderRadius:10, border:`1.5px solid ${C.primary}`, background:'transparent', color:C.primary, fontSize:14, fontWeight:700, cursor:'pointer' }}
          onClick={() => onUpdateJob({ ...job, status:'complete' })}>Mark job complete</button>
      )}
      {job.status === 'complete' && <DeleteJobConfirm jobName={job.name} onConfirm={onDeleteJob} />}
    </>
  );
}

function LaborTab({ job, c, punches, employees, actions, showToast, managerUnlocked, onNav, jobId }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <>
      <Card>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Job Time Summary</div>
        <div style={{ fontSize:13, color:C.inkSoft, marginBottom:8 }}>Total job hours (highest employee): <strong style={{ color:C.ink }}>{c.maxHours.toFixed(2)} hrs</strong></div>
        {Object.entries(c.empHours).map(([eid, hrs]) => {
          const emp = employees.find(e => e.id === eid);
          const frac = c.maxHours > 0 ? hrs / c.maxHours : 0;
          return (
            <div key={eid} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{emp?.name || '?'}</div>
                <div style={{ fontSize:11.5, color:C.inkFaint }}>{hrs.toFixed(2)} hrs - {(frac*100).toFixed(0)}% attendance</div>
              </div>
              <div style={{ width:80 }}>
                <div style={{ height:6, borderRadius:3, background:'#ece9df', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:C.primary, width:`${frac*100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <SectionLabel>PUNCH LOG</SectionLabel>
      {punches.length === 0 && <Hint>No punches yet. Use Clock In on the home screen.</Hint>}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        {punches.map(p => {
          const emp = employees.find(e => e.id === p.crewId);
          const hrs = p.overrideHrs != null ? Number(p.overrideHrs) : hoursFromPunch(p.clockIn, p.clockOut);
          const ot = Math.max(0, hrs - 8);
          const cost = calcPersonLaborCost(hrs, emp ? emp.burdenedRate : 0);
          const isOpen = p.clockIn && !p.clockOut;
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} style={{ ...S.logEntry, flexDirection:'column', alignItems:'stretch', borderColor: isOpen ? C.gold : isEditing ? C.primary : C.border, background: isOpen ? '#fefaf3' : isEditing ? '#f5fbf7' : '#fff', padding:0, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', cursor:'pointer' }} onClick={() => setEditingId(isEditing ? null : p.id)}>
                {isOpen ? <Clock size={14} color={C.gold} /> : <Check size={14} color={C.primary} />}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:C.ink }}>{emp?.name || '?'} - {emp?.role}</div>
                  <div style={{ fontSize:12, color:C.inkFaint, marginTop:1 }}>
                    {isOpen ? `In ${fmtTime(p.clockIn)} - still on clock - ${p.date}` : `${fmtTime(p.clockIn)} -> ${fmtTime(p.clockOut)}${p.overrideHrs!=null?' (manual)':''} - ${hrs.toFixed(2)}hr${ot>0?` - ${ot.toFixed(2)} OT`:''} - ${fmtMoney2(cost)} - ${p.date}`}
                  </div>
                  {p.notes && !isEditing && <div style={{ fontSize:11.5, color:C.inkFaint, marginTop:2, fontStyle:'italic' }}>{p.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {isOpen && <button style={{ background:C.gold, border:'none', color:'#fff', borderRadius:8, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer' }} onClick={e => { e.stopPropagation(); actions.updatePunch(p.id, { clockOut: nowTimeStr() }); showToast('Clocked out'); }}>Out now</button>}
                  <Edit2 size={14} color={isEditing ? C.primary : '#a8b5ac'} />
                  <button style={{ ...S.removeBtn, padding:'4px' }} onClick={e => { e.stopPropagation(); actions.deletePunch(p.id); showToast('Deleted'); }}><X size={14} color={C.clay} /></button>
                </div>
              </div>
              {isEditing && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 13px', display:'flex', flexDirection:'column', gap:10, background:'#f9fdf9' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div><div style={S.hourLabel}>Crew member</div>
                      <select style={{ ...S.select, flex:'unset', width:'100%' }} value={p.crewId} onChange={e => actions.updatePunch(p.id, { crewId: e.target.value })}>
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                    <div><div style={S.hourLabel}>Date</div><input type="date" style={S.timeInput} value={p.date} onChange={e => actions.updatePunch(p.id, { date: e.target.value })} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div><div style={S.hourLabel}>Clock-in</div><input type="time" style={S.timeInput} value={p.clockIn||''} onChange={e => actions.updatePunch(p.id, { clockIn: e.target.value, overrideHrs: null })} /></div>
                    <div><div style={S.hourLabel}>Clock-out</div><input type="time" style={S.timeInput} value={p.clockOut||''} onChange={e => actions.updatePunch(p.id, { clockOut: e.target.value, overrideHrs: null })} /></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={S.hourLabel}>Manual hrs override</div>
                      <div style={S.numberInputWrap}><input type="number" inputMode="decimal" style={S.numberInput} value={p.overrideHrs??''} placeholder={hrs.toFixed(2)} onChange={e => actions.updatePunch(p.id, { overrideHrs: e.target.value==='' ? null : Number(e.target.value) })} onFocus={e=>e.target.select()} /><span style={S.numberSuffix}>hrs</span></div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:4 }}>
                      <div style={{ fontSize:12, color:C.inkSoft, fontWeight:600 }}>{hrs.toFixed(2)}hr{ot>0?` - ${ot.toFixed(2)} OT`:''}</div>
                      <div style={{ fontSize:13, fontWeight:700, color: ot>0 ? C.gold : C.primary }}>{fmtMoney2(cost)}</div>
                    </div>
                  </div>
                  <div>
                    <div style={S.hourLabel}>Performance notes</div>
                    <input style={{ ...S.textInput, flex:'unset', width:'100%' }} placeholder="e.g. strong on irrigation, needs guidance on planting depth" value={p.notes||''} onChange={e => actions.updatePunch(p.id, { notes: e.target.value })} />
                  </div>
                  <button style={{ ...S.btnSecondary, padding:'8px 0', fontSize:13 }} onClick={() => setEditingId(null)}>Done editing</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Plants Panel
function PlantsPanel({ jobId, plantsRec, onUpdate }) {
  const [open, setOpen] = useState(false);
  const rec = plantsRec[jobId] || { items:[], totalCost:'', notes:'' };
  const items = rec.items || [];
  const totalQty = items.reduce((s,i) => s+(Number(i.qty)||0), 0);
  const set = (patch) => onUpdate(jobId, { ...rec, ...patch });
  const setItems = (next) => set({ items: next });
  const addItem = () => setItems([...items, { id:uid('pl'), name:'', size:'3g', qty:1 }]);
  const updItem = (id, patch) => setItems(items.map(i => i.id===id ? { ...i, ...patch } : i));
  const removeItem = (id) => setItems(items.filter(i => i.id!==id));
  const adjustQty = (id, delta) => setItems(items.map(i => i.id===id ? { ...i, qty: Math.max(0,(Number(i.qty)||0)+delta) } : i));

  return (
    <div style={S.panelCard}>
      <div style={S.panelHeader} onClick={() => setOpen(o=>!o)}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Sprout size={16} color={C.primary} />
          <div><div style={{ fontWeight:700, fontSize:14 }}>Plants</div><div style={{ fontSize:12, color:C.inkFaint }}>{items.length>0?`${items.length} lines - ${totalQty} total${rec.totalCost?' - $'+Number(rec.totalCost).toFixed(2)+' wholesale':''}` :'No plants logged'}</div></div>
        </div>
        {open ? <ChevronUp size={18} color="#8a9a8e" /> : <ChevronDown size={18} color="#8a9a8e" />}
      </div>
      {open && (
        <div style={S.panelBody}>
          {items.length>0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 90px 32px', gap:6, marginBottom:4, padding:'0 2px' }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.inkFaint }}>PLANT NAME</div>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.inkFaint }}>SIZE</div>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.inkFaint, textAlign:'center' }}>QTY</div>
              <div />
            </div>
          )}
          {items.map(item => (
            <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 90px 32px', gap:6, alignItems:'center', marginBottom:8 }}>
              <input style={{ ...S.textInput, flex:'unset', width:'100%', padding:'9px 10px', fontSize:13 }} placeholder="e.g. Mango, Kent" value={item.name} onChange={e => updItem(item.id, { name: e.target.value })} />
              <select style={{ ...S.select, flex:'unset', width:'100%', padding:'9px 6px', fontSize:13 }} value={item.size} onChange={e => updItem(item.id, { size: e.target.value })}>
                {PLANT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={S.qtyTicker}>
                <button style={S.qtyBtn} onClick={() => adjustQty(item.id,-1)}>-</button>
                <input type="number" inputMode="numeric" style={S.qtyInput} value={item.qty} onChange={e => updItem(item.id, { qty: e.target.value })} onFocus={e=>e.target.select()} />
                <button style={S.qtyBtn} onClick={() => adjustQty(item.id,1)}>+</button>
              </div>
              <button style={{ ...S.removeBtn, padding:4 }} onClick={() => removeItem(item.id)}><X size={14} /></button>
            </div>
          ))}
          <button style={{ ...S.addChip, marginTop:4 }} onClick={addItem}><Plus size={13} /> Add plant</button>
          <div style={{ height:1, background:C.border, margin:'14px 0' }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><div style={S.hourLabel}>Total wholesale cost (at job close)</div><NumberInput value={rec.totalCost||''} onChange={v => set({ totalCost:v })} suffix="$" /></div>
            <div><div style={S.hourLabel}>Notes</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={rec.notes||''} onChange={e => set({ notes: e.target.value })} placeholder="e.g. nursery block C" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Materials Panel
function MaterialsPanel({ jobId, materialsRec, stockItems, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const rec = materialsRec[jobId] || { items:[], miscExpenses:[] };
  const items = rec.items || [];
  const misc = rec.miscExpenses || [];
  const totalCost = items.reduce((s,i) => s+materialItemCost(i,stockItems)-materialReturnCredit(i,stockItems), 0) + misc.reduce((s,e) => s+(Number(e.amount)||0), 0);
  const setItems = (next) => onUpdate(jobId, { ...rec, items:next });
  const setMisc = (next) => onUpdate(jobId, { ...rec, miscExpenses:next });
  const addItem = (type) => { const ni={id:uid('mat'),date:todayStr(),description:'',source:'',type,stockItemId:stockItems[0]?.id||'',qty:'',unit:'',receiptAmount:'',isReturn:false,notes:''}; setItems([...items,ni]); setEditingId(ni.id); };
  const updateItem = (id,patch) => setItems(items.map(it => it.id===id ? { ...it,...patch } : it));
  const removeItem = (id) => { setItems(items.filter(it => it.id!==id)); if(editingId===id) setEditingId(null); };
  const addMisc = () => setMisc([...misc, { id:uid('misc'), title:'', amount:'', notes:'' }]);
  const updMisc = (id,patch) => setMisc(misc.map(e => e.id===id ? { ...e,...patch } : e));
  const removeMisc = (id) => setMisc(misc.filter(e => e.id!==id));

  return (
    <div style={S.panelCard}>
      <div style={S.panelHeader} onClick={() => setOpen(o=>!o)}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Package size={16} color={C.primary} />
          <div><div style={{ fontWeight:700, fontSize:14 }}>Materials</div><div style={{ fontSize:12, color:C.inkFaint }}>{items.length>0||misc.length>0?`${items.length+misc.length} items - ${fmtMoney2(Math.max(0,totalCost))}`:'No materials logged'}</div></div>
        </div>
        {open ? <ChevronUp size={18} color="#8a9a8e" /> : <ChevronDown size={18} color="#8a9a8e" />}
      </div>
      {open && (
        <div style={S.panelBody}>
          {items.map(item => {
            const isEditing = editingId===item.id;
            const si = item.type==='stockDraw' ? stockItems.find(s=>s.id===item.stockItemId) : null;
            const itemCost = materialItemCost(item,stockItems)-materialReturnCredit(item,stockItems);
            return (
              <div key={item.id} style={{ ...S.matItem, borderColor: item.isReturn ? '#f0d8d3' : isEditing ? C.primary : C.border, background: item.isReturn ? '#fdf5f3' : isEditing ? '#f5fbf7' : '#fafaf8' }}>
                <div style={S.matItemHeader} onClick={() => setEditingId(isEditing?null:item.id)}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13.5, color: item.isReturn ? C.clay : C.ink }}>{item.description||<span style={{ color:'#aaa', fontStyle:'italic' }}>Untitled</span>}{item.isReturn?' (return)':''}</div>
                    <div style={{ fontSize:11.5, color:C.inkFaint, marginTop:2 }}>{item.date}{item.source?` - ${item.source}`:''} - <span style={{ fontWeight:600, color: item.isReturn ? C.clay : C.primary }}>{item.isReturn?'-':''}{fmtMoney2(Math.abs(itemCost))}</span></div>
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    {isEditing ? <ChevronUp size={15} color="#8a9a8e" /> : <ChevronDown size={15} color="#8a9a8e" />}
                    <button style={S.removeBtn} onClick={e => { e.stopPropagation(); removeItem(item.id); }}><X size={14} /></button>
                  </div>
                </div>
                {isEditing && (
                  <div style={{ paddingTop:10, display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div><div style={S.hourLabel}>Description</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={item.description} onChange={e=>updateItem(item.id,{description:e.target.value})} placeholder="e.g. 3/4 PVC pipe"/></div>
                      <div><div style={S.hourLabel}>Date</div><input type="date" style={S.timeInput} value={item.date} onChange={e=>updateItem(item.id,{date:e.target.value})}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div><div style={S.hourLabel}>Source / supplier</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={item.source} onChange={e=>updateItem(item.id,{source:e.target.value})} placeholder="e.g. SiteOne"/></div>
                      <div><div style={S.hourLabel}>Type</div><select style={{ ...S.select, flex:'unset', width:'100%' }} value={item.type} onChange={e=>updateItem(item.id,{type:e.target.value})}><option value="purchase">Purchase</option><option value="stockDraw">Shop stock</option><option value="other">Other</option></select></div>
                    </div>
                    {item.type==='purchase'&&<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}><div><div style={S.hourLabel}>Receipt amount</div><NumberInput value={item.receiptAmount} onChange={v=>updateItem(item.id,{receiptAmount:v})} suffix="$"/></div><div><div style={S.hourLabel}>Qty (optional)</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={item.qty} onChange={e=>updateItem(item.id,{qty:e.target.value})} placeholder="e.g. 10"/></div></div>}
                    {item.type==='stockDraw'&&<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}><div><div style={S.hourLabel}>Stock item</div><select style={{ ...S.select, flex:'unset', width:'100%' }} value={item.stockItemId} onChange={e=>updateItem(item.id,{stockItemId:e.target.value})}>{stockItems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><div style={S.hourLabel}>Quantity</div><NumberInput value={item.qty} onChange={v=>updateItem(item.id,{qty:v})} suffix={si?.unit||'units'}/></div></div>}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div><div style={S.hourLabel}>Notes</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={item.notes} onChange={e=>updateItem(item.id,{notes:e.target.value})} placeholder="Optional"/></div>
                      <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}><label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, cursor:'pointer', color: item.isReturn ? C.clay : C.inkSoft }}><input type="checkbox" checked={item.isReturn} onChange={e=>updateItem(item.id,{isReturn:e.target.checked})} style={{ accentColor:C.clay }}/>Mark as return</label></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            <button style={S.addChip} onClick={()=>addItem('purchase')}><Plus size={13}/> Purchase</button>
            <button style={S.addChip} onClick={()=>addItem('stockDraw')}><Plus size={13}/> Shop stock</button>
            <button style={S.addChip} onClick={()=>addItem('other')}><Plus size={13}/> Other</button>
          </div>
          <div style={{ height:1, background:C.border, margin:'16px 0 12px' }} />
          <div style={{ fontSize:11, fontWeight:700, color:C.inkFaint, letterSpacing:'0.06em', marginBottom:8 }}>MISC. EXPENSES</div>
          {misc.length===0&&<Hint>Landfill fees, permit costs, one-off charges.</Hint>}
          {misc.map(e=>(
            <div key={e.id} style={{ border:`1.5px solid ${C.border}`, borderRadius:10, padding:10, marginBottom:8, background:'#fafaf8' }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
                <input style={{ ...S.textInput, flex:2, padding:'9px 10px', fontSize:13 }} placeholder="e.g. Landfill dump fee" value={e.title} onChange={v=>updMisc(e.id,{title:v.target.value})}/>
                <div style={S.numberInputWrap}><input type="number" inputMode="decimal" style={S.numberInput} placeholder="0.00" value={e.amount} onChange={v=>updMisc(e.id,{amount:v.target.value})} onFocus={v=>v.target.select()}/><span style={S.numberSuffix}>$</span></div>
                <button style={{ ...S.removeBtn, padding:4 }} onClick={()=>removeMisc(e.id)}><X size={14}/></button>
              </div>
              <input style={{ ...S.textInput, flex:'unset', width:'100%', padding:'8px 10px', fontSize:12 }} placeholder="Notes (optional)" value={e.notes} onChange={v=>updMisc(e.id,{notes:v.target.value})}/>
            </div>
          ))}
          <button style={S.addChip} onClick={addMisc}><Plus size={13}/> Add misc. expense</button>
        </div>
      )}
    </div>
  );
}

// Equipment/Truck/Trailer panel
function EquipmentPanel({ jobId, equipmentLog, truckLog, trailerLog, rates, equipment, trucks, trailers, actions }) {
  const [open, setOpen] = useState(false);
  const [newEq, setNewEq] = useState({ equipmentId: equipment[0]?.id||'', startMeter:'', endMeter:'' });
  const [newTr, setNewTr] = useState({ truckId: trucks[0]?.id||'', miles:'' });
  const [newTrl, setNewTrl] = useState({ trailerId: (trailers||[])[0]?.id||'', days:'1' });
  const jobEq = equipmentLog.filter(e=>e.jobId===jobId);
  const jobTr = truckLog.filter(t=>t.jobId===jobId);
  const jobTrl = (trailerLog||[]).filter(t=>t.jobId===jobId);
  const totalEqCost = jobEq.reduce((s,e)=>{const hrs=Math.max(0,(Number(e.endMeter)||0)-(Number(e.startMeter)||0));const ei=equipment.find(x=>x.id===e.equipmentId);return s+hrs*(ei?ei.hourlyCost:0);},0);
  const totalTrCost = jobTr.reduce((s,t)=>s+(Number(t.miles)||0)*(rates.mileageRate||0),0);
  const totalTrlCost = jobTrl.reduce((s,t)=>{const ti=(trailers||[]).find(x=>x.id===t.trailerId);return s+(Number(t.days)||0)*(ti?ti.dayRate:0);},0);
  const totalCount = jobEq.length+jobTr.length+jobTrl.length;

  return (
    <div style={S.panelCard}>
      <div style={S.panelHeader} onClick={()=>setOpen(o=>!o)}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Wrench size={16} color={C.primary}/>
          <div><div style={{ fontWeight:700, fontSize:14 }}>Equipment & Trucks</div><div style={{ fontSize:12, color:C.inkFaint }}>{totalCount>0?`${jobEq.length} equip - ${jobTrl.length} trailer - ${jobTr.length} truck - ${fmtMoney2(totalEqCost+totalTrlCost+totalTrCost)}`:'None logged'}</div></div>
        </div>
        {open?<ChevronUp size={18} color="#8a9a8e"/>:<ChevronDown size={18} color="#8a9a8e"/>}
      </div>
      {open&&(
        <div style={S.panelBody}>
          {jobEq.length>0&&<><div style={{ fontSize:11,fontWeight:700,color:C.inkFaint,letterSpacing:'0.06em',marginBottom:6 }}>EQUIPMENT LOG</div>{jobEq.map(e=>{const hrs=Math.max(0,(Number(e.endMeter)||0)-(Number(e.startMeter)||0));const ei=equipment.find(x=>x.id===e.equipmentId);return(<div key={e.id} style={{ ...S.logLine,alignItems:'center' }}><span>{e.date} - {ei?.name||'?'} - {hrs.toFixed(1)}hr - {fmtMoney2(hrs*(ei?.hourlyCost||0))}</span><button style={{ ...S.removeBtn,padding:'2px 4px',marginLeft:4 }} onClick={()=>actions.deleteEquipmentEntry(e.id)}><X size={13}/></button></div>);})}</>}
          <div style={{ marginTop:10 }}><div style={S.hourLabel}>Add equipment</div><div style={{ display:'flex',gap:8,flexWrap:'wrap',marginTop:4 }}><select style={{ ...S.select,flex:'1 1 120px' }} value={newEq.equipmentId} onChange={e=>setNewEq(s=>({...s,equipmentId:e.target.value}))}>{equipment.map(eq=><option key={eq.id} value={eq.id}>{eq.name}</option>)}</select><NumberInput value={newEq.startMeter} onChange={v=>setNewEq(s=>({...s,startMeter:v}))} suffix="start hr"/><NumberInput value={newEq.endMeter} onChange={v=>setNewEq(s=>({...s,endMeter:v}))} suffix="end hr"/><button style={S.btnPrimarySmall} onClick={()=>{actions.addEquipmentEntry({jobId,date:todayStr(),...newEq});setNewEq({equipmentId:equipment[0]?.id||'',startMeter:'',endMeter:''});}}>Add</button></div></div>
          <div style={{ height:1,background:C.border,margin:'14px 0' }}/>
          {jobTrl.length>0&&<><div style={{ fontSize:11,fontWeight:700,color:C.inkFaint,letterSpacing:'0.06em',marginBottom:6 }}>TRAILER LOG</div>{jobTrl.map(t=>{const ti=(trailers||[]).find(x=>x.id===t.trailerId);return(<div key={t.id} style={{ ...S.logLine,alignItems:'center' }}><span>{t.date} - {ti?.name||'?'} - {t.days} day{Number(t.days)!==1?'s':''} - {fmtMoney2((Number(t.days)||0)*(ti?.dayRate||0))}</span><button style={{ ...S.removeBtn,padding:'2px 4px',marginLeft:4 }} onClick={()=>actions.deleteTrailerEntry(t.id)}><X size={13}/></button></div>);})}</>}
          <div style={{ marginTop:10 }}><div style={S.hourLabel}>Add trailer</div><div style={{ display:'flex',gap:8,marginTop:4,flexWrap:'wrap' }}><select style={{ ...S.select,flex:'1 1 120px' }} value={newTrl.trailerId} onChange={e=>setNewTrl(s=>({...s,trailerId:e.target.value}))}>{(trailers||[]).map(t=><option key={t.id} value={t.id}>{t.name} (${t.dayRate}/day)</option>)}</select><NumberInput value={newTrl.days} onChange={v=>setNewTrl(s=>({...s,days:v}))} suffix="days"/><button style={S.btnPrimarySmall} onClick={()=>{actions.addTrailerEntry({jobId,date:todayStr(),...newTrl});setNewTrl({trailerId:(trailers||[])[0]?.id||'',days:'1'});}}>Add</button></div></div>
          <div style={{ height:1,background:C.border,margin:'14px 0' }}/>
          {jobTr.length>0&&<><div style={{ fontSize:11,fontWeight:700,color:C.inkFaint,letterSpacing:'0.06em',marginBottom:6 }}>TRUCK LOG</div>{jobTr.map(t=>{const tr=trucks.find(x=>x.id===t.truckId);return(<div key={t.id} style={{ ...S.logLine,alignItems:'center' }}><span>{t.date} - {tr?.name||'?'} - {t.miles}mi - {fmtMoney2((Number(t.miles)||0)*(rates.mileageRate||0))}</span><button style={{ ...S.removeBtn,padding:'2px 4px',marginLeft:4 }} onClick={()=>actions.deleteTruckEntry(t.id)}><X size={13}/></button></div>);})}</>}
          <div style={{ marginTop:10 }}><div style={S.hourLabel}>Add truck mileage</div><div style={{ display:'flex',gap:8,marginTop:4 }}><select style={{ ...S.select,flex:'1 1 120px' }} value={newTr.truckId} onChange={e=>setNewTr(s=>({...s,truckId:e.target.value}))}>{trucks.map(tr=><option key={tr.id} value={tr.id}>{tr.name}</option>)}</select><NumberInput value={newTr.miles} onChange={v=>setNewTr(s=>({...s,miles:v}))} suffix="miles"/><button style={S.btnPrimarySmall} onClick={()=>{actions.addTruckEntry({jobId,date:todayStr(),...newTr});setNewTr({truckId:trucks[0]?.id||'',miles:''});}}>Add</button></div></div>
        </div>
      )}
    </div>
  );
}

function DeleteJobConfirm({ jobName, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button style={{ marginTop:12, width:'100%', padding:'10px 0', background:'transparent', border:'none', color:C.clay, fontSize:14, fontWeight:600, cursor:'pointer', textDecoration:'underline' }} onClick={() => setConfirming(true)}>Delete job</button>;
  return (
    <div style={{ marginTop:12, background:'#fdf3f1', border:`1.5px solid #f0d8d3`, borderRadius:10, padding:'14px 16px' }}>
      <div style={{ fontSize:13.5, fontWeight:600, color:C.clay, marginBottom:10 }}>Delete "{jobName}"? This removes all logged data and cannot be undone.</div>
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ ...S.btnSecondary, flex:1, padding:'10px 0', fontSize:13 }} onClick={() => setConfirming(false)}>Cancel</button>
        <button style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:C.clay, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={onConfirm}>Yes, delete</button>
      </div>
    </div>
  );
}
