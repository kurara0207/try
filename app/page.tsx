'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';

// ─── Types ────────────────────────────────────────────────────────────────────
type Item     = { name: string; price: number };
type LogoMode = 'preset' | 'text' | 'upload';
type AppData  = {
  store: string; address: string; items: Item[]; motto: string;
  guests: number; logoMode: LogoMode; logoText: string;
  logoPreset: string; orderNo: string;
};

function enc(d: AppData) { return btoa(unescape(encodeURIComponent(JSON.stringify(d)))); }
function dec(s: string): AppData | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

// ─── EAN-13 barcode ───────────────────────────────────────────────────────────
const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
function makeEAN(digits: string): string {
  const d = (digits + '000000000000').replace(/\D/g,'0').slice(0,12);
  let b = '101';
  for (let i=0;i<6;i++) b += EAN_L[+d[i]];
  b += '01010';
  for (let i=6;i<12;i++) b += EAN_L[+d[i]].split('').map(c=>c==='1'?'0':'1').join('');
  return b + '101';
}

// ─── Pixel SVG presets (32×32 grid, clean line-art style like ref image 1) ────
const PRESETS = [
  { id:'drip',    label:'手冲壶', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="0" w="2" h="1"/><rect x="15" y="0" width="2" height="1" fill="currentColor"/>
    <rect x="11" y="1" width="2" height="1" fill="currentColor"/><rect x="17" y="1" width="2" height="1" fill="currentColor"/>
    <rect x="11" y="2" width="2" height="1" fill="currentColor"/><rect x="17" y="2" width="2" height="1" fill="currentColor"/>
    <rect x="8" y="3" width="16" height="1" fill="currentColor"/>
    <rect x="7" y="4" width="2" height="1" fill="currentColor"/><rect x="23" y="4" width="2" height="1" fill="currentColor"/>
    <rect x="6" y="5" width="2" height="8" fill="currentColor"/><rect x="24" y="5" width="2" height="8" fill="currentColor"/>
    <rect x="24" y="5" width="5" height="1" fill="currentColor"/><rect x="29" y="6" width="1" height="4" fill="currentColor"/><rect x="24" y="10" width="5" height="1" fill="currentColor"/>
    <rect x="7" y="13" width="18" height="1" fill="currentColor"/>
    <rect x="5" y="14" width="22" height="1" fill="currentColor"/>
    <rect x="4" y="15" width="24" height="8" fill="currentColor"/>
    <rect x="5" y="16" width="22" height="6" fill="none"/>
    <rect x="5" y="16" width="22" height="6" fill="white" opacity="0.15"/>
    <rect x="4" y="23" width="24" height="1" fill="currentColor"/>
    <rect x="5" y="24" width="22" height="1" fill="currentColor"/>
    <rect x="6" y="25" width="20" height="1" fill="currentColor"/>
    <rect x="3" y="26" width="26" height="1" fill="currentColor"/>
    <rect x="2" y="27" width="28" height="2" fill="currentColor"/>
  </svg>` },
  { id:'bag',     label:'咖啡袋', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="0" width="10" height="2" fill="currentColor"/>
    <rect x="9" y="2" width="14" height="1" fill="currentColor"/>
    <rect x="7" y="3" width="18" height="22" fill="currentColor"/>
    <rect x="8" y="4" width="16" height="20" fill="white" opacity="0.12"/>
    <rect x="10" y="6" width="12" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="11" y="13" width="10" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="13" y="15" width="6" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1"/>
    <rect x="7" y="25" width="18" height="2" fill="currentColor"/>
    <rect x="8" y="27" width="16" height="2" fill="currentColor"/>
    <rect x="9" y="29" width="14" height="2" fill="currentColor"/>
  </svg>` },
  { id:'cup',     label:'咖啡杯', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="1" width="2" height="3" fill="currentColor"/><rect x="14" y="0" width="2" height="3" fill="currentColor"/>
    <rect x="4" y="5" width="20" height="1" fill="currentColor"/>
    <rect x="3" y="6" width="22" height="14" fill="currentColor"/>
    <rect x="4" y="7" width="20" height="12" fill="white" opacity="0.12"/>
    <rect x="25" y="8" width="3" height="1" fill="currentColor"/><rect x="28" y="9" width="2" height="6" fill="currentColor"/><rect x="25" y="15" width="3" height="1" fill="currentColor"/>
    <rect x="4" y="20" width="20" height="1" fill="currentColor"/>
    <rect x="5" y="21" width="18" height="1" fill="currentColor"/>
    <rect x="2" y="22" width="24" height="2" fill="currentColor"/>
    <rect x="0" y="24" width="28" height="2" fill="currentColor"/>
  </svg>` },
  { id:'latte',   label:'拿铁', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="0" width="10" height="2" fill="currentColor"/>
    <rect x="9" y="2" width="14" height="1" fill="currentColor"/>
    <rect x="8" y="3" width="16" height="20" fill="currentColor"/>
    <rect x="9" y="4" width="14" height="18" fill="white" opacity="0.1"/>
    <rect x="9" y="4" width="14" height="4" fill="white" opacity="0.25"/>
    <rect x="24" y="8" width="4" height="1" fill="currentColor"/><rect x="28" y="9" width="2" height="8" fill="currentColor"/><rect x="24" y="17" width="4" height="1" fill="currentColor"/>
    <rect x="8" y="23" width="16" height="1" fill="currentColor"/>
    <rect x="9" y="24" width="14" height="1" fill="currentColor"/>
    <rect x="6" y="25" width="20" height="2" fill="currentColor"/>
    <rect x="5" y="27" width="22" height="2" fill="currentColor"/>
  </svg>` },
  { id:'heart',   label:'爱心', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6"  width="6" height="6" fill="currentColor"/>
    <rect x="8" y="4"  width="6" height="2" fill="currentColor"/>
    <rect x="14" y="3" width="4" height="2" fill="currentColor"/>
    <rect x="18" y="4" width="6" height="2" fill="currentColor"/>
    <rect x="24" y="6" width="6" height="6" fill="currentColor"/>
    <rect x="2"  y="12" width="28" height="6" fill="currentColor"/>
    <rect x="4"  y="18" width="24" height="4" fill="currentColor"/>
    <rect x="6"  y="22" width="20" height="4" fill="currentColor"/>
    <rect x="8"  y="26" width="16" height="3" fill="currentColor"/>
    <rect x="10" y="29" width="12" height="2" fill="currentColor"/>
    <rect x="13" y="31" width="6"  height="1" fill="currentColor"/>
  </svg>` },
  { id:'bread',   label:'面包', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="6"  y="4"  width="20" height="2" fill="currentColor"/>
    <rect x="3"  y="6"  width="26" height="2" fill="currentColor"/>
    <rect x="1"  y="8"  width="30" height="14" fill="currentColor"/>
    <rect x="2"  y="9"  width="28" height="12" fill="white" opacity="0.1"/>
    <rect x="3"  y="10" width="6"  height="5" fill="white" opacity="0.2"/>
    <rect x="13" y="9"  width="8"  height="6" fill="white" opacity="0.2"/>
    <rect x="23" y="10" width="5"  height="4" fill="white" opacity="0.2"/>
    <rect x="1"  y="22" width="30" height="3" fill="currentColor"/>
    <rect x="3"  y="25" width="26" height="2" fill="currentColor"/>
    <rect x="6"  y="27" width="20" height="2" fill="currentColor"/>
  </svg>` },
  { id:'cake',    label:'蛋糕', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="2" width="6" height="4" fill="currentColor"/>
    <rect x="8"  y="6" width="16" height="2" fill="currentColor"/>
    <rect x="5"  y="8" width="22" height="8" fill="currentColor"/>
    <rect x="6"  y="9" width="4"  height="4" fill="white" opacity="0.25"/>
    <rect x="14" y="9" width="4"  height="4" fill="white" opacity="0.25"/>
    <rect x="22" y="9" width="4"  height="4" fill="white" opacity="0.25"/>
    <rect x="4"  y="16" width="24" height="2" fill="currentColor"/>
    <rect x="2"  y="18" width="28" height="8" fill="currentColor"/>
    <rect x="3"  y="19" width="6"  height="4" fill="white" opacity="0.2"/>
    <rect x="13" y="19" width="6"  height="4" fill="white" opacity="0.2"/>
    <rect x="23" y="19" width="6"  height="4" fill="white" opacity="0.2"/>
    <rect x="1"  y="26" width="30" height="3" fill="currentColor"/>
    <rect x="3"  y="29" width="26" height="2" fill="currentColor"/>
  </svg>` },
  { id:'star',    label:'星星', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="1"  width="4" height="6"  fill="currentColor"/>
    <rect x="10" y="7"  width="12" height="4" fill="currentColor"/>
    <rect x="0"  y="10" width="32" height="6"  fill="currentColor"/>
    <rect x="4"  y="16" width="24" height="4"  fill="currentColor"/>
    <rect x="2"  y="19" width="12" height="6"  fill="currentColor"/>
    <rect x="18" y="19" width="12" height="6"  fill="currentColor"/>
    <rect x="0"  y="24" width="10" height="4"  fill="currentColor"/>
    <rect x="22" y="24" width="10" height="4"  fill="currentColor"/>
    <rect x="10" y="23" width="4"  height="8"  fill="currentColor"/>
    <rect x="18" y="23" width="4"  height="8"  fill="currentColor"/>
  </svg>` },
  { id:'flower',  label:'花朵', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="0"  width="4" height="5"  fill="currentColor"/>
    <rect x="14" y="27" width="4" height="5"  fill="currentColor"/>
    <rect x="0"  y="14" width="5" height="4"  fill="currentColor"/>
    <rect x="27" y="14" width="5" height="4"  fill="currentColor"/>
    <rect x="4"  y="4"  width="5" height="5"  fill="currentColor"/>
    <rect x="23" y="4"  width="5" height="5"  fill="currentColor"/>
    <rect x="4"  y="23" width="5" height="5"  fill="currentColor"/>
    <rect x="23" y="23" width="5" height="5"  fill="currentColor"/>
    <rect x="9"  y="2"  width="14" height="7" fill="currentColor"/>
    <rect x="9"  y="23" width="14" height="7" fill="currentColor"/>
    <rect x="2"  y="9"  width="7" height="14" fill="currentColor"/>
    <rect x="23" y="9"  width="7" height="14" fill="currentColor"/>
    <rect x="9"  y="9"  width="14" height="14" fill="currentColor"/>
    <rect x="11" y="11" width="10" height="10" fill="white" opacity="0.2"/>
    <rect x="13" y="13" width="6"  height="6"  fill="currentColor"/>
  </svg>` },
  { id:'ramen',   label:'拉面', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="6"  y="2"  width="3" height="4"  fill="currentColor"/>
    <rect x="14" y="1"  width="3" height="5"  fill="currentColor"/>
    <rect x="22" y="2"  width="3" height="3"  fill="currentColor"/>
    <rect x="2"  y="6"  width="28" height="3" fill="currentColor"/>
    <rect x="1"  y="9"  width="30" height="14" fill="currentColor"/>
    <rect x="2"  y="10" width="28" height="12" fill="white" opacity="0.1"/>
    <rect x="3"  y="11" width="8"  height="2"  fill="currentColor" opacity="0.6"/>
    <rect x="14" y="11" width="10" height="2"  fill="currentColor" opacity="0.6"/>
    <rect x="5"  y="14" width="14" height="2"  fill="currentColor" opacity="0.6"/>
    <rect x="22" y="14" width="6"  height="2"  fill="currentColor" opacity="0.6"/>
    <rect x="2"  y="23" width="28" height="3" fill="currentColor"/>
    <rect x="3"  y="26" width="26" height="2" fill="currentColor"/>
    <rect x="5"  y="28" width="22" height="2" fill="currentColor"/>
    <rect x="8"  y="30" width="16" height="2" fill="currentColor"/>
  </svg>` },
  { id:'cat',     label:'猫咪', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="2"  y="2"  width="6" height="8"  fill="currentColor"/>
    <rect x="24" y="2"  width="6" height="8"  fill="currentColor"/>
    <rect x="2"  y="8"  width="28" height="16" fill="currentColor"/>
    <rect x="0"  y="10" width="32" height="12" fill="currentColor"/>
    <rect x="4"  y="12" width="4"  height="5"  fill="white" opacity="0.9"/>
    <rect x="24" y="12" width="4"  height="5"  fill="white" opacity="0.9"/>
    <rect x="12" y="16" width="8"  height="2"  fill="white" opacity="0.5"/>
    <rect x="14" y="18" width="4"  height="2"  fill="white" opacity="0.5"/>
    <rect x="5"  y="18" width="5"  height="2"  fill="white" opacity="0.4"/>
    <rect x="22" y="18" width="5"  height="2"  fill="white" opacity="0.4"/>
    <rect x="2"  y="22" width="28" height="4"  fill="currentColor"/>
    <rect x="3"  y="26" width="8"  height="5"  fill="currentColor"/>
    <rect x="21" y="26" width="8"  height="5"  fill="currentColor"/>
  </svg>` },
  { id:'gift',    label:'礼物', svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="6"  y="0"  width="6" height="6"  fill="currentColor"/><rect x="14" y="2"  width="6" height="4"  fill="currentColor"/>
    <rect x="4"  y="6"  width="24" height="4"  fill="currentColor"/>
    <rect x="14" y="0"  width="4" height="10" fill="currentColor"/>
    <rect x="2"  y="10" width="28" height="18" fill="currentColor"/>
    <rect x="3"  y="11" width="26" height="16" fill="white" opacity="0.1"/>
    <rect x="14" y="10" width="4" height="18" fill="currentColor" opacity="0.5"/>
    <rect x="2"  y="28" width="28" height="3"  fill="currentColor"/>
  </svg>` },
];

