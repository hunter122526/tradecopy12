import { NextResponse, NextRequest } from 'next/server';
import { query as sqlQuery, db, isDatabaseMock } from '@/lib/database';

const useMockDb = process.env.USE_MOCK_DB === 'true';

const MOCK_TRADES = [
  { id: 't1', followerKey: 'F-101', symbol: 'EURUSD', side: 'BUY', volume: 0.01, price: 1.0905, profitLoss: 2.4, created_at: new Date().toISOString() },
  { id: 't2', followerKey: 'F-102', symbol: 'GBPUSD', side: 'SELL', volume: 0.02, price: 1.2720, profitLoss: -1.1, created_at: new Date().toISOString() },
];

export async function GET(request: NextRequest) {
  const followerKey = (request.nextUrl.searchParams.get('followerKey') || '').trim();
  const limit = Number(request.nextUrl.searchParams.get('limit') || 50);

  if (useMockDb && isDatabaseMock()) {
    const trades = followerKey ? MOCK_TRADES.filter(t => t.followerKey === followerKey) : MOCK_TRADES;
    return NextResponse.json({ success: true, count: trades.length, trades });
  }

  try {
    if (followerKey) {
      const [rows] = await sqlQuery(
        `SELECT id, follower_key AS followerKey, symbol, side, volume, price, profit_loss AS profitLoss, created_at FROM follower_trades WHERE follower_key = ? ORDER BY created_at DESC LIMIT ?`,
        [followerKey, limit]
      );
      const trades = Array.isArray(rows) ? rows : [];
      return NextResponse.json({ success: true, count: trades.length, trades });
    }

    const [rows] = await sqlQuery(
      `SELECT id, follower_key AS followerKey, symbol, side, volume, price, profit_loss AS profitLoss, created_at FROM follower_trades ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    const trades = Array.isArray(rows) ? rows : [];
    return NextResponse.json({ success: true, count: trades.length, trades });
  } catch (err: any) {
    console.error('Trades GET failed', err);
    if (useMockDb && isDatabaseMock()) {
      const trades = followerKey ? MOCK_TRADES.filter(t => t.followerKey === followerKey) : MOCK_TRADES;
      return NextResponse.json({ success: true, count: trades.length, trades });
    }
    return NextResponse.json({ success: false, error: err?.message || 'failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const followerKey = (body.followerKey || body.follower_key || '').toString().trim();
    const symbol = (body.symbol || '').toString().toUpperCase();
    const side = (body.side || 'BUY').toString().toUpperCase();
    const volume = Number(body.volume || 0) || 0;
    const price = Number(body.price || 0) || 0;
    const profitLoss = Number(body.profitLoss ?? body.profit_loss ?? 0) || 0;

    if (!followerKey || !symbol) {
      return NextResponse.json({ success: false, error: 'Missing followerKey or symbol' }, { status: 400 });
    }

    try {
      const [result] = await db.execute(
        `INSERT INTO follower_trades (follower_key, symbol, side, volume, price, profit_loss) VALUES (?, ?, ?, ?, ?, ?);`,
        [followerKey, symbol, side, volume, price, profitLoss]
      );
      const insertInfo = result as { insertId?: number };
      return NextResponse.json({ success: true, tradeId: insertInfo.insertId ?? null });
    } catch (sqlErr: any) {
      console.error('Trades insert failed', sqlErr);
      if (sqlErr?.errno) {
        return NextResponse.json({ success: false, error: 'DB insert failed', details: sqlErr?.message }, { status: 500 });
      }
      throw sqlErr;
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'failed' }, { status: 500 });
  }
}
