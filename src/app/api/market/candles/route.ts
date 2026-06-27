import { NextResponse, NextRequest } from 'next/server';

function seededRandom(seed: number) {
  let t = seed % 2147483647;
  return () => {
    t = (t * 16807) % 2147483647;
    return (t - 1) / 2147483646;
  };
}

function generateMockCandles(symbol: string, period: string, limit = 200) {
  const base = 1.05 + (symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 50) / 1000;
  const rng = seededRandom(symbol.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  const candles: any[] = [];
  let last = base;
  for (let i = 0; i < limit; i++) {
    const vol = Math.max(0.0001, (rng() - 0.4) * 0.02);
    const open = last;
    const close = +(last * (1 + (rng() - 0.5) * 0.003)).toFixed(5);
    const high = Math.max(open, close) * (1 + Math.abs(rng()) * 0.0008);
    const low = Math.min(open, close) * (1 - Math.abs(rng()) * 0.0008);
    candles.push({ time: Math.floor(Date.now() / 1000) - (limit - i) * 60, open, high: +high.toFixed(5), low: +low.toFixed(5), close });
    last = close;
  }
  return candles;
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || 'EURUSD').toString().toUpperCase();
  const period = (request.nextUrl.searchParams.get('period') || '1m').toString();
  const limit = Number(request.nextUrl.searchParams.get('limit') || 200);

  // Try provider if configured. Support a provider URL template via env:
  // MARKET_DATA_PROVIDER_URL (e.g. https://api.example.com/ohlc?symbol={symbol}&interval={period}&limit={limit}&apikey={apikey})
  const provider = (process.env.MARKET_DATA_PROVIDER || '').toLowerCase();
  const apiKey = process.env.MARKET_DATA_API_KEY || '';

  if (provider === 'metaapi' && apiKey) {
    try {
      // MetaApi expects Authorization: Bearer <token>. Using their history endpoint.
      const url = `https://app.metaapi.cloud/v1/marketdata/history?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(period)}&count=${limit}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch (e) { throw new Error('MetaApi returned non-JSON response'); }

      // MetaApi returns array of candles or object with array; try common shapes
      const candidates = data.candles || data.data || data || [];
      if (Array.isArray(candidates) && candidates.length) {
        const mapped = candidates.slice(-limit).map((item: any) => {
          const timeRaw = item.time ?? item.t ?? item.timestamp ?? item[0] ?? item.date;
          const open = item.open ?? item.o ?? item[1];
          const high = item.high ?? item.h ?? item[2];
          const low = item.low ?? item.l ?? item[3];
          const close = item.close ?? item.c ?? item[4];
          const time = typeof timeRaw === 'number' ? Math.floor(timeRaw) : Math.floor(new Date(String(timeRaw)).getTime() / 1000);
          return { time, open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
        }).filter((c: any) => Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));

        if (mapped.length) return NextResponse.json({ success: true, symbol, period, candles: mapped });
      }
      throw new Error('MetaApi returned unexpected shape');
    } catch (err: any) {
      console.warn('MetaApi fetch failed:', err?.message || err);
    }
  }

  // fallback to mock
  const candles = generateMockCandles(symbol, period, limit);
  return NextResponse.json({ success: true, symbol, period, candles });
}