// ─── iOS-safe image: FileReader already gives base64, but handle blob URLs ────
function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    if (src.startsWith('data:')) { resolve(src); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      try { resolve(c.toDataURL('image/png')); } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

const INP = "border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 w-full text-sm bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><label className="text-xs text-gray-400 mb-1.5 block font-medium">{label}</label>{children}</div>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const receiptRef    = useRef<HTMLDivElement>(null);
  const logoInputRef  = useRef<HTMLInputElement>(null);

  const [store,      setStore]      = useState('LOVE STORE');
  const [address,    setAddress]    = useState('');
  const [logoMode,   setLogoMode]   = useState<LogoMode>('preset');
  const [logoText,   setLogoText]   = useState('♥');
  const [logoPreset, setLogoPreset] = useState('drip');
  const [logoImg,    setLogoImg]    = useState<string|null>(null);
  const [guests,     setGuests]     = useState(2);
  const [items,      setItems]      = useState<Item[]>([
    { name: '拥抱', price: 0 },
    { name: '冷战', price: 99 },
    { name: '复合', price: 999 },
  ]);
  const [motto,      setMotto]      = useState('原来我在你这里的价格，\n是这样算的。');
  const [orderNo,    setOrderNo]    = useState(() => Math.random().toString(36).slice(2,10).toUpperCase());
  const [copied,     setCopied]     = useState(false);
  const [exporting,  setExporting]  = useState(false);

  // Load URL state
  useEffect(() => {
    const d = dec(new URLSearchParams(window.location.search).get('data') ?? '');
    if (!d) return;
    if (d.store)      setStore(d.store);
    if (d.address)    setAddress(d.address);
    if (d.items)      setItems(d.items);
    if (d.motto)      setMotto(d.motto);
    if (d.guests)     setGuests(d.guests);
    if (d.logoMode)   setLogoMode(d.logoMode);
    if (d.logoText)   setLogoText(d.logoText);
    if (d.logoPreset) setLogoPreset(d.logoPreset);
    if (d.orderNo)    setOrderNo(d.orderNo);
  }, []);

  const addItem    = () => setItems(p => [...p, { name:'', price:0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_,j)=>j!==i));
  const updateItem = (i: number, k: string, v: string) =>
    setItems(p => { const n=[...p]; n[i]={...n[i],[k]:k==='price'?parseFloat(v)||0:v}; return n; });

  const total     = items.reduce((s,x)=>s+(x.price||0), 0);
  const perPerson = guests > 0 ? total/guests : total;

  const generateLink = () => {
    const data = enc({ store, address, items, motto, guests, logoMode, logoText, logoPreset, orderNo });
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?data=${data}`)
      .then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  };

  const exportImage = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      // Ensure uploaded image is base64 (iOS-safe)
      if (logoMode === 'upload' && logoImg && !logoImg.startsWith('data:')) {
        const safe = await loadImageAsBase64(logoImg);
        setLogoImg(safe);
        await new Promise(r => setTimeout(r, 150));
      }
      const url = await toPng(receiptRef.current, {
        cacheBust: true, pixelRatio: 3, backgroundColor: '#f8f4ed',
      });
      const a = document.createElement('a');
      a.download = `${store||'receipt'}.png`;
      a.href = url; a.click();
    } catch(e) {
      console.error(e); alert('导出失败，请重试');
    } finally { setExporting(false); }
  };

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogoImg(ev.target?.result as string); setLogoMode('upload'); };
    reader.readAsDataURL(file); // base64 from start — iOS safe
  }, []);

  const now     = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const barcodeDigits = (orderNo.replace(/\D/g,'0') + '000000000000').slice(0,12);
  const barsBinary    = makeEAN(barcodeDigits);
  const preset        = PRESETS.find(p=>p.id===logoPreset) ?? PRESETS[0];

  // Paper shadow layers — ref image 2 style
  const paperStyle: React.CSSProperties = {
    width: '280px',
    background: '#f8f4ed',
    position: 'relative',
    fontFamily: "'DotGothic16', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', monospace",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DotGothic16&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Ma+Shan+Zheng&display=swap');

        /* DotGothic16: pixel style covering JP/KR/CN/EN */
        .rcpt-wrap {
          font-family: 'DotGothic16','Noto Sans JP','Noto Sans KR','Noto Sans SC',monospace;
          font-size: 10px;
          line-height: 1.8;
          color: #111;
          letter-spacing: 0.03em;
        }
        .rcpt-store  { font-size: 14px; font-weight: 700; letter-spacing: 0.18em; text-align: center; }
        .rcpt-addr   { font-size: 9px;  color: #666; text-align: center; letter-spacing: 0.05em; }
        .rcpt-meta   { font-size: 8px;  color: #888; letter-spacing: 0.06em; }
        .rcpt-item   { font-size: 10px; display:flex; justify-content:space-between; padding:3px 0; }
        .rcpt-total  { font-size: 13px; font-weight:700; display:flex; justify-content:space-between; padding:5px 0; }
        .rcpt-per    { font-size: 8px;  color:#888; display:flex; justify-content:space-between; }
        .rcpt-motto  { font-size: 16px; font-weight:700; text-align:center; line-height:1.6; letter-spacing:0.04em; color:#111; }
        .rcpt-sub    { font-size: 9px;  color:#666; text-align:center; letter-spacing:0.06em; }
        .rcpt-hr     { border:none; border-top:1px dashed #aaa; margin:8px 0; }
        .rcpt-hr-solid { border:none; border-top:1px solid #aaa; margin:6px 0; }
        .logo-hw     { font-family:'Ma Shan Zheng',cursive; font-size:44px; line-height:1; color:#111; text-align:center; }

        /* Control panel */
        .tab-pill { display:flex; background:#f1ede6; border-radius:10px; padding:3px; gap:2px; margin-bottom:12px; }
        .tab-pill button { flex:1; padding:7px 4px; border:none; border-radius:8px; font-size:12px; cursor:pointer; background:transparent; color:#888; transition:all .15s; font-family:inherit; }
        .tab-pill button.on { background:#fff; color:#111; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
        .preset-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
        .preset-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 2px 6px; border-radius:10px; border:2px solid transparent; cursor:pointer; background:transparent; transition:all .15s; }
        .preset-btn:hover  { border-color:#f0c0c8; background:#fff8fa; }
        .preset-btn.on     { border-color:#d4607a; background:#fff0f4; }
        .preset-btn span   { font-size:9px; color:#999; font-family:'DotGothic16',monospace; }
        .preset-btn svg    { display:block; }

        /* Receipt paper shadow — ref image 2 */
        .paper-wrap {
          position: relative;
          filter: drop-shadow(0 2px 12px rgba(0,0,0,0.18)) drop-shadow(0 1px 3px rgba(0,0,0,0.1));
        }
        /* Subtle noise texture overlay */
        .paper-wrap::after {
          content:'';
          position:absolute;
          inset:0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
          pointer-events:none;
          border-radius:2px;
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#f9f5f0 0%,#ede8e0 100%)', display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 16px 80px', fontFamily:"'DotGothic16','Noto Sans JP',sans-serif" }}>

        <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px', letterSpacing:'0.06em', color:'#1a1a1a' }}>🧾 小票情绪生成器</h1>
        <p style={{ fontSize:'11px', color:'#aaa', marginBottom:'28px', letterSpacing:'0.08em' }}>把感情变成一张可以收藏的票据</p>

        {/* ─── Controls ─── */}
        <div style={{ width:'100%', maxWidth:'440px', background:'#fff', borderRadius:'18px', padding:'20px', marginBottom:'36px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', border:'1px solid #ede8e0' }}>

          <Field label="Logo 样式">
            <div className="tab-pill">
              {([['preset','像素预设'],['text','文字/Emoji'],['upload','上传图片']] as [LogoMode,string][]).map(([m,l])=>(
                <button key={m} className={logoMode===m?'on':''} onClick={()=>setLogoMode(m)}>{l}</button>
              ))}
            </div>

            {logoMode==='preset' && (
              <div className="preset-grid">
                {PRESETS.map(p=>(
                  <button key={p.id} className={`preset-btn${logoPreset===p.id?' on':''}`} onClick={()=>setLogoPreset(p.id)}>
                    <span dangerouslySetInnerHTML={{ __html: p.svg }} style={{ width:32, height:32, display:'block', color:'#2a2218' }} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
            {logoMode==='text' && (
              <div>
                <input className={INP} value={logoText} onChange={e=>setLogoText(e.target.value)} placeholder="♥  输入文字或 Emoji" maxLength={6} />
                <p style={{ fontSize:'10px', color:'#bbb', marginTop:'6px' }}>将以毛笔手写风格显示在小票上</p>
              </div>
            )}
            {logoMode==='upload' && (
              <div>
                <button onClick={()=>logoInputRef.current?.click()} style={{ width:'100%', border:'2px dashed #ddd', borderRadius:'12px', padding:'16px', fontSize:'13px', color:'#aaa', cursor:'pointer', background:'transparent', transition:'all .15s' }}>
                  {logoImg ? '✓ 图片已加载 — 点击重新选择' : '📷 点击选择照片'}
                </button>
                {logoImg && <img src={logoImg} alt="" style={{ height:'48px', objectFit:'contain', marginTop:'10px', borderRadius:'8px', border:'1px solid #eee' }} />}
                {logoImg && <button onClick={()=>{setLogoImg(null);if(logoInputRef.current)logoInputRef.current.value='';}} style={{ fontSize:'11px', color:'#e07', marginLeft:'10px', background:'none', border:'none', cursor:'pointer' }}>删除</button>}
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoUpload} />
                <p style={{ fontSize:'10px', color:'#bbb', marginTop:'8px' }}>iOS：选图后稍等片刻再点下载</p>
              </div>
            )}
          </Field>

          <Field label="店铺名称">
            <input className={INP} value={store} onChange={e=>setStore(e.target.value)} placeholder="LOVE STORE" />
          </Field>

          <Field label="地址 / 餐厅 / 城市（选填）">
            <input className={INP} value={address} onChange={e=>setAddress(e.target.value)} placeholder="例：东京·银座 / Café de Paris" />
          </Field>

          <Field label="人数">
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <button onClick={()=>setGuests(g=>Math.max(1,g-1))} style={{ width:'36px', height:'36px', borderRadius:'50%', border:'1.5px solid #ddd', background:'transparent', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>−</button>
              <span style={{ fontSize:'16px', fontWeight:700, minWidth:'24px', textAlign:'center' }}>{guests}</span>
              <button onClick={()=>setGuests(g=>g+1)} style={{ width:'36px', height:'36px', borderRadius:'50%', border:'1.5px solid #ddd', background:'transparent', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>+</button>
              <span style={{ fontSize:'11px', color:'#aaa' }}>人 · 人均 ¥{perPerson.toFixed(2)}</span>
            </div>
          </Field>

          <Field label="商品 / 价格">
            {items.map((item,i)=>(
              <div key={i} style={{ display:'flex', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
                <input className={INP} style={{ flex:1 }} value={item.name} onChange={e=>updateItem(i,'name',e.target.value)} placeholder="商品名" />
                <input className={INP} style={{ width:'88px' }} type="number" value={item.price} onChange={e=>updateItem(i,'price',e.target.value)} placeholder="0" />
                <button onClick={()=>removeItem(i)} style={{ color:'#ddd', fontSize:'22px', background:'none', border:'none', cursor:'pointer', lineHeight:1 }}>×</button>
              </div>
            ))}
            <button onClick={addItem} style={{ fontSize:'12px', color:'#bbb', background:'none', border:'none', cursor:'pointer', marginTop:'4px' }}>＋ 添加一行</button>
          </Field>

          <Field label="票据号（自定义）">
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <input className={INP} value={orderNo} onChange={e=>setOrderNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12))} placeholder="自动生成，可手改" maxLength={12} style={{ flex:1, letterSpacing:'0.15em' }} />
              <button onClick={()=>setOrderNo(Math.random().toString(36).slice(2,10).toUpperCase())} style={{ fontSize:'11px', color:'#bbb', background:'none', border:'1px solid #eee', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>随机</button>
            </div>
          </Field>

          <Field label="底部情绪句（大字压轴）">
            <textarea className={INP} value={motto} onChange={e=>setMotto(e.target.value)} placeholder="写下你想说的话…" style={{ resize:'none', height:'72px', fontSize:'12px', lineHeight:1.7 }} />
          </Field>

          <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
            <button onClick={generateLink} style={{ flex:1, padding:'14px', borderRadius:'14px', fontSize:'13px', fontWeight:700, color:'#fff', background:copied?'#3a9e6a':'#4a7fcc', border:'none', cursor:'pointer', transition:'all .15s', fontFamily:'inherit' }}>
              {copied ? '✓ 链接已复制' : '🔗 分享链接'}
            </button>
            <button onClick={exportImage} disabled={exporting} style={{ flex:1, padding:'14px', borderRadius:'14px', fontSize:'13px', fontWeight:700, color:'#fff', background:'#c0445a', border:'none', cursor:'pointer', opacity:exporting?.6:1, transition:'all .15s', fontFamily:'inherit' }}>
              {exporting ? '生成中…' : '📥 下载小票'}
            </button>
          </div>
        </div>

        {/* ─── Receipt Preview ─── */}
        <div className="paper-wrap">
          <div ref={receiptRef} className="rcpt-wrap" style={paperStyle}>

            {/* Top serrated — ref image 2/3 style */}
            <div style={{ width:'100%', height:'14px', background:'radial-gradient(circle at 50% -1px, #f8f4ed 72%, transparent 72%) 0 0 / 14px 14px repeat-x, #ddd5c8' }} />

            <div style={{ padding:'10px 22px 18px' }}>

              {/* Logo */}
              <div style={{ textAlign:'center', margin:'12px 0 10px' }}>
                {logoMode==='upload' && logoImg
                  ? <img src={logoImg} alt="logo" crossOrigin="anonymous" style={{ height:'64px', maxWidth:'180px', objectFit:'contain', margin:'0 auto', display:'block' }} />
                  : logoMode==='preset'
                    ? <div dangerouslySetInnerHTML={{ __html: preset.svg.replace(/viewBox="0 0 32 32"/, 'viewBox="0 0 32 32" width="64" height="64"') }} style={{ display:'inline-block', color:'#1a1410', lineHeight:0 }} />
                    : <div className="logo-hw">{logoText||'♥'}</div>
                }
              </div>

              {/* Store name — ref image 3: centered, tracked */}
              <div className="rcpt-store" style={{ marginBottom:'3px' }}>{store||'LOVE STORE'}</div>
              {address && <div className="rcpt-addr" style={{ marginBottom:'4px' }}>{address}</div>}

              <hr className="rcpt-hr-solid" style={{ margin:'10px 0 6px' }} />

              {/* Meta row */}
              <div className="rcpt-meta" style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span>{dateStr}　{timeStr}</span>
                <span>GUESTS × {guests}</span>
              </div>
              <div className="rcpt-meta" style={{ marginBottom:'8px' }}>
                <span>ORDER NO.　<span style={{ letterSpacing:'0.15em' }}>{orderNo}</span></span>
              </div>

              <hr className="rcpt-hr" />

              {/* Items — ref image 3 layout */}
              <div style={{ marginBottom:'4px' }}>
                <div className="rcpt-meta" style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', color:'#999' }}>
                  <span>ITEM</span><span>AMOUNT</span>
                </div>
                {items.map((item,i)=>(
                  <div key={i} className="rcpt-item">
                    <span style={{ maxWidth:'60%' }}>{item.name||'---'}</span>
                    <span>¥{(item.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr className="rcpt-hr" />

              <div className="rcpt-total"><span>TOTAL</span><span>¥{total.toFixed(2)}</span></div>
              {guests>1 && <div className="rcpt-per"><span>人均 PER PERSON</span><span>¥{perPerson.toFixed(2)}</span></div>}

              {/* Motto — ref image 3: large bold closing statement */}
              {motto && (
                <>
                  <hr className="rcpt-hr-solid" style={{ margin:'14px 0 16px' }} />
                  <div className="rcpt-motto">
                    {motto.split('\n').map((line,i)=><div key={i}>{line}</div>)}
                  </div>
                </>
              )}

              {/* ─── EAN-13 barcode ─── */}
              <div style={{ textAlign:'center', marginTop:'20px' }}>
                {/* Quiet zone + bars */}
                <div style={{ display:'inline-flex', alignItems:'flex-end', background:'#f8f4ed', padding:'0 8px' }}>
                  {/* Left quiet zone */}
                  <div style={{ width:'6px', height:'56px' }} />
                  {barsBinary.split('').map((bit,i)=>{
                    const isGuard = i<3||(i>=27&&i<=31)||i>91;
                    return (
                      <div key={i} style={{
                        width:'1.8px', height: isGuard?'54px':'44px',
                        background: bit==='1'?'#111':'#f8f4ed',
                        flexShrink:0, alignSelf:'flex-end',
                      }} />
                    );
                  })}
                  {/* Right quiet zone */}
                  <div style={{ width:'6px', height:'56px' }} />
                </div>
                {/* EAN digit groups below barcode */}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'7px', color:'#555', marginTop:'3px', letterSpacing:'0.18em', fontFamily:"'DotGothic16',monospace", padding:'0 8px' }}>
                  <span>{barcodeDigits[0]}</span>
                  <span>{barcodeDigits.slice(1,7).split('').join(' ')}</span>
                  <span>{barcodeDigits.slice(7,12).split('').join(' ')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="rcpt-sub" style={{ marginTop:'14px', borderTop:'1px solid #ddd', paddingTop:'10px' }}>
                made with 💔
              </div>
            </div>

            {/* Bottom serrated */}
            <div style={{ width:'100%', height:'14px', background:'radial-gradient(circle at 50% 101%, #f8f4ed 72%, transparent 72%) 0 0 / 14px 14px repeat-x, #ddd5c8' }} />
          </div>
        </div>

      </div>
    </>
  );
}
