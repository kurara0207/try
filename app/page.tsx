'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';

// ─── Types ───────────────────────────────────────────────────────────────────
type Item    = { name: string; price: number };
type AppData = { store: string; address: string; items: Item[]; motto: string; guests: number; logoMode: LogoMode; logoText: string; logoPreset: string; orderNo: string; };
type LogoMode = 'text' | 'preset' | 'upload';

// ─── URL encode/decode ────────────────────────────────────────────────────────
function enc(d: AppData)     { return btoa(unescape(encodeURIComponent(JSON.stringify(d)))); }
function dec(s: string): AppData | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

// ─── Stable barcode (EAN-13 style) ───────────────────────────────────────────
// Real EAN-13 encoding table for digits 0–9 (L-code)
const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
function makeEAN(digits: string): string {
  // digits should be 12 chars; we'll generate the bars string
  const d = digits.padEnd(12,'0').slice(0,12);
  let bars = '101'; // start guard
  for (let i = 0; i < 6; i++) bars += EAN_L[parseInt(d[i])];
  bars += '01010'; // middle guard
  // right side uses inverted L codes
  for (let i = 6; i < 12; i++) bars += EAN_L[parseInt(d[i])].split('').map(b => b==='1'?'0':'1').join('');
  bars += '101'; // end guard
  return bars;
}

