import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { uid } from '../utils/helpers';
import { Card, FieldLabel, NumberInput, S, C, SectionLabel, Hint, useToast, Toast } from '../components/UI';

export default function SettingsScreen() {
  const app = useApp();
  const { jobs, rates, equipment, trucks, trailers, stockItems, settings, actions, managerUnlocked } = app;
  const [tab, setTab] = useState('jobs');
  const [toast, showToast] = useToast();
  const [newJobName, setNewJobName] = useState('');

  const save = (fn) => { fn(); showToast('Saved'); };

  const addJob = () => {
    if (!newJobName.trim()) return;
    actions.addJob({ name:newJobName.trim(), status:'active', targetMargin:45, bidTotal:0, bidLaborHours:0, notes:'' });
    setNewJobName('');
    showToast('Job added');
  };

  const updJob = (id, patch) => actions.updateJob({ ...jobs.find(j=>j.id===id), ...patch });
  const updStock = (id, patch) => actions.saveStockItems(stockItems.map(s=>s.id===id?{...s,...patch}:s));
  const moveStock = (id, dir) => { const i=stockItems.findIndex(s=>s.id===id),n=i+dir; if(n<0||n>=stockItems.length)return; const a=[...stockItems];[a[i],a[n]]=[a[n],a[i]];actions.saveStockItems(a); };
  const updEquip = (id, patch) => actions.saveEquipment(equipment.map(e=>e.id===id?{...e,...patch}:e));
  const moveEquip = (id, dir) => { const i=equipment.findIndex(e=>e.id===id),n=i+dir; if(n<0||n>=equipment.length)return; const a=[...equipment];[a[i],a[n]]=[a[n],a[i]];actions.saveEquipment(a); };
  const updTrailer = (id, patch) => actions.saveTrailers((trailers||[]).map(t=>t.id===id?{...t,...patch}:t));
  const moveTrailer = (id, dir) => { const i=(trailers||[]).findIndex(t=>t.id===id),n=i+dir; if(n<0||n>=(trailers||[]).length)return; const a=[...(trailers||[])];[a[i],a[n]]=[a[n],a[i]];actions.saveTrailers(a); };
  const updTruck = (id, patch) => actions.saveTrucks(trucks.map(t=>t.id===id?{...t,...patch}:t));

  return (
    <div style={S.screen}>
      <Toast message={toast} />
      <div style={{ fontWeight:700, fontSize:19, marginBottom:4 }}>Settings</div>

      <div style={{ ...S.tabRow, flexWrap:'wrap' }}>
        {['jobs','equipment','stock','manager'].map(t => (
          <button key={t} style={{ ...S.tab, flex:'1 1 80px', ...(tab===t?S.tabActive:{}) }} onClick={() => setTab(t)}>
            {t === 'jobs' ? 'Jobs' : t === 'equipment' ? 'Equipment' : t === 'stock' ? 'Stock' : 'Manager'}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <>
          {jobs.map(job => (
            <Card key={job.id}>
              <input style={S.textInputBig} value={job.name} onChange={e=>updJob(job.id,{name:e.target.value})} />
              <div style={S.settingsGrid}>
                <div><div style={S.hourLabel}>Bid total ($)</div><NumberInput value={job.bidTotal} onChange={v=>updJob(job.id,{bidTotal:v})} suffix="$" /></div>
                <div><div style={S.hourLabel}>Target margin (%)</div><NumberInput value={job.targetMargin} onChange={v=>updJob(job.id,{targetMargin:v})} suffix="%" /></div>
                <div><div style={S.hourLabel}>Target labor hrs</div><NumberInput value={job.bidLaborHours} onChange={v=>updJob(job.id,{bidLaborHours:v})} suffix="hrs" /></div>
                <div><div style={S.hourLabel}>Status</div><select style={{ ...S.select, flex:'unset', width:'100%' }} value={job.status} onChange={e=>updJob(job.id,{status:e.target.value})}><option value="active">Active</option><option value="complete">Complete</option></select></div>
                <div style={{ gridColumn:'span 2' }}><div style={S.hourLabel}>Notes</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={job.notes||''} onChange={e=>updJob(job.id,{notes:e.target.value})} placeholder="Start date, gate code, client notes..." /></div>
              </div>
            </Card>
          ))}
          <Card>
            <FieldLabel>Add a job</FieldLabel>
            <div style={{ display:'flex', gap:8 }}>
              <input style={{ ...S.textInput, flex:2 }} placeholder="Client first and last name" value={newJobName} onChange={e=>setNewJobName(e.target.value)} />
              <button style={S.btnPrimarySmall} onClick={addJob}>Add</button>
            </div>
          </Card>
        </>
      )}

      {tab === 'equipment' && (
        <>
          <SectionLabel>EQUIPMENT</SectionLabel>
          {equipment.map((eq,i) => (
            <Card key={eq.id}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button style={S.reorderBtn} onClick={()=>moveEquip(eq.id,-1)} disabled={i===0}>^</button>
                  <button style={S.reorderBtn} onClick={()=>moveEquip(eq.id,1)} disabled={i===equipment.length-1}>v</button>
                </div>
                <input style={{ ...S.textInputBig, flex:1, marginBottom:0 }} value={eq.name} onChange={e=>updEquip(eq.id,{name:e.target.value})} />
                <button style={S.deleteBtnSmall} onClick={()=>actions.saveEquipment(equipment.filter(x=>x.id!==eq.id))}><X size={15}/></button>
              </div>
              <div style={S.hourLabel}>Hourly cost</div>
              <NumberInput value={eq.hourlyCost} onChange={v=>updEquip(eq.id,{hourlyCost:Number(v)||0})} suffix="$/hr" />
            </Card>
          ))}
          <button style={S.addChip} onClick={()=>actions.saveEquipment([...equipment,{id:uid('eq'),name:'New equipment',hourlyCost:0}])}><Plus size={13}/> Add equipment</button>

          <SectionLabel style={{ marginTop:20 }}>TRAILERS</SectionLabel>
          {(trailers||[]).map((tr,i) => (
            <Card key={tr.id}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button style={S.reorderBtn} onClick={()=>moveTrailer(tr.id,-1)} disabled={i===0}>^</button>
                  <button style={S.reorderBtn} onClick={()=>moveTrailer(tr.id,1)} disabled={i===(trailers||[]).length-1}>v</button>
                </div>
                <input style={{ ...S.textInputBig, flex:1, marginBottom:0 }} value={tr.name} onChange={e=>updTrailer(tr.id,{name:e.target.value})} />
                <button style={S.deleteBtnSmall} onClick={()=>actions.saveTrailers((trailers||[]).filter(x=>x.id!==tr.id))}><X size={15}/></button>
              </div>
              <div style={S.hourLabel}>Day rate (depreciation-based)</div>
              <NumberInput value={tr.dayRate} onChange={v=>updTrailer(tr.id,{dayRate:Number(v)||0})} suffix="$/day" />
            </Card>
          ))}
          <button style={S.addChip} onClick={()=>actions.saveTrailers([...(trailers||[]),{id:uid('trailer'),name:'New Trailer',dayRate:0}])}><Plus size={13}/> Add trailer</button>

          <SectionLabel style={{ marginTop:20 }}>TRUCKS</SectionLabel>
          {trucks.map((tr,i) => (
            <Card key={tr.id}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input style={{ ...S.textInputBig, flex:1, marginBottom:0 }} value={tr.name} onChange={e=>updTruck(tr.id,{name:e.target.value})} />
                <button style={S.deleteBtnSmall} onClick={()=>actions.saveTrucks(trucks.filter(x=>x.id!==tr.id))}><X size={15}/></button>
              </div>
            </Card>
          ))}
          <button style={S.addChip} onClick={()=>actions.saveTrucks([...trucks,{id:uid('truck'),name:'New Truck'}])}><Plus size={13}/> Add truck</button>

          <SectionLabel style={{ marginTop:20 }}>MILEAGE RATE</SectionLabel>
          <Card>
            <FieldLabel>Cost per mile (diesel trucks)</FieldLabel>
            <NumberInput value={rates.mileageRate} onChange={v=>actions.saveRates({...rates,mileageRate:Number(v)||0})} suffix="$/mile" />
          </Card>
        </>
      )}

      {tab === 'stock' && (
        <>
          {stockItems.map((item,i) => (
            <Card key={item.id}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button style={S.reorderBtn} onClick={()=>moveStock(item.id,-1)} disabled={i===0}>^</button>
                  <button style={S.reorderBtn} onClick={()=>moveStock(item.id,1)} disabled={i===stockItems.length-1}>v</button>
                </div>
                <input style={{ ...S.textInputBig, flex:1, marginBottom:0 }} value={item.name} onChange={e=>updStock(item.id,{name:e.target.value})} />
                <button style={S.deleteBtnSmall} onClick={()=>actions.saveStockItems(stockItems.filter(s=>s.id!==item.id))}><X size={15}/></button>
              </div>
              <div style={S.settingsGrid}>
                <div><div style={S.hourLabel}>Avg unit cost</div><NumberInput value={item.avgUnitCost} onChange={v=>updStock(item.id,{avgUnitCost:Number(v)||0})} suffix={`$/${item.unit}`} /></div>
                <div><div style={S.hourLabel}>Unit</div><input style={{ ...S.textInput, flex:'unset', width:'100%' }} value={item.unit} onChange={e=>updStock(item.id,{unit:e.target.value})} /></div>
              </div>
            </Card>
          ))}
          <button style={S.addChip} onClick={()=>actions.saveStockItems([...stockItems,{id:uid('stock'),name:'New item',unit:'unit',avgUnitCost:0}])}><Plus size={13}/> Add stock item</button>
        </>
      )}

      {tab === 'manager' && <ManagerSettings settings={settings} actions={actions} managerUnlocked={managerUnlocked} />}
    </div>
  );
}

function ManagerSettings({ settings, actions, managerUnlocked }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [csr, setCsr] = useState(settings.csr || '');
  const [msg, setMsg] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const { actions: appActions } = useApp();

  const savePin = () => {
    if (!pin || pin !== confirmPin) { setMsg('PINs do not match'); return; }
    if (pin.length < 4) { setMsg('PIN must be at least 4 digits'); return; }
    actions.saveSettings({ ...settings, managerPin: pin });
    setPin(''); setConfirmPin(''); setMsg('Manager PIN saved');
  };

  const saveCsr = () => {
    actions.saveSettings({ ...settings, csr });
    setMsg('CSR name saved');
  };

  if (!managerUnlocked && settings.managerPin) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'32px 20px', gap:12 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>Enter manager PIN to access settings</div>
        <input type="password" inputMode="numeric" style={{ ...S.textInput, width:'100%', maxWidth:200, textAlign:'center', fontSize:24, letterSpacing:8, flex:'unset' }}
          placeholder="PIN" value={unlockPin} onChange={e=>{setUnlockPin(e.target.value);setMsg('');}} onClick={e=>e.target.focus()} />
        {msg && <div style={{ color:C.clay, fontSize:13 }}>{msg}</div>}
        <button style={{ ...S.btnPrimary, flex:'unset', width:'100%', maxWidth:200 }} onClick={() => { const ok=appActions.unlockManager(unlockPin); if(!ok){setMsg('Incorrect PIN');setUnlockPin('');} }}>Unlock</button>
      </div>
    );
  }

  return (
    <>
      {msg && <div style={{ background:'#f0f7f3', borderRadius:10, padding:'10px 14px', fontSize:13, color:C.primary, marginBottom:12 }}>{msg}</div>}
      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Manager PIN</div>
        <Hint>Set a PIN that gates access to pay rates, bonus calculations, and reports.</Hint>
        <div style={{ marginTop:12 }}>
          <div style={S.hourLabel}>New PIN (4+ digits)</div>
          <input type="password" inputMode="numeric" style={{ ...S.textInput, flex:'unset', width:'100%', marginBottom:10 }} value={pin} onChange={e=>setPin(e.target.value)} onClick={e=>e.target.focus()} />
          <div style={S.hourLabel}>Confirm PIN</div>
          <input type="password" inputMode="numeric" style={{ ...S.textInput, flex:'unset', width:'100%', marginBottom:12 }} value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} onClick={e=>e.target.focus()} />
          <button style={{ ...S.btnPrimary, width:'100%', padding:'12px 0', fontSize:14 }} onClick={savePin}>Save PIN</button>
        </div>
      </Card>
      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>CSR Name</div>
        <Hint>The CSR receives 10% of the company's 50% FEV share (5% of total FEV value).</Hint>
        <div style={{ marginTop:12 }}>
          <input style={{ ...S.textInput, flex:'unset', width:'100%', marginBottom:10 }} placeholder="CSR name" value={csr} onChange={e=>setCsr(e.target.value)} />
          <button style={{ ...S.btnPrimarySmall, width:'100%', padding:'12px 0', fontSize:14 }} onClick={saveCsr}>Save</button>
        </div>
      </Card>
      <button style={{ marginTop:8, width:'100%', padding:'10px 0', background:'transparent', border:'none', color:C.clay, fontSize:13, fontWeight:600, cursor:'pointer' }}
        onClick={appActions.lockManager}>Lock manager access</button>
    </>
  );
}
