import React, { useState, useRef } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const S = {
  screen: { minHeight:'100vh', background:'#f7f5f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', fontFamily:"'Source Sans Pro','Segoe UI',system-ui,sans-serif" },
  logo: { width:64, height:64, borderRadius:16, background:'#244a3b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Georgia',serif", fontWeight:700, fontSize:22, color:'#fff', marginBottom:16 },
  card: { background:'#fff', borderRadius:16, border:'1px solid #e2e0d6', padding:'24px 20px', width:'100%', maxWidth:380 },
  label: { fontSize:12, fontWeight:700, color:'#5c6b56', marginBottom:5, display:'block', letterSpacing:'0.04em' },
  input: { width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid #e2e0d6', fontSize:16, color:'#22301f', background:'#fff', marginBottom:14, boxSizing:'border-box', fontFamily:'inherit', WebkitAppearance:'none' },
  btn: { width:'100%', padding:'14px 0', borderRadius:10, border:'none', background:'#2f5d4a', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', marginTop:4 },
  error: { background:'#fdf0e8', border:'1px solid #f0d8d3', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#9c4a26', marginBottom:14 },
};

export default function Login() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passRef = useRef(null);

  const focus = (ref) => { if(ref.current){ref.current.focus();setTimeout(()=>{if(ref.current)ref.current.focus();},50);} };

  const handle = async () => {
    setError(''); setLoading(true);
    try {
      if (mode==='signin') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch(e) {
      const msgs = { 'auth/user-not-found':'No account found.', 'auth/wrong-password':'Incorrect password.', 'auth/email-already-in-use':'Account already exists.', 'auth/weak-password':'Password must be at least 6 characters.', 'auth/invalid-email':'Invalid email address.', 'auth/invalid-credential':'Incorrect email or password.' };
      setError(msgs[e.code]||e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.screen}>
      <div style={S.logo}>IEL</div>
      <div style={{ fontWeight:800, fontSize:22, color:'#22301f', marginBottom:4 }}>Field Cost Log</div>
      <div style={{ fontSize:13.5, color:'#8a9a8e', marginBottom:32 }}>Incredible Edible Landscapes</div>
      <div style={S.card}>
        <div style={{ fontWeight:700, fontSize:16, color:'#22301f', marginBottom:18 }}>{mode==='signin'?'Sign in':'Create account'}</div>
        {error && <div style={S.error}>{error}</div>}
        <label style={S.label} htmlFor="iel-email">EMAIL</label>
        <input id="iel-email" ref={emailRef} style={S.input} type="email" inputMode="email" placeholder="you@example.com" value={email}
          onChange={e=>setEmail(e.target.value)} onTouchEnd={()=>focus(emailRef)} onClick={()=>focus(emailRef)}
          onKeyDown={e=>e.key==='Enter'&&passRef.current&&passRef.current.focus()} autoCapitalize="none" autoCorrect="off" autoComplete="email" spellCheck="false" />
        <label style={S.label} htmlFor="iel-pass">PASSWORD</label>
        <input id="iel-pass" ref={passRef} style={S.input} type="password" placeholder="Password" value={password}
          onChange={e=>setPassword(e.target.value)} onTouchEnd={()=>focus(passRef)} onClick={()=>focus(passRef)}
          onKeyDown={e=>e.key==='Enter'&&handle()} autoComplete="current-password" />
        <button style={{ ...S.btn, opacity:loading?0.6:1 }} onClick={handle} disabled={loading}>
          {loading?'Please wait...':(mode==='signin'?'Sign in':'Create account')}
        </button>
        <div style={{ marginTop:16, textAlign:'center', fontSize:13.5, color:'#8a9a8e' }}>
          {mode==='signin'
            ? <>First time? <span style={{ color:'#2f5d4a', fontWeight:600, cursor:'pointer', textDecoration:'underline' }} onClick={()=>{setMode('signup');setError('');}}>Create account</span></>
            : <>Already have one? <span style={{ color:'#2f5d4a', fontWeight:600, cursor:'pointer', textDecoration:'underline' }} onClick={()=>{setMode('signin');setError('');}}>Sign in</span></>}
        </div>
      </div>
      <div style={{ marginTop:24, fontSize:12, color:'#aaa', textAlign:'center', maxWidth:300 }}>Each device signs in once and stays logged in.</div>
    </div>
  );
}