// ─── Pixel SVG logos ──────────────────────────────────────────────────────────
const PRESETS: { id: string; label: string; svg: string }[] = [
  { id: 'heart', label: '爱心', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="3" y="1" width="2" height="2" fill="currentColor"/><rect x="5" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="0" width="2" height="2" fill="currentColor"/><rect x="11" y="1" width="2" height="2" fill="currentColor"/><rect x="13" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="0" y="4" width="2" height="4" fill="currentColor"/><rect x="14" y="4" width="2" height="4" fill="currentColor"/>
    <rect x="1" y="7" width="2" height="2" fill="currentColor"/><rect x="13" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="9" width="2" height="2" fill="currentColor"/><rect x="12" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="11" width="2" height="2" fill="currentColor"/><rect x="11" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="13" width="2" height="2" fill="currentColor"/><rect x="10" y="13" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="15" width="2" height="1" fill="currentColor"/><rect x="6" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="6" y="14" width="4" height="2" fill="currentColor"/><rect x="7" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="2" width="2" height="2" fill="currentColor"/><rect x="12" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="1" y="4" width="14" height="3" fill="currentColor"/>
  </svg>` },
  { id: 'coffee', label: '咖啡', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="1" width="2" height="2" fill="currentColor"/><rect x="6" y="1" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="0" width="2" height="2" fill="currentColor"/><rect x="7" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="1" y="3" width="9" height="1" fill="currentColor"/>
    <rect x="0" y="4" width="10" height="7" fill="currentColor"/>
    <rect x="1" y="5" width="8" height="5" fill="none" stroke="none"/>
    <rect x="1" y="5" width="8" height="5" fill="#f5f0e8"/>
    <rect x="10" y="5" width="3" height="4" fill="currentColor"/>
    <rect x="13" y="6" width="1" height="2" fill="currentColor"/>
    <rect x="0" y="11" width="10" height="1" fill="currentColor"/>
    <rect x="1" y="12" width="8" height="1" fill="currentColor"/>
    <rect x="2" y="13" width="6" height="1" fill="currentColor"/>
    <rect x="0" y="15" width="12" height="1" fill="currentColor"/>
  </svg>` },
  { id: 'bread', label: '面包', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="10" height="1" fill="currentColor"/>
    <rect x="1" y="3" width="14" height="1" fill="currentColor"/>
    <rect x="0" y="4" width="16" height="6" fill="currentColor"/>
    <rect x="1" y="5" width="3" height="2" fill="#f5f0e8"/>
    <rect x="6" y="4" width="4" height="3" fill="#f5f0e8"/>
    <rect x="12" y="5" width="3" height="2" fill="#f5f0e8"/>
    <rect x="0" y="10" width="16" height="2" fill="currentColor"/>
    <rect x="1" y="12" width="14" height="1" fill="currentColor"/>
    <rect x="3" y="13" width="10" height="1" fill="currentColor"/>
  </svg>` },
  { id: 'cake', label: '蛋糕', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="0" width="2" height="1" fill="currentColor"/>
    <rect x="6" y="1" width="4" height="1" fill="currentColor"/>
    <rect x="7" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="4" width="8" height="1" fill="currentColor"/>
    <rect x="3" y="5" width="10" height="4" fill="currentColor"/>
    <rect x="4" y="6" width="2" height="2" fill="#f5f0e8"/>
    <rect x="9" y="6" width="2" height="2" fill="#f5f0e8"/>
    <rect x="2" y="9" width="12" height="1" fill="currentColor"/>
    <rect x="1" y="10" width="14" height="4" fill="currentColor"/>
    <rect x="2" y="11" width="2" height="2" fill="#f5f0e8"/>
    <rect x="7" y="11" width="2" height="2" fill="#f5f0e8"/>
    <rect x="12" y="11" width="2" height="2" fill="#f5f0e8"/>
    <rect x="0" y="14" width="16" height="1" fill="currentColor"/>
  </svg>` },
  { id: 'star', label: '星星', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="0" width="2" height="3" fill="currentColor"/>
    <rect x="5" y="3" width="6" height="2" fill="currentColor"/>
    <rect x="0" y="5" width="16" height="2" fill="currentColor"/>
    <rect x="2" y="7" width="12" height="2" fill="currentColor"/>
    <rect x="1" y="9" width="5" height="2" fill="currentColor"/>
    <rect x="10" y="9" width="5" height="2" fill="currentColor"/>
    <rect x="0" y="11" width="4" height="2" fill="currentColor"/>
    <rect x="12" y="11" width="4" height="2" fill="currentColor"/>
    <rect x="5" y="11" width="2" height="4" fill="currentColor"/>
    <rect x="9" y="11" width="2" height="4" fill="currentColor"/>
  </svg>` },
  { id: 'flower', label: '花朵', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="0" width="2" height="2" fill="currentColor"/>
    <rect x="7" y="14" width="2" height="2" fill="currentColor"/>
    <rect x="0" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="14" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="2" width="2" height="2" fill="currentColor"/>
    <rect x="2" y="12" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="12" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="1" width="6" height="3" fill="currentColor"/>
    <rect x="5" y="12" width="6" height="3" fill="currentColor"/>
    <rect x="1" y="5" width="3" height="6" fill="currentColor"/>
    <rect x="12" y="5" width="3" height="6" fill="currentColor"/>
    <rect x="4" y="4" width="8" height="8" fill="currentColor"/>
    <rect x="5" y="5" width="6" height="6" fill="#f5f0e8"/>
    <rect x="6" y="6" width="4" height="4" fill="currentColor"/>
  </svg>` },
  { id: 'ramen', label: '拉面', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="0" width="2" height="1" fill="currentColor"/><rect x="8" y="0" width="2" height="1" fill="currentColor"/>
    <rect x="3" y="1" width="2" height="2" fill="currentColor"/><rect x="7" y="1" width="2" height="2" fill="currentColor"/>
    <rect x="0" y="3" width="16" height="2" fill="currentColor"/>
    <rect x="0" y="5" width="16" height="6" fill="currentColor"/>
    <rect x="1" y="6" width="14" height="4" fill="#f5f0e8"/>
    <rect x="2" y="7" width="3" height="1" fill="currentColor"/>
    <rect x="7" y="7" width="4" height="1" fill="currentColor"/>
    <rect x="13" y="7" width="1" height="1" fill="currentColor"/>
    <rect x="3" y="8" width="5" height="1" fill="currentColor"/>
    <rect x="10" y="8" width="3" height="1" fill="currentColor"/>
    <rect x="1" y="11" width="14" height="2" fill="currentColor"/>
    <rect x="2" y="13" width="12" height="1" fill="currentColor"/>
    <rect x="4" y="14" width="8" height="1" fill="currentColor"/>
    <rect x="5" y="15" width="6" height="1" fill="currentColor"/>
  </svg>` },
  { id: 'cat', label: '猫咪', svg: `<svg viewBox="0 0 16 16" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="3" height="4" fill="currentColor"/>
    <rect x="12" y="1" width="3" height="4" fill="currentColor"/>
    <rect x="1" y="4" width="14" height="8" fill="currentColor"/>
    <rect x="0" y="5" width="16" height="6" fill="currentColor"/>
    <rect x="2" y="6" width="2" height="2" fill="#f5f0e8"/>
    <rect x="12" y="6" width="2" height="2" fill="#f5f0e8"/>
    <rect x="6" y="8" width="4" height="1" fill="#f5f0e8"/>
    <rect x="7" y="9" width="2" height="1" fill="#f5f0e8"/>
    <rect x="3" y="9" width="2" height="1" fill="#f5f0e8"/>
    <rect x="11" y="9" width="2" height="1" fill="#f5f0e8"/>
    <rect x="1" y="11" width="14" height="2" fill="currentColor"/>
    <rect x="2" y="13" width="4" height="2" fill="currentColor"/>
    <rect x="10" y="13" width="4" height="2" fill="currentColor"/>
  </svg>` },
];

// ─── iOS-safe image loader (converts to canvas dataURL first) ─────────────────
function loadImageSafe(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/png')); }
      catch { resolve(src); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INPUT  = "border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 w-full text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="text-xs text-gray-400 mb-1 block">{label}</label>{children}</div>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Page() {
  const receiptRef   = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // State
  const [store,     setStore]     = useState('LOVE STORE');
  const [address,   setAddress]   = useState('');
  const [logoMode,  setLogoMode]  = useState<LogoMode>('preset');
  const [logoText,  setLogoText]  = useState('♥');
  const [logoPreset,setLogoPreset]= useState('heart');
  const [logoImg,   setLogoImg]   = useState<string | null>(null); // always safe base64
  const [guests,    setGuests]    = useState(2);
  const [items,     setItems]     = useState<Item[]>([
    { name: '拥抱', price: 0 },
    { name: '冷战', price: 99 },
    { name: '复合', price: 999 },
  ]);
  const [motto,     setMotto]     = useState('原来我在你这里的价格，是这样算的。');
  const [orderNo,   setOrderNo]   = useState(() => Math.random().toString(36).slice(2,10).toUpperCase());
  const [copied,    setCopied]    = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load URL params
  useEffect(() => {
    const d = dec(new URLSearchParams(window.location.search).get('data') ?? '');
    if (d) {
      setStore(d.store ?? 'LOVE STORE');
      setAddress(d.address ?? '');
      setItems(d.items ?? []);
      setMotto(d.motto ?? '');
      setGuests(d.guests ?? 2);
      setLogoMode(d.logoMode ?? 'preset');
      setLogoText(d.logoText ?? '♥');
      setLogoPreset(d.logoPreset ?? 'heart');
      setOrderNo(d.orderNo ?? Math.random().toString(36).slice(2,10).toUpperCase());
    }
  }, []);

  // Items helpers
  const addItem    = () => setItems(p => [...p, { name: '', price: 0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const updateItem = (i: number, k: string, v: string) =>
    setItems(p => { const n=[...p]; n[i]={...n[i],[k]: k==='price' ? parseFloat(v)||0 : v}; return n; });

  const total     = items.reduce((s,x) => s+(x.price||0), 0);
  const perPerson = guests > 0 ? total/guests : total;

  // Share link
  const generateLink = () => {
    const data = enc({ store, address, items, motto, guests, logoMode, logoText, logoPreset, orderNo });
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?data=${data}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // Export — iOS-safe: inline all images first
  const exportImage = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      // Pre-convert uploaded image to safe dataURL
      if (logoMode === 'upload' && logoImg && logoImg.startsWith('blob:')) {
        const safe = await loadImageSafe(logoImg);
        setLogoImg(safe);
        await new Promise(r => setTimeout(r, 100));
      }
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#f5f0e8',
        // Force all images to be inlined
        filter: (node: HTMLElement) => {
          if (node.tagName === 'IMG') {
            const img = node as HTMLImageElement;
            if (img.src && !img.src.startsWith('data:')) {
              // skip cross-origin images that can't be cloned
            }
          }
          return true;
        },
      });
      const a = document.createElement('a');
      a.download = `${store || 'receipt'}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // Logo upload — immediately convert to base64 dataURL for iOS safety
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      // result is already a base64 dataURL — safe on all platforms
      setLogoImg(result);
      setLogoMode('upload');
    };
    reader.readAsDataURL(file); // ← key: readAsDataURL not createObjectURL
  }, []);

  // Date / time
  const now     = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });

  // Barcode (EAN-13 from orderNo digits)
  const barcodeDigits = (orderNo.replace(/\D/g,'') + '000000000000').slice(0,12);
  const barsBinary    = makeEAN(barcodeDigits);

  // Preset SVG
  const preset = PRESETS.find(p => p.id === logoPreset) ?? PRESETS[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+SC:wght@400;700&family=Ma+Shan+Zheng&display=swap');
        .rcpt     { font-family:'Press Start 2P','Noto Sans SC',monospace; font-size:9px; line-height:1.9; color:#2a2218; }
        .rcpt-lg  { font-family:'Press Start 2P','Noto Sans SC',monospace; font-size:11px; font-weight:700; letter-spacing:0.1em; }
        .rcpt-sm  { font-size:7px; color:#888; letter-spacing:0.07em; font-family:'Press Start 2P','Noto Sans SC',monospace; }
        .logo-handwrite { font-family:'Ma Shan Zheng',cursive; font-size:42px; line-height:1; color:#2a2218; }
        .preset-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        .preset-btn  { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:10px; border:1.5px solid transparent; cursor:pointer; background:transparent; transition:all .15s; }
        .preset-btn:hover  { border-color:#f9a8d4; background:#fff0f5; }
        .preset-btn.active { border-color:#ec4899; background:#fff0f5; }
        .preset-btn span   { font-size:10px; color:#888; }
        .tab-btn { flex:1; padding:6px; border-radius:8px; font-size:12px; border:none; cursor:pointer; transition:all .15s; background:transparent; color:#888; }
        .tab-btn.active { background:#2a2218; color:#fff; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-blue-50 flex flex-col items-center p-4 pb-16">
        <h1 className="text-2xl font-bold mb-1 tracking-wide mt-4">🧾 小票情绪生成器</h1>
        <p className="text-gray-400 mb-6 text-xs">把你的关系变成一张可以分享的票据</p>

        {/* ─── Control panel ─── */}
        <div className="w-full max-w-md mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

          {/* Logo section */}
          <Field label="Logo">
            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
              {([['preset','预设图标'],['text','文字/Emoji'],['upload','上传图片']] as [LogoMode,string][]).map(([m,l]) => (
                <button key={m} className={`tab-btn${logoMode===m?' active':''}`} onClick={() => setLogoMode(m)}>{l}</button>
              ))}
            </div>

            {logoMode === 'preset' && (
              <div className="preset-grid">
                {PRESETS.map(p => (
                  <button key={p.id} className={`preset-btn${logoPreset===p.id?' active':''}`} onClick={() => setLogoPreset(p.id)}>
                    <span dangerouslySetInnerHTML={{ __html: p.svg.replace('currentColor','#2a2218').replace('#f5f0e8','#f5f0e8') }} style={{ width:32, height:32, display:'block' }} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {logoMode === 'text' && (
              <div className="flex gap-2 items-center">
                <input className={INPUT + " flex-1"} value={logoText} onChange={e => setLogoText(e.target.value)} placeholder="♥ 文字或Emoji" maxLength={6} />
                <div className="text-xs text-gray-400 whitespace-nowrap">手写风格预览↓</div>
              </div>
            )}

            {logoMode === 'upload' && (
              <div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-pink-300 hover:text-pink-400 transition-colors"
                >
                  {logoImg ? '✓ 图片已加载（点击重新上传）' : '📷 点击选择照片'}
                </button>
                {logoImg && (
                  <div className="flex items-center gap-2 mt-2">
                    <img src={logoImg} alt="preview" className="w-12 h-12 object-contain rounded-lg border border-gray-100" />
                    <button onClick={() => { setLogoImg(null); if(logoInputRef.current) logoInputRef.current.value=''; }} className="text-xs text-red-400 hover:text-red-500">删除</button>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <p className="text-xs text-gray-300 mt-2">iOS 用户：选图后请稍等 1 秒再下载</p>
              </div>
            )}
          </Field>

          <Field label="店铺名称">
            <input className={INPUT} value={store} onChange={e => setStore(e.target.value)} placeholder="LOVE STORE" />
          </Field>

          <Field label="地址 / 备注（选填）">
            <input className={INPUT} value={address} onChange={e => setAddress(e.target.value)} placeholder="餐厅名 · 所在城市" />
          </Field>

          <Field label="人数">
            <div className="flex items-center gap-3">
              <button onClick={() => setGuests(g => Math.max(1,g-1))} className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition-colors flex items-center justify-center text-lg">−</button>
              <span className="text-sm font-medium w-6 text-center">{guests}</span>
              <button onClick={() => setGuests(g => g+1)} className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition-colors flex items-center justify-center text-lg">+</button>
              <span className="text-xs text-gray-400">人 · 人均 ¥{perPerson.toFixed(2)}</span>
            </div>
          </Field>

          <Field label="商品 / 价格">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input className="border border-gray-200 p-2 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm" value={item.name} onChange={e => updateItem(i,'name',e.target.value)} placeholder="商品名" />
                <input className="border border-gray-200 p-2 w-24 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm" type="number" value={item.price} onChange={e => updateItem(i,'price',e.target.value)} placeholder="0" />
                <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition-colors text-xl flex-shrink-0">×</button>
              </div>
            ))}
            <button onClick={addItem} className="text-xs text-gray-400 hover:text-pink-500 transition-colors mt-1">＋ 添加一行</button>
          </Field>

          <Field label="票据号（自定义）">
            <input className={INPUT} value={orderNo} onChange={e => setOrderNo(e.target.value.toUpperCase().slice(0,12))} placeholder="自动生成，也可手改" maxLength={12} />
          </Field>

          <Field label="底部情绪句">
            <textarea className={INPUT + " resize-none h-16 text-xs"} value={motto} onChange={e => setMotto(e.target.value)} placeholder="写下你想说的话…" />
          </Field>

          <div className="flex gap-2 mt-3">
            <button onClick={generateLink} className={`flex-1 py-3 rounded-xl text-sm text-white transition-colors font-medium ${copied?'bg-green-500':'bg-blue-500 hover:bg-blue-600'}`}>
              {copied ? '✓ 已复制' : '🔗 分享链接'}
            </button>
            <button onClick={exportImage} disabled={exporting} className="flex-1 py-3 rounded-xl text-sm text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-60 transition-colors font-medium">
              {exporting ? '生成中…' : '📥 下载小票'}
            </button>
          </div>
        </div>

        {/* ─── Receipt ─── */}
        <div
          ref={receiptRef}
          className="rcpt relative"
          style={{ width:'300px', background:'#f5f0e8', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}
        >
          {/* Top serrated edge */}
          <div style={{ width:'100%', height:'16px', background:'radial-gradient(circle at 50% 0%,#f5f0e8 71%,transparent 71%) center -8px/16px 16px repeat-x,#e0d5c0' }} />

          <div style={{ padding:'6px 24px 16px' }}>

            {/* Logo */}
            <div style={{ textAlign:'center', margin:'12px 0 8px' }}>
              {logoMode === 'upload' && logoImg
                ? <img src={logoImg} alt="logo" style={{ height:'60px', maxWidth:'160px', objectFit:'contain', margin:'0 auto', display:'block' }} crossOrigin="anonymous" />
                : logoMode === 'preset'
                  ? <div dangerouslySetInnerHTML={{ __html: preset.svg }} style={{ display:'inline-block', color:'#2a2218' }} />
                  : <div className="logo-handwrite">{logoText || '♥'}</div>
              }
            </div>

            {/* Store */}
            <div className="rcpt-lg" style={{ textAlign:'center', marginBottom:'3px' }}>{store||'LOVE STORE'}</div>

            {/* Address */}
            {address && (
              <div className="rcpt-sm" style={{ textAlign:'center', marginBottom:'4px', color:'#999' }}>{address}</div>
            )}

            {/* Date / time */}
            <div className="rcpt-sm" style={{ textAlign:'center', marginBottom:'10px' }}>{dateStr}　{timeStr}</div>

            {/* Order + guests */}
            <div className="rcpt-sm" style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
              <span>ORDER #{orderNo}</span>
              <span>GUESTS × {guests}</span>
            </div>

            <div style={{ borderTop:'1px dashed #c4b89a', margin:'5px 0' }} />

            {/* Items */}
            {items.map((item,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0' }}>
                <span>{item.name||'---'}</span>
                <span>¥{(item.price||0).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop:'1px dashed #c4b89a', margin:'5px 0' }} />

            {/* Total */}
            <div className="rcpt-lg" style={{ display:'flex', justifyContent:'space-between', margin:'5px 0 2px', fontSize:'10px' }}>
              <span>TOTAL</span><span>¥{total.toFixed(2)}</span>
            </div>

            {guests > 1 && (
              <div className="rcpt-sm" style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                <span>人均 / {guests} pax</span><span>¥{perPerson.toFixed(2)}</span>
              </div>
            )}

            {/* Motto */}
            {motto && (
              <div style={{ textAlign:'center', margin:'14px 0 8px', color:'#7a6e5f', fontSize:'7.5px', lineHeight:2.2, fontStyle:'italic', borderTop:'1px solid #d8ceba', paddingTop:'12px', fontFamily:"'Press Start 2P','Noto Sans SC',monospace" }}>
                &ldquo;{motto}&rdquo;
              </div>
            )}

            {/* ─── Realistic EAN-13 Barcode ─── */}
            <div style={{ marginTop:'16px', textAlign:'center' }}>
              <div style={{ display:'inline-flex', alignItems:'flex-end', gap:'0' }}>
                {barsBinary.split('').map((bit, i) => {
                  // guard bars (start 0-2, middle 27-31, end 92-94) are taller
                  const isGuard = i<3 || (i>=27&&i<=31) || i>91;
                  return (
                    <div key={i} style={{
                      width: '2px',
                      height: isGuard ? '52px' : '44px',
                      background: bit==='1' ? '#1a140a' : '#f5f0e8',
                      flexShrink: 0,
                    }} />
                  );
                })}
              </div>
              {/* Digit row below barcode */}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'6.5px', color:'#7a6e5f', marginTop:'3px', letterSpacing:'0.12em', fontFamily:"'Press Start 2P',monospace", padding:'0 4px' }}>
                <span>{barcodeDigits.slice(0,1)}</span>
                <span>{barcodeDigits.slice(1,7).split('').join(' ')}</span>
                <span>{barcodeDigits.slice(7,12).split('').join(' ')}</span>
              </div>
            </div>

          </div>

          {/* Bottom serrated edge */}
          <div style={{ width:'100%', height:'16px', background:'radial-gradient(circle at 50% 100%,#f5f0e8 71%,transparent 71%) center 8px/16px 16px repeat-x,#e0d5c0' }} />
        </div>

        <p style={{ marginTop:'32px', fontSize:'11px', color:'#ccc' }}>made with 💔</p>
      </div>
    </>
  );
}
