"use client";

import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

type Candle = { time: number; open: number; high: number; low: number; close: number };

export default function CandlestickChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
      layout: { background: { color: '#071023' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: 'rgba(203,213,225,0.03)' }, horzLines: { color: 'rgba(203,213,225,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(203,213,225,0.06)' },
      timeScale: { borderColor: 'rgba(203,213,225,0.06)', visible: true },
      crosshair: { mode: 1, horzLine: { color: 'rgba(203,213,225,0.06)' }, vertLine: { color: 'rgba(203,213,225,0.06)' } },
    });

    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#ef4444',
      borderVisible: true,
      borderColor: '#00000000',
      wickUpColor: '#16a34a',
      wickDownColor: '#ef4444',
      priceLineVisible: false,
    });

    const handleResize = () => {
      if (!ref.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function pollingIntervalFor(tf: string) {
      const t = tf.toLowerCase();
      if (t === '1s' || t === '1sec') return 1000;
      if (t === '1m' || t === '1min') return 3000;
      if (t === '5m') return 5000;
      if (t === '15m') return 10000;
      if (t === '1h' || t === '60m') return 15000;
      if (t === '1d' || t === '1D') return 60000;
      return 5000;
    }

    async function initialLoad() {
      try {
        const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(timeframe)}&limit=500`);
        const json = await res.json();
        if (cancelled) return;
        const candles: Candle[] = (json.candles || []).map((c: any) => ({ time: Number(c.time), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }));
        if (seriesRef.current) {
          seriesRef.current.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })) as any);
          lastTimeRef.current = candles.length ? candles[candles.length - 1].time : null;
        }
      } catch (err) {
        console.error('Failed to load candles', err);
      }
    }

    async function pollLatest() {
      try {
        // fetch only last 2 candles to catch updates to the latest incomplete candle
        const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(timeframe)}&limit=2`);
        const json = await res.json();
        if (cancelled) return;
        const candles: Candle[] = (json.candles || []).map((c: any) => ({ time: Number(c.time), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }));
        if (!candles.length || !seriesRef.current) return;
        // Ensure ascending order
        candles.sort((a, b) => a.time - b.time);
        for (const c of candles) {
          const last = lastTimeRef.current;
          if (last === null) {
            // no data yet, do a full reload
            await initialLoad();
            return;
          }
          if (c.time === last) {
            // update existing last candle
            seriesRef.current?.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close } as any);
          } else if (c.time > last) {
            // new candle(s)
            seriesRef.current?.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close } as any);
            lastTimeRef.current = c.time;
          }
        }
      } catch (err) {
        console.error('Failed to poll latest candles', err);
      }
    }

    // initial full load
    initialLoad();

    const iv = setInterval(pollLatest, pollingIntervalFor(timeframe));
    return () => { cancelled = true; clearInterval(iv); };
  }, [symbol, timeframe]);

  return <div ref={ref} className="w-full h-full" />;
}
