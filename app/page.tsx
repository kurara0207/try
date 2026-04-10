'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';

type Item = { name: string; price: number };
type AppData = { store: string; items: Item[]; motto: string; guests: number; logoText: string; };

function encodeData(data: AppData) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function decodeData(str: string): AppData | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
  catch { return null; }
}

const BARCODE = (() => {
  const widths = Array.from({ length: 42 }, (_, i) => i % 3 === 0 ? 3 : 1.5);
  const num = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  return { widths, num };
})();

const INPUT = "border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 w-full text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default function Page() {
  const receiptRef  = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const orderNo     = useRef(Math.random().toString(36).slice(2, 10).toUpperCase()).current;

  const [store,    setStore]    = useState('LOVE STORE');
  const [logoText, setLogoText] = useState('♥');
  const [logoImg,  setLogoImg]  = useState<string | null>(null);
  const [guests,   setGuests]   = useState(2);
  const [items,    setItems]    = useState<Item[]>([
    { name: '拥抱', price: 0 },
    { name: '冷战', price: 99 },
    { name: '复合', price: 999 },
  ]);
  const [motto,    setMotto]    = useState('原来我在你这里的价格，是这样算的。');
  const [copied,   setCopied]   = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('data');
    if (d) {
      const dec = decodeData(d);
      if (dec) {
        setStore(dec.store ?? 'LOVE STORE');
        setItems(dec.items ?? []);
        setMotto(dec.motto ?? '');
        setGuests(dec.guests ?? 2);
        setLogoText(dec.logoText ?? '♥');
      }
    }
  }, []);

  const addItem    = () => setItems(p => [...p, { name: '', price: 0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: string) =>
    setItems(p => { const n = [...p]; n[i] = { ...n[i], [key]: key === 'price' ? parseFloat(val) || 0 : val }; return n; });

  const total     = items.reduce((s, x) => s + (x.price || 0), 0);
  const perPerson = guests > 0 ? total / guests : total;

  const generateLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?data=${encodeData({ store, items, motto, guests, logoText })}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const exportImage = async () => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: '#f5f0e8' });
      const a = document.createElement('a');
      a.download = `${store}-receipt.png`;
      a.href = dataUrl;
      a.click();
    } finally { setExporting(false); }
  };

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoImg(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const now     = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const paperBg = `radial-gradient(ellipse at 20% 30%, rgba(200,185,160,0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 70%, rgba(180,165,140,0.1) 0%, transparent 50%)`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Noto+Sans+SC:wght@400;700&display=swap');
        .rcpt { font-family: 'Press Start 2P', 'Noto Sans SC', monospace; font-size: 9px; line-height: 1.9; color: #2a2218; }
        .rcpt-lg { font-family: 'Press Start 2P', 'Noto Sans SC', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
        .rcpt-sm { font-size: 7px; color: #888; letter-spacing: 0.07em; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-blue-50 flex flex-col items-center p-6">
        <h1 className="text-3xl font-bold mb-1 tracking-wide">🧾 小票情绪生成器</h1>
        <p className="text-gray-400 mb-7 text-xs tracking-wide">把你的关系变成一张可以分享的票据</p>

        {/* Control panel */}
        <div className="w-full max-w-md mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

          <Field label="Logo（上传图片 或 输入文字 / Emoji）">
            <div className="flex gap-2 items-center">
              <input className={INPUT + " flex-1"} value={logoText} onChange={e => setLogoText(e.target.value)} placeholder="♥ 或任意文字" maxLength={6} />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-400 hover:border-pink-300 hover:text-pink-400 transition-colors whitespace-nowrap"
              >
                {logoImg ? '✓ 已上传' : '上传图片'}
              </button>
              {logoImg && (
                <button onClick={() => { setLogoImg(null); if (logoInputRef.current) logoInputRef.current.value = ''; }} className="text-gray-300 hover:text-red-400 text-xl leading-none">×</button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </Field>

          <Field label="店铺名称">
            <input className={INPUT} value={store} onChange={e => setStore(e.target.value)} placeholder="LOVE STORE" />
          </Field>

          <Field label="人数">
            <div className="flex items-center gap-3">
              <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition-colors flex items-center justify-center text-base">−</button>
              <span className="text-sm font-medium w-6 text-center">{guests}</span>
              <button onClick={() => setGuests(g => g + 1)} className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500 transition-colors flex items-center justify-center text-base">+</button>
              <span className="text-xs text-gray-400">人 &nbsp;·&nbsp; 人均 ¥{perPerson.toFixed(2)}</span>
            </div>
          </Field>

          <Field label="商品 / 价格">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input className="border border-gray-200 p-2 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="商品名" />
                <input className="border border-gray-200 p-2 w-24 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm" type="number" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="价格" />
                <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0">×</button>
              </div>
            ))}
            <button onClick={addItem} className="text-xs text-gray-400 hover:text-pink-500 transition-colors mt-1">＋ 添加一行</button>
          </Field>

          <Field label="底部情绪句（可自定义）">
            <textarea className={INPUT + " resize-none h-16 text-xs"} value={motto} onChange={e => setMotto(e.target.value)} placeholder="写下你想说的话…" />
          </Field>

          <div className="flex gap-2 mt-2">
            <button onClick={generateLink} className={`flex-1 py-2.5 rounded-xl text-sm text-white transition-colors font-medium ${copied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {copied ? '✓ 链接已复制' : '🔗 分享链接'}
            </button>
            <button onClick={exportImage} disabled={exporting} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-60 transition-colors font-medium">
              {exporting ? '生成中…' : '📥 下载小票'}
            </button>
          </div>
        </div>

        {/* ── Receipt preview ── */}
        <div
          ref={receiptRef}
          className="rcpt relative"
          style={{
            width: '300px',
            background: `${paperBg}, #f5f0e8`,
            boxShadow: '0 6px 32px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {/* Top serrated */}
          <div style={{ width: '100%', height: '16px', background: 'radial-gradient(circle at 50% 0%, #f5f0e8 71%, transparent 71%) center -8px / 16px 16px repeat-x, #e8dfc8' }} />

          <div style={{ padding: '6px 26px 18px' }}>

            {/* Logo */}
            <div style={{ textAlign: 'center', margin: '10px 0 8px' }}>
              {logoImg
                ? <img src={logoImg} alt="logo" style={{ height: '56px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto', display: 'block' }} />
                : <div style={{ fontSize: '38px', lineHeight: 1.1 }}>{logoText || '♥'}</div>
              }
            </div>

            {/* Store name */}
            <div className="rcpt-lg" style={{ textAlign: 'center', marginBottom: '5px' }}>
              {store || 'LOVE STORE'}
            </div>

            {/* Date / time */}
            <div className="rcpt-sm" style={{ textAlign: 'center', marginBottom: '10px' }}>
              {dateStr}　{timeStr}
            </div>

            {/* Order + guests */}
            <div className="rcpt-sm" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>ORDER #{orderNo}</span>
              <span>GUESTS × {guests}</span>
            </div>

            <div style={{ borderTop: '1px dashed #c4b89a', margin: '6px 0' }} />

            {/* Items */}
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span>{item.name || '---'}</span>
                <span>¥{(item.price || 0).toFixed(2)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #c4b89a', margin: '6px 0' }} />

            {/* Total */}
            <div className="rcpt-lg" style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 2px', fontSize: '10px' }}>
              <span>TOTAL</span>
              <span>¥{total.toFixed(2)}</span>
            </div>

            {/* Per person */}
            {guests > 1 && (
              <div className="rcpt-sm" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>人均 / {guests} pax</span>
                <span>¥{perPerson.toFixed(2)}</span>
              </div>
            )}

            {/* Motto */}
            {motto && (
              <div style={{ textAlign: 'center', margin: '14px 0 8px', color: '#7a6e5f', fontSize: '7.5px', lineHeight: 2.2, fontStyle: 'italic', borderTop: '1px solid #d8ceba', paddingTop: '12px' }}>
                &ldquo;{motto}&rdquo;
              </div>
            )}

            {/* Barcode */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1px', marginTop: '14px' }}>
              {BARCODE.widths.map((w, i) => (
                <div key={i} style={{ width: `${w}px`, height: i % 7 === 0 ? '30px' : '22px', background: '#3a2e1e', opacity: 0.75 }} />
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: '6px', color: '#b5a88a', marginTop: '4px', letterSpacing: '0.22em' }}>
              {BARCODE.num}
            </div>
          </div>

          {/* Bottom serrated */}
          <div style={{ width: '100%', height: '16px', background: 'radial-gradient(circle at 50% 100%, #f5f0e8 71%, transparent 71%) center 8px / 16px 16px repeat-x, #e8dfc8' }} />
        </div>

        <p style={{ marginTop: '32px', fontSize: '11px', color: '#ccc' }}>made with 💔</p>
      </div>
    </>
  );
}
