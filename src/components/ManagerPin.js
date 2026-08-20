import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { C, S } from './UI';

export default function ManagerPinGate({ children }) {
  const { managerUnlocked, settings, actions } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!settings.managerPin) {
    return (
      <div style={{ padding:20, background:'#fdf0e8', borderRadius:12, margin:'16px 0', fontSize:13, color:'#9c4a26' }}>
        No manager PIN set. Go to Settings to set one first.
      </div>
    );
  }

  if (managerUnlocked) return children;

  const attempt = () => {
    const ok = actions.unlockManager(pin);
    if (!ok) { setError('Incorrect PIN'); setPin(''); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'32px 20px', gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:16, background:C.primaryDark, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Lock size={24} color="#fff" />
      </div>
      <div style={{ fontWeight:700, fontSize:17, color:C.ink }}>Manager access required</div>
      <div style={{ fontSize:13, color:C.inkFaint, textAlign:'center' }}>Enter your manager PIN to view this section.</div>
      {error && <div style={{ color:C.clay, fontSize:13, fontWeight:600 }}>{error}</div>}
      <input
        type="password" inputMode="numeric" pattern="[0-9]*"
        style={{ ...S.textInput, width:'100%', maxWidth:200, textAlign:'center', fontSize:24, letterSpacing:8, flex:'unset' }}
        placeholder="PIN"
        value={pin}
        onChange={e => { setPin(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && attempt()}
        onClick={e => e.target.focus()}
      />
      <button style={{ ...S.btnPrimary, flex:'unset', width:'100%', maxWidth:200 }} onClick={attempt}>Unlock</button>
    </div>
  );
}
