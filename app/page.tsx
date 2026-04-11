'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';

// ─── Types ────────────────────────────────────────────────────────────────────
type Item     = { name: string; price: number };
type LogoMode = 'preset' | 'text' | 'upload';
type AppData  = {
  store: string; address: string; items: Item[]; motto: string;
  logoMode: LogoMode; logoText: string; logoPreset: string; orderNo: string;
  taxRate: number; madeWith: string;
  inkColor: string; vintage: boolean; useQR: boolean;
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

// ─── Pixel SVG presets ────────────────────────────────────────────────────────
const PRESETS = [
  { id:'drip',   label:'手冲壶', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="0" width="2" height="1" fill="currentColor"/><rect x="15" y="0" width="2" height="1" fill="currentColor"/><rect x="11" y="1" width="2" height="1" fill="currentColor"/><rect x="17" y="1" width="2" height="1" fill="currentColor"/><rect x="11" y="2" width="2" height="1" fill="currentColor"/><rect x="17" y="2" width="2" height="1" fill="currentColor"/><rect x="8" y="3" width="16" height="1" fill="currentColor"/><rect x="7" y="4" width="2" height="1" fill="currentColor"/><rect x="23" y="4" width="2" height="1" fill="currentColor"/><rect x="6" y="5" width="2" height="8" fill="currentColor"/><rect x="24" y="5" width="2" height="8" fill="currentColor"/><rect x="24" y="5" width="5" height="1" fill="currentColor"/><rect x="29" y="6" width="1" height="4" fill="currentColor"/><rect x="24" y="10" width="5" height="1" fill="currentColor"/><rect x="7" y="13" width="18" height="1" fill="currentColor"/><rect x="5" y="14" width="22" height="1" fill="currentColor"/><rect x="4" y="15" width="24" height="8" fill="currentColor"/><rect x="5" y="16" width="22" height="6" fill="white" opacity="0.15"/><rect x="4" y="23" width="24" height="1" fill="currentColor"/><rect x="5" y="24" width="22" height="1" fill="currentColor"/><rect x="6" y="25" width="20" height="1" fill="currentColor"/><rect x="3" y="26" width="26" height="1" fill="currentColor"/><rect x="2" y="27" width="28" height="2" fill="currentColor"/></svg>` },
  { id:'bag',    label:'咖啡袋', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="11" y="0" width="10" height="2" fill="currentColor"/><rect x="9" y="2" width="14" height="1" fill="currentColor"/><rect x="7" y="3" width="18" height="22" fill="currentColor"/><rect x="8" y="4" width="16" height="20" fill="white" opacity="0.12"/><rect x="10" y="6" width="12" height="2" fill="currentColor" opacity="0.5"/><rect x="11" y="13" width="10" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="15" width="6" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1"/><rect x="7" y="25" width="18" height="2" fill="currentColor"/><rect x="8" y="27" width="16" height="2" fill="currentColor"/><rect x="9" y="29" width="14" height="2" fill="currentColor"/></svg>` },
  { id:'cup',    label:'咖啡杯', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="1" width="2" height="3" fill="currentColor"/><rect x="14" y="0" width="2" height="3" fill="currentColor"/><rect x="4" y="5" width="20" height="1" fill="currentColor"/><rect x="3" y="6" width="22" height="14" fill="currentColor"/><rect x="4" y="7" width="20" height="12" fill="white" opacity="0.12"/><rect x="25" y="8" width="3" height="1" fill="currentColor"/><rect x="28" y="9" width="2" height="6" fill="currentColor"/><rect x="25" y="15" width="3" height="1" fill="currentColor"/><rect x="4" y="20" width="20" height="1" fill="currentColor"/><rect x="5" y="21" width="18" height="1" fill="currentColor"/><rect x="2" y="22" width="24" height="2" fill="currentColor"/><rect x="0" y="24" width="28" height="2" fill="currentColor"/></svg>` },
  { id:'latte',  label:'拿铁', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="11" y="0" width="10" height="2" fill="currentColor"/><rect x="9" y="2" width="14" height="1" fill="currentColor"/><rect x="8" y="3" width="16" height="20" fill="currentColor"/><rect x="9" y="4" width="14" height="18" fill="white" opacity="0.1"/><rect x="9" y="4" width="14" height="4" fill="white" opacity="0.25"/><rect x="24" y="8" width="4" height="1" fill="currentColor"/><rect x="28" y="9" width="2" height="8" fill="currentColor"/><rect x="24" y="17" width="4" height="1" fill="currentColor"/><rect x="8" y="23" width="16" height="1" fill="currentColor"/><rect x="9" y="24" width="14" height="1" fill="currentColor"/><rect x="6" y="25" width="20" height="2" fill="currentColor"/><rect x="5" y="27" width="22" height="2" fill="currentColor"/></svg>` },
  { id:'heart',  label:'爱心', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="6" height="6" fill="currentColor"/><rect x="8" y="4" width="6" height="2" fill="currentColor"/><rect x="14" y="3" width="4" height="2" fill="currentColor"/><rect x="18" y="4" width="6" height="2" fill="currentColor"/><rect x="24" y="6" width="6" height="6" fill="currentColor"/><rect x="2" y="12" width="28" height="6" fill="currentColor"/><rect x="4" y="18" width="24" height="4" fill="currentColor"/><rect x="6" y="22" width="20" height="4" fill="currentColor"/><rect x="8" y="26" width="16" height="3" fill="currentColor"/><rect x="10" y="29" width="12" height="2" fill="currentColor"/><rect x="13" y="31" width="6" height="1" fill="currentColor"/></svg>` },
  { id:'bread',  label:'面包', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="20" height="2" fill="currentColor"/><rect x="3" y="6" width="26" height="2" fill="currentColor"/><rect x="1" y="8" width="30" height="14" fill="currentColor"/><rect x="2" y="9" width="28" height="12" fill="white" opacity="0.1"/><rect x="3" y="10" width="6" height="5" fill="white" opacity="0.2"/><rect x="13" y="9" width="8" height="6" fill="white" opacity="0.2"/><rect x="23" y="10" width="5" height="4" fill="white" opacity="0.2"/><rect x="1" y="22" width="30" height="3" fill="currentColor"/><rect x="3" y="25" width="26" height="2" fill="currentColor"/><rect x="6" y="27" width="20" height="2" fill="currentColor"/></svg>` },
  { id:'cake',   label:'蛋糕', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="0" width="2" height="2" fill="currentColor"/><rect x="13" y="2" width="6" height="4" fill="currentColor"/><rect x="8" y="6" width="16" height="2" fill="currentColor"/><rect x="5" y="8" width="22" height="8" fill="currentColor"/><rect x="6" y="9" width="4" height="4" fill="white" opacity="0.25"/><rect x="14" y="9" width="4" height="4" fill="white" opacity="0.25"/><rect x="22" y="9" width="4" height="4" fill="white" opacity="0.25"/><rect x="4" y="16" width="24" height="2" fill="currentColor"/><rect x="2" y="18" width="28" height="8" fill="currentColor"/><rect x="3" y="19" width="6" height="4" fill="white" opacity="0.2"/><rect x="13" y="19" width="6" height="4" fill="white" opacity="0.2"/><rect x="23" y="19" width="6" height="4" fill="white" opacity="0.2"/><rect x="1" y="26" width="30" height="3" fill="currentColor"/><rect x="3" y="29" width="26" height="2" fill="currentColor"/></svg>` },
  { id:'star',   label:'星星', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="1" width="4" height="6" fill="currentColor"/><rect x="10" y="7" width="12" height="4" fill="currentColor"/><rect x="0" y="10" width="32" height="6" fill="currentColor"/><rect x="4" y="16" width="24" height="4" fill="currentColor"/><rect x="2" y="19" width="12" height="6" fill="currentColor"/><rect x="18" y="19" width="12" height="6" fill="currentColor"/><rect x="0" y="24" width="10" height="4" fill="currentColor"/><rect x="22" y="24" width="10" height="4" fill="currentColor"/><rect x="10" y="23" width="4" height="8" fill="currentColor"/><rect x="18" y="23" width="4" height="8" fill="currentColor"/></svg>` },
  { id:'flower', label:'花朵', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="0" width="4" height="5" fill="currentColor"/><rect x="14" y="27" width="4" height="5" fill="currentColor"/><rect x="0" y="14" width="5" height="4" fill="currentColor"/><rect x="27" y="14" width="5" height="4" fill="currentColor"/><rect x="4" y="4" width="5" height="5" fill="currentColor"/><rect x="23" y="4" width="5" height="5" fill="currentColor"/><rect x="4" y="23" width="5" height="5" fill="currentColor"/><rect x="23" y="23" width="5" height="5" fill="currentColor"/><rect x="9" y="2" width="14" height="7" fill="currentColor"/><rect x="9" y="23" width="14" height="7" fill="currentColor"/><rect x="2" y="9" width="7" height="14" fill="currentColor"/><rect x="23" y="9" width="7" height="14" fill="currentColor"/><rect x="9" y="9" width="14" height="14" fill="currentColor"/><rect x="11" y="11" width="10" height="10" fill="white" opacity="0.2"/><rect x="13" y="13" width="6" height="6" fill="currentColor"/></svg>` },
  { id:'ramen',  label:'拉面', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="2" width="3" height="4" fill="currentColor"/><rect x="14" y="1" width="3" height="5" fill="currentColor"/><rect x="22" y="2" width="3" height="3" fill="currentColor"/><rect x="2" y="6" width="28" height="3" fill="currentColor"/><rect x="1" y="9" width="30" height="14" fill="currentColor"/><rect x="2" y="10" width="28" height="12" fill="white" opacity="0.1"/><rect x="3" y="11" width="8" height="2" fill="currentColor" opacity="0.6"/><rect x="14" y="11" width="10" height="2" fill="currentColor" opacity="0.6"/><rect x="5" y="14" width="14" height="2" fill="currentColor" opacity="0.6"/><rect x="22" y="14" width="6" height="2" fill="currentColor" opacity="0.6"/><rect x="2" y="23" width="28" height="3" fill="currentColor"/><rect x="3" y="26" width="26" height="2" fill="currentColor"/><rect x="5" y="28" width="22" height="2" fill="currentColor"/><rect x="8" y="30" width="16" height="2" fill="currentColor"/></svg>` },
  { id:'cat',    label:'猫咪', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="6" height="8" fill="currentColor"/><rect x="24" y="2" width="6" height="8" fill="currentColor"/><rect x="2" y="8" width="28" height="16" fill="currentColor"/><rect x="0" y="10" width="32" height="12" fill="currentColor"/><rect x="4" y="12" width="4" height="5" fill="white" opacity="0.9"/><rect x="24" y="12" width="4" height="5" fill="white" opacity="0.9"/><rect x="12" y="16" width="8" height="2" fill="white" opacity="0.5"/><rect x="14" y="18" width="4" height="2" fill="white" opacity="0.5"/><rect x="5" y="18" width="5" height="2" fill="white" opacity="0.4"/><rect x="22" y="18" width="5" height="2" fill="white" opacity="0.4"/><rect x="2" y="22" width="28" height="4" fill="currentColor"/><rect x="3" y="26" width="8" height="5" fill="currentColor"/><rect x="21" y="26" width="8" height="5" fill="currentColor"/></svg>` },
  { id:'gift',   label:'礼物', svg:`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="0" width="6" height="6" fill="currentColor"/><rect x="14" y="2" width="6" height="4" fill="currentColor"/><rect x="4" y="6" width="24" height="4" fill="currentColor"/><rect x="14" y="0" width="4" height="10" fill="currentColor"/><rect x="2" y="10" width="28" height="18" fill="currentColor"/><rect x="3" y="11" width="26" height="16" fill="white" opacity="0.1"/><rect x="14" y="10" width="4" height="18" fill="currentColor" opacity="0.5"/><rect x="2" y="28" width="28" height="3" fill="currentColor"/></svg>` },
];

// ─── iOS-safe image loader ────────────────────────────────────────────────────
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

// ─── Canvas paper texture (5-layer, vintage-aware) ───────────────────────────
function clamp(v: number) { return Math.min(255, Math.max(0, Math.round(v))); }

function createPaperTexture(w: number, h: number, vintage = false): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;

  // L1: warm gradient base
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  if (vintage) {
    bg.addColorStop(0,   '#ede5b2'); bg.addColorStop(0.5, '#e8da98');
    bg.addColorStop(1,   '#e2d080');
  } else {
    bg.addColorStop(0,   '#faf6ef'); bg.addColorStop(0.5, '#f8f3ea');
    bg.addColorStop(1,   '#f5f0e8');
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // L2: warm pixel grain
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  const str = vintage ? 38 : 26;
  for (let i = 0; i < d.length; i += 4) {
    const g = (Math.random() - 0.5) * str;
    d[i]   = clamp(d[i]   + g);
    d[i+1] = clamp(d[i+1] + g * 0.88);
    d[i+2] = clamp(d[i+2] + g * 0.62);
  }
  ctx.putImageData(img, 0, 0);

  // L3: horizontal fibers (slightly wavy bezier)
  for (let y = 0; y < h; y++) {
    if (Math.random() > 0.78) {
      const a = Math.random() * (vintage ? 0.08 : 0.05) + 0.006;
      ctx.strokeStyle = vintage ? `rgba(110,72,18,${a})` : `rgba(190,155,95,${a})`;
      ctx.lineWidth = Math.random() < 0.22 ? 0.65 : 0.22;
      ctx.beginPath();
      ctx.moveTo(0, y + (Math.random()-0.5)*0.5);
      ctx.bezierCurveTo(w*.3, y+(Math.random()-0.5)*.9, w*.7, y+(Math.random()-0.5)*.9, w, y+(Math.random()-0.5)*.5);
      ctx.stroke();
    }
  }

  // L4: diagonal flecks
  ctx.save();
  const nFlecks = vintage ? 65 : 38;
  for (let i = 0; i < nFlecks; i++) {
    const x = Math.random()*w, y = Math.random()*h, len = Math.random()*20+4;
    const ang = (Math.random()-0.5)*0.55;
    ctx.strokeStyle = vintage ? `rgba(95,58,12,${Math.random()*0.045+0.008})` : `rgba(125,88,38,${Math.random()*0.032+0.006})`;
    ctx.lineWidth = Math.random()*0.45+0.12;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(ang)*len, y+Math.sin(ang)*len); ctx.stroke();
  }
  ctx.restore();

  // L5: vintage extras (fold lines + stain spots)
  if (vintage) {
    ctx.save();
    for (const fy of [h*0.36+(Math.random()-0.5)*18, h*0.71+(Math.random()-0.5)*18]) {
      ctx.strokeStyle = 'rgba(70,42,8,0.10)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,fy); ctx.lineTo(w, fy+(Math.random()-0.5)*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,238,170,0.18)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(0,fy-1); ctx.lineTo(w, fy-1+(Math.random()-0.5)*2); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const sx=Math.random()*w, sy=Math.random()*h, sr=Math.random()*4+1;
      const sg = ctx.createRadialGradient(sx,sy,0, sx,sy,sr);
      sg.addColorStop(0, `rgba(90,52,8,${Math.random()*0.14+0.04})`);
      sg.addColorStop(1, 'rgba(90,52,8,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // L6: radial vignette
  const vg = ctx.createRadialGradient(w/2,h/2,0, w/2,h/2,Math.max(w,h)*0.72);
  vg.addColorStop(0,   'rgba(0,0,0,0)');
  vg.addColorStop(0.7, vintage?'rgba(20,10,0,0.02)':'rgba(10,5,0,0.012)');
  vg.addColorStop(1,   vintage?'rgba(50,28,0,0.14)':'rgba(28,14,0,0.07)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,w,h);

  return c.toDataURL('image/png');
}

// ─── SVG scalloped edges ──────────────────────────────────────────────────────
function ScallopTop({ width = 280, color = '#f8f4ed' }: { width?: number; color?: string }) {
  const toothW = 14, n = Math.ceil(width/toothW), w = n*toothW;
  let p = `M0,14`;
  for (let i=0;i<n;i++) p += ` Q${i*toothW+toothW/2},0 ${(i+1)*toothW},14`;
  p += ` L${w},14 L0,14 Z`;
  return (
    <svg width={width} height={14} viewBox={`0 0 ${width} 14`} style={{display:'block'}}>
      <defs><mask id="rcpt-top-mask"><rect width={w} height={14} fill="white"/><path d={p} fill="black"/></mask></defs>
      <rect width={w} height={14} fill={color} mask="url(#rcpt-top-mask)"/>
    </svg>
  );
}
function ScallopBottom({ width = 280, color = '#f8f4ed' }: { width?: number; color?: string }) {
  const toothW = 14, n = Math.ceil(width/toothW), w = n*toothW;
  let p = `M0,0`;
  for (let i=0;i<n;i++) p += ` Q${i*toothW+toothW/2},14 ${(i+1)*toothW},0`;
  p += ` L${w},0 L0,0 Z`;
  return (
    <svg width={width} height={14} viewBox={`0 0 ${width} 14`} style={{display:'block'}}>
      <defs><mask id="rcpt-bot-mask"><rect width={w} height={14} fill="white"/><path d={p} fill="black"/></mask></defs>
      <rect width={w} height={14} fill={color} mask="url(#rcpt-bot-mask)"/>
    </svg>
  );
}

// ─── Ink presets ──────────────────────────────────────────────────────────────
const INK_PRESETS = [
  { label:'炭黑', color:'#1a1410' },
  { label:'深蓝', color:'#0d2040' },
  { label:'暗红', color:'#5c1010' },
  { label:'墨绿', color:'#0a2218' },
];

const INP = "border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 w-full text-sm bg-white";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><label className="text-xs text-gray-400 mb-1.5 block font-medium">{label}</label>{children}</div>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const receiptRef   = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [store,        setStore]        = useState('LOVE STORE');
  const [address,      setAddress]      = useState('');
  const [logoMode,     setLogoMode]     = useState<LogoMode>('preset');
  const [logoText,     setLogoText]     = useState('♥');
  const [logoPreset,   setLogoPreset]   = useState('drip');
  const [logoImg,      setLogoImg]      = useState<string|null>(null);
  const [items,        setItems]        = useState([
    { name:'拥抱', price:0 }, { name:'冷战', price:99 }, { name:'复合', price:999 },
  ]);
  const [motto,        setMotto]        = useState('原来我在你这里的价格，\n是这样算的。');
  const [orderNo,      setOrderNo]      = useState(() => Math.random().toString(36).slice(2,10).toUpperCase());
  const [taxRate,      setTaxRate]      = useState(10);
  const [madeWith,     setMadeWith]     = useState('made with 💔');
  // ── new feature states ────────────────────────────────────────────────────
  const [inkColor,     setInkColor]     = useState('#1a1410');
  const [vintage,      setVintage]      = useState(false);
  const [useQR,        setUseQR]        = useState(false);
  // ── ui states ─────────────────────────────────────────────────────────────
  const [copied,       setCopied]       = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [printing,     setPrinting]     = useState(false);
  const [paperTexture, setPaperTexture] = useState('');
  const [qrDataUrl,    setQrDataUrl]    = useState('');

  // Generate paper texture (re-run when vintage changes)
  useEffect(() => {
    setPaperTexture(createPaperTexture(560, 1600, vintage));
  }, [vintage]);

  // Generate QR code from share link whenever relevant state changes
  useEffect(() => {
    if (!useQR || typeof window === 'undefined') { setQrDataUrl(''); return; }
    const data = enc({ store, address, items, motto, logoMode, logoText, logoPreset, orderNo, taxRate, madeWith, inkColor, vintage, useQR });
    const url  = `${window.location.origin}${window.location.pathname}?data=${data}`;
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(url, { width:120, margin:1, color:{ dark:inkColor, light:'#00000000' } })
        .then(setQrDataUrl).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useQR, store, address, items, motto, logoMode, logoText, logoPreset, orderNo, taxRate, madeWith, inkColor]);

  // Load URL state
  useEffect(() => {
    const d = dec(new URLSearchParams(window.location.search).get('data') ?? '');
    if (!d) return;
    if (d.store)      setStore(d.store);
    if (d.address)    setAddress(d.address);
    if (d.items)      setItems(d.items);
    if (d.motto)      setMotto(d.motto);
    if (d.logoMode)   setLogoMode(d.logoMode);
    if (d.logoText)   setLogoText(d.logoText);
    if (d.logoPreset) setLogoPreset(d.logoPreset);
    if (d.orderNo)    setOrderNo(d.orderNo);
    if (d.taxRate !== undefined) setTaxRate(d.taxRate);
    if (d.madeWith)   setMadeWith(d.madeWith);
    if (d.inkColor)   setInkColor(d.inkColor);
    if (d.vintage !== undefined) setVintage(d.vintage);
    if (d.useQR !== undefined)   setUseQR(d.useQR);
  }, []);

  const addItem    = () => setItems(p => [...p, { name:'', price:0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_,j)=>j!==i));
  const updateItem = (i: number, k: string, v: string) =>
    setItems(p => { const n=[...p]; n[i]={...n[i],[k]:k==='price'?parseFloat(v)||0:v}; return n; });

  const subtotal  = items.reduce((s,x)=>s+(x.price||0), 0);
  const taxAmount = subtotal * taxRate / 100;
  const total     = subtotal + taxAmount;

  const generateLink = () => {
    const data = enc({ store, address, items, motto, logoMode, logoText, logoPreset, orderNo, taxRate, madeWith, inkColor, vintage, useQR });
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?data=${data}`)
      .then(() => { setCopied(true); setTimeout(()=>setCopied(false), 2000); });
  };

  // Print animation → then export
  const exportImage = async () => {
    if (!receiptRef.current || printing || exporting) return;
    // 1. Play thermal scan animation
    setPrinting(true);
    await new Promise(r => setTimeout(r, 1500));
    setPrinting(false);
    // 2. Wait one frame so React removes the scan-line div before capture
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 30));
    // 3. Export
    setExporting(true);
    try {
      if (logoMode==='upload' && logoImg && !logoImg.startsWith('data:')) {
        const safe = await loadImageAsBase64(logoImg); setLogoImg(safe);
        await new Promise(r => setTimeout(r, 150));
      }
      const url = await toPng(receiptRef.current, { cacheBust:true, pixelRatio:3 });
      const a = document.createElement('a');
      a.download = `${store||'receipt'}.png`; a.href = url; a.click();
    } catch(e) { console.error(e); alert('导出失败，请重试'); }
    finally { setExporting(false); }
  };

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogoImg(ev.target?.result as string); setLogoMode('upload'); };
    reader.readAsDataURL(file);
  }, []);

  const now     = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const barcodeDigits = (orderNo.replace(/\D/g,'0')+'000000000000').slice(0,12);
  const barsBinary    = makeEAN(barcodeDigits);
  const preset        = PRESETS.find(p=>p.id===logoPreset) ?? PRESETS[0];

  // Paper base color for scallop edges (vintage = warm yellow, normal = cream)
  const paperBase = vintage ? '#e8da98' : '#f8f4ed';

  const paperStyle: React.CSSProperties = {
    width: '280px',
    background: paperTexture ? `url(${paperTexture}) center/cover` : paperBase,
    position: 'relative',
    fontFamily: "'DotGothic16','Noto Sans JP','Noto Sans KR','Noto Sans SC',monospace",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DotGothic16&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap');

        .rcpt-wrap {
          font-family: 'DotGothic16','Noto Sans JP','Noto Sans KR','Noto Sans SC',monospace;
          font-size: 10px; line-height: 1.8; letter-spacing: 0.03em;
        }
        .rcpt-store  { font-size:14px; font-weight:700; letter-spacing:0.18em; text-align:center; }
        .rcpt-addr   { font-size:9px;  color:#888; text-align:center; letter-spacing:0.05em; }
        .rcpt-meta   { font-size:8px;  color:#999; letter-spacing:0.06em; }
        .rcpt-item   { font-size:10px; display:flex; justify-content:space-between; padding:3px 0; }
        .rcpt-total  { font-size:13px; font-weight:700; display:flex; justify-content:space-between; padding:5px 0; }
        .rcpt-tax    { font-size:9px;  color:#999; display:flex; justify-content:space-between; }
        .rcpt-motto  { font-size:16px; font-weight:700; text-align:center; line-height:1.6; letter-spacing:0.04em; }
        .rcpt-sub    { font-size:9px;  color:#888; text-align:center; letter-spacing:0.06em; }
        .rcpt-hr     { border:none; border-top:1px dashed rgba(0,0,0,0.2); margin:8px 0; }
        .rcpt-hr-solid { border:none; border-top:1px solid rgba(0,0,0,0.18); margin:6px 0; }
        .logo-pixel  { font-family:'DotGothic16',monospace; font-size:40px; line-height:1; text-align:center; letter-spacing:0.06em; }

        /* Control panel */
        .tab-pill { display:flex; background:#f1ede6; border-radius:10px; padding:3px; gap:2px; margin-bottom:12px; }
        .tab-pill button { flex:1; padding:7px 4px; border:none; border-radius:8px; font-size:12px; cursor:pointer; background:transparent; color:#888; transition:all .15s; font-family:inherit; }
        .tab-pill button.on { background:#fff; color:#111; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
        .preset-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
        .preset-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 2px 6px; border-radius:10px; border:2px solid transparent; cursor:pointer; background:transparent; transition:all .15s; }
        .preset-btn:hover { border-color:#f0c0c8; background:#fff8fa; }
        .preset-btn.on    { border-color:#d4607a; background:#fff0f4; }
        .preset-btn span  { font-size:9px; color:#999; font-family:'DotGothic16',monospace; }

        .paper-wrap {
          position:relative;
          filter: drop-shadow(0 4px 20px rgba(0,0,0,0.22)) drop-shadow(0 1px 4px rgba(0,0,0,0.12));
        }

        /* Thermal scan animation */
        @keyframes thermalScan {
          0%   { top: 0px;  opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .thermal-scanline {
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 4px;
          background: linear-gradient(to right,
            transparent 0%,
            rgba(80,200,255,0.25) 10%,
            rgba(130,230,255,0.85) 50%,
            rgba(80,200,255,0.25) 90%,
            transparent 100%
          );
          box-shadow: 0 0 14px 5px rgba(100,210,255,0.5), 0 2px 8px rgba(100,200,255,0.35);
          animation: thermalScan 1.5s linear forwards;
          pointer-events: none;
          z-index: 20;
        }
        /* Vintage toggle */
        .toggle-pill {
          display:flex; align-items:center; gap:8px; cursor:pointer;
          padding:8px 12px; border-radius:10px; border:1.5px solid #ede8e0;
          background:#faf8f5; transition:all .15s; user-select:none;
        }
        .toggle-pill.on { border-color:#b8860b; background:#fdf8e8; }
        .toggle-dot { width:18px; height:10px; border-radius:5px; background:#ddd; position:relative; transition:background .15s; }
        .toggle-dot::after { content:''; position:absolute; top:2px; left:2px; width:6px; height:6px; border-radius:50%; background:#fff; transition:transform .15s; }
        .toggle-pill.on .toggle-dot { background:#b8860b; }
        .toggle-pill.on .toggle-dot::after { transform:translateX(8px); }
      `}</style>

      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#f9f5f0 0%,#ede8e0 100%)', display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 16px 80px', fontFamily:"'DotGothic16','Noto Sans JP',sans-serif" }}>

        <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px', letterSpacing:'0.06em', color:'#1a1a1a' }}>🧾 小票情绪生成器</h1>
        <p style={{ fontSize:'11px', color:'#aaa', marginBottom:'28px', letterSpacing:'0.08em' }}>把感情变成一张可以收藏的票据</p>

        {/* ─── Controls ─── */}
        <div style={{ width:'100%', maxWidth:'440px', background:'#fff', borderRadius:'18px', padding:'20px', marginBottom:'36px', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', border:'1px solid #ede8e0' }}>

          {/* Logo */}
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
                    <span dangerouslySetInnerHTML={{__html:p.svg}} style={{width:32,height:32,display:'block',color:'#2a2218'}}/>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
            {logoMode==='text' && (
              <div>
                <input className={INP} value={logoText} onChange={e=>setLogoText(e.target.value)} placeholder="♥  输入文字或 Emoji" maxLength={6}/>
                <p style={{fontSize:'10px',color:'#bbb',marginTop:'6px'}}>将以像素字体显示在小票上</p>
              </div>
            )}
            {logoMode==='upload' && (
              <div>
                <button onClick={()=>logoInputRef.current?.click()} style={{width:'100%',border:'2px dashed #ddd',borderRadius:'12px',padding:'16px',fontSize:'13px',color:'#aaa',cursor:'pointer',background:'transparent'}}>
                  {logoImg?'✓ 图片已加载 — 点击重新选择':'📷 点击选择照片'}
                </button>
                {logoImg&&<img src={logoImg} alt="" style={{height:'48px',objectFit:'contain',marginTop:'10px',borderRadius:'8px',border:'1px solid #eee'}}/>}
                {logoImg&&<button onClick={()=>{setLogoImg(null);if(logoInputRef.current)logoInputRef.current.value='';}} style={{fontSize:'11px',color:'#e07',marginLeft:'10px',background:'none',border:'none',cursor:'pointer'}}>删除</button>}
                <input ref={logoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoUpload}/>
              </div>
            )}
          </Field>

          <Field label="店铺名称">
            <input className={INP} value={store} onChange={e=>setStore(e.target.value)} placeholder="LOVE STORE"/>
          </Field>

          <Field label="地址 / 餐厅（选填）">
            <input className={INP} value={address} onChange={e=>setAddress(e.target.value)} placeholder="例：东京·银座 / Café de Paris"/>
          </Field>

          {/* ── 墨水颜色 ── */}
          <Field label="墨水颜色">
            <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
              {INK_PRESETS.map(p=>(
                <button key={p.color} onClick={()=>setInkColor(p.color)} style={{
                  display:'flex',alignItems:'center',gap:'6px',padding:'7px 12px',
                  borderRadius:'8px',border:`2px solid ${inkColor===p.color?p.color:'#eee'}`,
                  background:inkColor===p.color?`${p.color}12`:'transparent',
                  cursor:'pointer',fontSize:'11px',color:'#555',transition:'all .15s',fontFamily:"'DotGothic16',monospace"
                }}>
                  <span style={{width:'12px',height:'12px',borderRadius:'50%',background:p.color,flexShrink:0,display:'inline-block'}}/>
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* ── 做旧模式 ── */}
          <Field label="纸张风格">
            <div style={{display:'flex',gap:'10px'}}>
              <div className={`toggle-pill${vintage?' on':''}`} onClick={()=>setVintage(v=>!v)}>
                <div className="toggle-dot"/>
                <span style={{fontSize:'12px',color:vintage?'#8a6200':'#888',fontFamily:"'DotGothic16',monospace"}}>
                  {vintage?'做旧模式（褪色·折痕·泛黄）':'普通模式（洁净热敏纸）'}
                </span>
              </div>
            </div>
          </Field>

          {/* ── QR 码 ── */}
          <Field label="底部码型">
            <div style={{display:'flex',gap:'10px'}}>
              <div className={`toggle-pill${useQR?' on':''}`} onClick={()=>setUseQR(v=>!v)} style={useQR?{borderColor:'#2a6a4a',background:'#f0f8f4'}:{}}>
                <div className="toggle-dot" style={useQR?{background:'#2a6a4a'}:{}}/>
                <span style={{fontSize:'12px',color:useQR?'#1a4a30':'#888',fontFamily:"'DotGothic16',monospace"}}>
                  {useQR?'QR 码（扫码直达分享链接）':'条形码（EAN-13 装饰）'}
                </span>
              </div>
            </div>
          </Field>

          <Field label="商品 / 税前价格">
            {items.map((item,i)=>(
              <div key={i} style={{display:'flex',gap:'8px',marginBottom:'8px',alignItems:'center'}}>
                <input className={INP} style={{flex:1}} value={item.name} onChange={e=>updateItem(i,'name',e.target.value)} placeholder="商品名"/>
                <input className={INP} style={{width:'88px'}} type="number" value={item.price} onChange={e=>updateItem(i,'price',e.target.value)} placeholder="0"/>
                <button onClick={()=>removeItem(i)} style={{color:'#ddd',fontSize:'22px',background:'none',border:'none',cursor:'pointer',lineHeight:1}}>×</button>
              </div>
            ))}
            <button onClick={addItem} style={{fontSize:'12px',color:'#bbb',background:'none',border:'none',cursor:'pointer',marginTop:'4px'}}>＋ 添加一行</button>
          </Field>

          <Field label={`税率（${taxRate}%，0 = 不含税）`}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <input className={INP} type="number" min={0} max={100} step={1} value={taxRate}
                onChange={e=>setTaxRate(Math.max(0,Math.min(100,parseFloat(e.target.value)||0)))}
                style={{width:'100px'}}/>
              <span style={{fontSize:'11px',color:'#aaa'}}>%　税额 ¥{taxAmount.toFixed(2)}</span>
            </div>
          </Field>

          <Field label="票据号">
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <input className={INP} value={orderNo}
                onChange={e=>setOrderNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12))}
                placeholder="自动生成，可手改" maxLength={12} style={{flex:1,letterSpacing:'0.15em'}}/>
              <button onClick={()=>setOrderNo(Math.random().toString(36).slice(2,10).toUpperCase())}
                style={{fontSize:'11px',color:'#bbb',background:'none',border:'1px solid #eee',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',whiteSpace:'nowrap'}}>随机</button>
            </div>
          </Field>

          <Field label="底部情绪句">
            <textarea className={INP} value={motto} onChange={e=>setMotto(e.target.value)} placeholder="写下你想说的话…" style={{resize:'none',height:'72px',fontSize:'12px',lineHeight:1.7}}/>
          </Field>

          <Field label="底部署名">
            <input className={INP} value={madeWith} onChange={e=>setMadeWith(e.target.value)} placeholder="made with 💔" maxLength={40}/>
          </Field>

          <div style={{display:'flex',gap:'10px',marginTop:'8px'}}>
            <button onClick={generateLink} style={{flex:1,padding:'14px',borderRadius:'14px',fontSize:'13px',fontWeight:700,color:'#fff',background:copied?'#3a9e6a':'#4a7fcc',border:'none',cursor:'pointer',transition:'all .15s',fontFamily:'inherit'}}>
              {copied?'✓ 链接已复制':'🔗 分享链接'}
            </button>
            <button onClick={exportImage} disabled={printing||exporting} style={{flex:1,padding:'14px',borderRadius:'14px',fontSize:'13px',fontWeight:700,color:'#fff',background:'#c0445a',border:'none',cursor:'pointer',opacity:(printing||exporting)?.65:1,transition:'all .15s',fontFamily:'inherit'}}>
              {printing?'打印中…':exporting?'生成中…':'📥 下载小票'}
            </button>
          </div>
        </div>

        {/* ─── Receipt Preview ─── */}
        <div className="paper-wrap" style={{position:'relative'}}>

          {/* Thermal scan line — only shown during print animation */}
          {printing && <div className="thermal-scanline"/>}

          <div ref={receiptRef} className="rcpt-wrap" style={{
            ...paperStyle,
            color: inkColor,
            filter: vintage ? 'sepia(0.22) brightness(0.97)' : undefined,
          } as React.CSSProperties}>

            <ScallopTop  width={280} color={paperBase}/>

            <div style={{padding:'10px 22px 18px'}}>

              {/* Logo */}
              <div style={{textAlign:'center',margin:'12px 0 10px'}}>
                {logoMode==='upload' && logoImg
                  ? <img src={logoImg} alt="logo" crossOrigin="anonymous" style={{height:'64px',maxWidth:'180px',objectFit:'contain',margin:'0 auto',display:'block'}}/>
                  : logoMode==='preset'
                    ? <div dangerouslySetInnerHTML={{__html:preset.svg.replace('viewBox="0 0 32 32"','viewBox="0 0 32 32" width="64" height="64"')}} style={{display:'inline-block',color:inkColor,lineHeight:0}}/>
                    : <div className="logo-pixel" style={{color:inkColor}}>{logoText||'♥'}</div>
                }
              </div>

              <div className="rcpt-store" style={{marginBottom:'3px'}}>{store||'LOVE STORE'}</div>
              {address && <div className="rcpt-addr" style={{marginBottom:'4px'}}>{address}</div>}

              <hr className="rcpt-hr-solid" style={{margin:'10px 0 6px'}}/>

              <div className="rcpt-meta" style={{marginBottom:'6px'}}>
                <span>{dateStr}　{timeStr}</span>
              </div>
              <div className="rcpt-meta" style={{marginBottom:'8px'}}>
                ORDER NO.　<span style={{letterSpacing:'0.15em'}}>{orderNo}</span>
              </div>

              <hr className="rcpt-hr"/>

              {/* Items */}
              <div style={{marginBottom:'4px'}}>
                <div className="rcpt-meta" style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span>ITEM</span><span>AMOUNT</span>
                </div>
                {items.map((item,i)=>(
                  <div key={i} className="rcpt-item">
                    <span style={{maxWidth:'60%'}}>{item.name||'---'}</span>
                    <span>¥{(item.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr className="rcpt-hr"/>

              {/* Tax / Total */}
              {taxRate > 0 && <>
                <div className="rcpt-tax" style={{marginBottom:'2px'}}>
                  <span>SUBTOTAL（税前）</span><span>¥{subtotal.toFixed(2)}</span>
                </div>
                <div className="rcpt-tax" style={{marginBottom:'4px'}}>
                  <span>TAX（{taxRate}%）</span><span>¥{taxAmount.toFixed(2)}</span>
                </div>
              </>}
              <div className="rcpt-total">
                <span>{taxRate>0?'TOTAL（含税）':'TOTAL'}</span>
                <span>¥{total.toFixed(2)}</span>
              </div>

              {/* Motto */}
              {motto && <>
                <hr className="rcpt-hr-solid" style={{margin:'14px 0 16px'}}/>
                <div className="rcpt-motto">
                  {motto.split('\n').map((line,i)=><div key={i}>{line}</div>)}
                </div>
              </>}

              {/* QR code or EAN barcode */}
              <div style={{textAlign:'center',marginTop:'20px'}}>
                {useQR && qrDataUrl ? (
                  <>
                    <img src={qrDataUrl} alt="QR" style={{width:90,height:90,imageRendering:'pixelated',display:'inline-block'}}/>
                    <div style={{fontSize:'7px',color:inkColor,opacity:0.5,marginTop:'4px',letterSpacing:'0.18em',fontFamily:"'DotGothic16',monospace"}}>
                      SCAN TO SHARE
                    </div>
                  </>
                ) : useQR ? (
                  <div style={{width:90,height:90,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'8px',color:'#aaa',fontFamily:"'DotGothic16',monospace"}}>生成中…</div>
                ) : (
                  <>
                    <div style={{display:'inline-flex',alignItems:'flex-end',padding:'0 8px'}}>
                      <div style={{width:'6px',height:'56px'}}/>
                      {barsBinary.split('').map((bit,i)=>{
                        const isG = i<3||(i>=27&&i<=31)||i>91;
                        return <div key={i} style={{width:'1.8px',height:isG?'54px':'44px',background:bit==='1'?inkColor:'transparent',flexShrink:0,alignSelf:'flex-end'}}/>;
                      })}
                      <div style={{width:'6px',height:'56px'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'7px',color:inkColor,opacity:0.6,marginTop:'3px',letterSpacing:'0.18em',fontFamily:"'DotGothic16',monospace",padding:'0 8px'}}>
                      <span>{barcodeDigits[0]}</span>
                      <span>{barcodeDigits.slice(1,7).split('').join(' ')}</span>
                      <span>{barcodeDigits.slice(7,12).split('').join(' ')}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="rcpt-sub" style={{marginTop:'14px',borderTop:'1px solid rgba(0,0,0,0.12)',paddingTop:'10px'}}>
                {madeWith||'made with 💔'}
              </div>
            </div>

            <ScallopBottom width={280} color={paperBase}/>
          </div>
        </div>

      </div>
    </>
  );
}
