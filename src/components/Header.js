import React from 'react';
import { Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { C } from './UI';

export default function Header({ title, onBack, onSettings, showSettings }) {
  const headerStyle = {
    background: C.primaryDark,
    padding: '16px 18px',
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
    position: 'sticky', top: 0, zIndex: 10,
  };
  return (
    <div style={headerStyle}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={onBack || (() => {})}>
          {onBack && <span style={{ color:'#fff', fontSize:14, fontWeight:600 }}>Back</span>}
          {!onBack && (
            <>
              <div style={{ width:38, height:38, borderRadius:8, background:'#ffffff15', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Georgia',serif", fontWeight:700, fontSize:14, color:'#fff' }}>IEL</div>
              <div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:15, lineHeight:1.2 }}>{title || 'Field Cost Log'}</div>
                <div style={{ color:'#ffffff99', fontSize:11 }}>Incredible Edible Landscapes</div>
              </div>
            </>
          )}
          {onBack && title && <span style={{ color:'#ffffffcc', fontSize:15, fontWeight:600 }}>{title}</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {showSettings && (
            <button style={{ background:'transparent', border:'none', color:'#ffffffcc', cursor:'pointer', padding:6 }} onClick={onSettings}>
              <Settings size={17} />
            </button>
          )}
          {!onBack && (
            <button style={{ background:'transparent', border:'none', color:'#ffffff88', cursor:'pointer', padding:'6px 4px', fontSize:12, fontWeight:600 }} onClick={() => signOut(auth)}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
