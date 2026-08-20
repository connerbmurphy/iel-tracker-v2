import React from 'react';

export const C = {
  bg: '#f7f5f0', card: '#ffffff', ink: '#22301f', inkSoft: '#5c6b56',
  inkFaint: '#8a9a8e', border: '#e2e0d6', primary: '#2f5d4a',
  primaryDark: '#244a3b', clay: '#b8502f', gold: '#c98a3a',
};

export const S = {
  app: { fontFamily:"'Source Sans Pro','Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:'100vh', color:C.ink, maxWidth:480, margin:'0 auto', position:'relative' },
  body: { padding:'18px 16px 80px' },
  screen: { display:'flex', flexDirection:'column' },
  card: { background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:16, marginBottom:12 },
  sectionLabel: { fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:C.inkFaint, marginBottom:10, marginTop:4 },
  fieldLabel: { display:'flex', alignItems:'center', fontSize:13, fontWeight:700, color:C.ink, marginBottom:10 },
  hint: { fontSize:12, color:C.inkFaint, marginTop:8, lineHeight:1.5 },
  numberInputWrap: { position:'relative', flex:1 },
  numberInput: { width:'100%', padding:'11px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:16, fontWeight:600, color:C.ink, background:'#fcfbf8' },
  numberSuffix: { display:'block', fontSize:10.5, color:C.inkFaint, marginTop:4, fontWeight:500 },
  textInput: { flex:1.4, padding:'11px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:16, color:C.ink, background:'#fff' },
  textInputBig: { width:'100%', padding:'10px 0', border:'none', borderBottom:`2px solid ${C.border}`, fontSize:17, fontWeight:700, color:C.ink, marginBottom:14, background:'transparent' },
  timeInput: { width:'100%', padding:'11px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:16, fontWeight:600, color:C.ink, background:'#fff' },
  select: { flex:1.4, padding:'11px 8px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:14, color:C.ink, background:'#fff' },
  removeBtn: { background:'transparent', border:'none', color:C.inkFaint, cursor:'pointer', padding:8, flexShrink:0 },
  addChip: { display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:20, border:`1.5px dashed ${C.border}`, background:'transparent', color:C.primary, fontSize:12.5, fontWeight:600, cursor:'pointer' },
  hourLabel: { fontSize:11.5, color:C.inkSoft, fontWeight:600, marginBottom:5 },
  settingsGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  bottomBar: { position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, display:'flex', gap:10, padding:'14px 16px', background:C.bg, borderTop:`1px solid ${C.border}`, zIndex:10 },
  btnPrimary: { flex:2, padding:'13px 0', borderRadius:10, border:'none', background:C.primary, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' },
  btnSecondary: { flex:1, padding:'13px 0', borderRadius:10, border:`1.5px solid ${C.border}`, background:'#fff', color:C.ink, fontSize:15, fontWeight:700, cursor:'pointer' },
  btnPrimarySmall: { padding:'10px 16px', borderRadius:9, border:'none', background:C.primary, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  btnDanger: { padding:'10px 16px', borderRadius:9, border:`1.5px solid #f0d8d3`, background:'transparent', color:C.clay, fontSize:13, fontWeight:700, cursor:'pointer' },
  reorderBtn: { background:'transparent', border:`1px solid ${C.border}`, borderRadius:4, color:C.inkFaint, cursor:'pointer', padding:'1px 5px', fontSize:10, lineHeight:1.4, display:'block' },
  deleteBtnSmall: { background:'transparent', border:`1.5px solid #f0d8d3`, borderRadius:8, color:C.clay, cursor:'pointer', padding:'6px 8px', flexShrink:0 },
  warningBanner: { display:'flex', alignItems:'center', background:'#fdf0e8', color:'#9c4a26', padding:'12px 14px', borderRadius:10, fontSize:13, fontWeight:500, marginBottom:14, lineHeight:1.4 },
  infoBanner: { display:'flex', alignItems:'center', background:'#f0f7f3', border:`1px solid #c8e0d4`, borderRadius:10, padding:'10px 14px', fontSize:13, color:C.primary, marginBottom:14, lineHeight:1.5 },
  divider: { height:1, background:C.border, margin:'6px 0' },
  detailRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'9px 0' },
  logEntry: { display:'flex', alignItems:'center', gap:10, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px 13px' },
  crewSelectRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:10, border:'1.5px solid', cursor:'pointer', marginBottom:8 },
  panelCard: { background:C.card, borderRadius:14, border:`1px solid ${C.border}`, marginBottom:10, overflow:'hidden' },
  panelHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' },
  panelBody: { padding:'0 16px 16px', borderTop:`1px solid ${C.border}` },
  qtyTicker: { display:'flex', alignItems:'center', borderRadius:9, border:`1.5px solid ${C.border}`, overflow:'hidden', background:'#fcfbf8' },
  qtyBtn: { background:'transparent', border:'none', color:C.primary, fontWeight:700, fontSize:16, cursor:'pointer', padding:'0 10px', height:40, lineHeight:1, flexShrink:0 },
  qtyInput: { width:32, border:'none', background:'transparent', textAlign:'center', fontSize:14, fontWeight:700, color:C.ink, padding:0 },
  tabRow: { display:'flex', gap:6, marginBottom:16, marginTop:12 },
  tab: { flex:1, padding:'9px 4px', borderRadius:8, border:`1px solid ${C.border}`, background:'#fff', color:C.inkSoft, fontSize:12.5, fontWeight:600, cursor:'pointer' },
  tabActive: { background:C.primary, color:'#fff', border:`1px solid ${C.primary}` },
  matItem: { border:'1.5px solid', borderRadius:10, padding:10, marginBottom:8 },
  matItemHeader: { display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer' },
  logLine: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12.5, color:C.inkSoft, padding:'5px 0', borderBottom:`1px solid #f0ede8` },
};

export function Card({ children, style }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}

export function FieldLabel({ icon: Icon, children }) {
  return <div style={S.fieldLabel}>{Icon && <Icon size={14} style={{ marginRight:6, opacity:0.6 }} />}{children}</div>;
}

export function NumberInput({ value, onChange, suffix, placeholder='0', style={} }) {
  return (
    <div style={{ ...S.numberInputWrap, ...style }}>
      <input type="number" inputMode="decimal" style={S.numberInput} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} onFocus={e => e.target.select()} />
      {suffix && <span style={S.numberSuffix}>{suffix}</span>}
    </div>
  );
}

export function TI({ value, onChange, placeholder='', style={}, type='text', id, ref: _ref }) {
  return <input id={id} type={type} style={{ ...S.textInput, ...style }} value={value}
    placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

export function SectionLabel({ children, style }) {
  return <div style={{ ...S.sectionLabel, ...style }}>{children}</div>;
}

export function Divider() {
  return <div style={S.divider} />;
}

export function Hint({ children }) {
  return <div style={S.hint}>{children}</div>;
}

export function InfoBanner({ children }) {
  return <div style={S.infoBanner}>{children}</div>;
}

export function WarningBanner({ icon: Icon, children }) {
  return <div style={S.warningBanner}>{Icon && <Icon size={16} style={{ marginRight:8, flexShrink:0 }} />}{children}</div>;
}

export function DetailRow({ label, value, sub, bold }) {
  return (
    <div style={S.detailRow}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, color:C.ink, fontWeight: bold ? 700 : 500 }}>{label}</div>
        {sub && <div style={{ fontSize:11.5, color:C.inkFaint, marginTop:2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize:14, color:C.ink, fontWeight: bold ? 700 : 600, textAlign:'right', whiteSpace:'nowrap', marginLeft:12 }}>{value}</div>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position:'fixed', bottom:84, left:'50%', transform:'translateX(-50%)', background:C.ink, color:'#fff', padding:'10px 18px', borderRadius:30, fontSize:13.5, fontWeight:600, display:'flex', alignItems:'center', boxShadow:'0 6px 20px rgba(0,0,0,0.2)', zIndex:20 }}>
      {message}
    </div>
  );
}

export function MarginHero({ margin, targetMargin, fev }) {
  const color = margin >= targetMargin ? '#7dd9a8' : margin >= targetMargin - 5 ? '#f5c97a' : '#f4856a';
  return (
    <div style={{ background:`linear-gradient(135deg, #244a3b, #2f5d4a)`, borderRadius:16, padding:'24px 20px', textAlign:'center', marginBottom:14 }}>
      <div style={{ color:'#ffffff99', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:6 }}>GROSS MARGIN</div>
      <div style={{ fontSize:44, fontWeight:800, lineHeight:1, fontFamily:"'Georgia',serif", color }}>{margin.toFixed(1)}%</div>
      <div style={{ color:'#ffffffcc', fontSize:13, marginTop:8, fontWeight:500 }}>
        {fev ? 'FEV achieved' : `${(targetMargin - margin).toFixed(1)}pt below ${targetMargin}% target`}
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState('');
  const show = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);
  return [toast, show];
}

export const globalCSS = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  input, select, button, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #2f5d4a !important; }
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { margin: 0; }
`;
