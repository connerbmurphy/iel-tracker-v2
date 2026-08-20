import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import App from './App';
import Login from './Login';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  componentDidCatch(error, info) { this.setState({ error: error.message + '\n' + info.componentStack }); }
  render() {
    if (this.state.error) return (
      <div style={{ padding:20, fontFamily:'monospace', fontSize:12, background:'#fff', minHeight:'100vh' }}>
        <div style={{ color:'#b8502f', fontWeight:700, fontSize:16, marginBottom:12 }}>App Error</div>
        <pre style={{ whiteSpace:'pre-wrap', color:'#333' }}>{this.state.error}</pre>
        <button style={{ marginTop:16, padding:'10px 20px', background:'#2f5d4a', color:'#fff', border:'none', borderRadius:8, cursor:'pointer' }} onClick={() => this.setState({ error: null })}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}

function Root() {
  const [user, setUser] = useState(undefined);
  const [minWait, setMinWait] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinWait(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null));
    return unsub;
  }, []);

  if (user === undefined || !minWait) return (
    <div style={{ minHeight:'100vh', background:'#f7f5f0', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, fontFamily:'sans-serif' }}>
      <div style={{ width:48, height:48, borderRadius:12, background:'#244a3b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontWeight:700, fontSize:18, color:'#fff' }}>IEL</div>
      <div style={{ color:'#8a9a8e', fontSize:13 }}>Loading...</div>
    </div>
  );

  if (!user) return <Login />;
  return <App accountId={user.uid} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <Root />
  </ErrorBoundary>
);
