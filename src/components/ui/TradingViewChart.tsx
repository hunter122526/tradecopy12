"use client";

import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView: any;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((window as any).TradingView) return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load script')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(s);
  });
}

async function waitForTradingView(maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if ((window as any).TradingView && (window as any).TradingView.widget) {
      return (window as any).TradingView;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('TradingView global not available after script load');
}

function mapSymbolToTradingView(sym: string) {
  // Heuristic mapping: FX -> OANDA, crypto -> BINANCE
  const s = sym.toUpperCase();
  if (s.startsWith('BTC') || s.startsWith('ETH')) return `BINANCE:${s.replace(/USD$/,'USDT')}`;
  if (s.includes('XAU') || s.includes('XAG')) return `OANDA:${s}`;
  return `OANDA:${s}`;
}

function mapInterval(tf: string) {
  if (tf === '1M' || tf === 'M') return 'M';
  const t = tf.toLowerCase();
  if (t === '1m' || t === '1min') return '1';
  if (t === '3m') return '3';
  if (t === '5m') return '5';
  if (t === '15m') return '15';
  if (t === '30m') return '30';
  if (t === '1h' || t === '60m') return '60';
  if (t === '2h') return '120';
  if (t === '4h') return '240';
  if (t === '1d' || t === '1D') return 'D';
  if (t === '1w') return 'W';
  return '60';
}

export default function TradingViewChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await loadScript('https://s3.tradingview.com/tv.js');
        const TradingView = await waitForTradingView(5000);
        if (cancelled || !containerRef.current) return;
        const tvSymbol = mapSymbolToTradingView(symbol);
        const resolution = mapInterval(timeframe);

        if (widgetRef.current && widgetRef.current.remove) {
          try { widgetRef.current.remove(); } catch (e) { /* ignore */ }
          widgetRef.current = null;
        }

        widgetRef.current = new TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: resolution,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#071023',
          container_id: containerRef.current.id,
          studies: ['MAExp@tv-basicstudies'],
        });
      } catch (err) {
        console.error('TradingView load failed', err);
      }
    }
    init();
    return () => { cancelled = true; if (widgetRef.current && widgetRef.current.remove) try { widgetRef.current.remove(); } catch(e){} };
  }, [symbol, timeframe]);

  // unique id per instance
  const idRef = useRef(`tradingview_${Math.random().toString(36).slice(2,9)}`);
  return <div id={idRef.current} ref={containerRef} className="w-full h-full" style={{ minHeight: 300 }} />;
}
