
import { NextResponse, NextRequest } from 'next/server';
import { db, query as sqlQuery, isDatabaseMock } from '@/lib/database';
import { createPendingSignal, createPendingCloseSignal, listPendingSignals, markSignalExecuted } from '@/lib/signal-store';

const useMockDb = process.env.USE_MOCK_DB === 'true';

const MOCK_SIGNALS = [
  {
    id: 'mock-1',
    source: 'mock',
    currencyPair: 'EURUSD',
    direction: 'BUY',
    entryPrice: 1.09049,
    stopLoss: 1.08800,
    takeProfit: 1.09500,
    lotSize: 0.01,
    action: 'OPEN',
    status: 'PENDING',
    created_at: new Date().toISOString(),
    followerCount: 28,
  },
  {
    id: 'mock-2',
    source: 'mock',
    currencyPair: 'GBPUSD',
    direction: 'SELL',
    entryPrice: 1.27205,
    stopLoss: 1.27500,
    takeProfit: 1.26500,
    lotSize: 0.01,
    action: 'OPEN',
    status: 'PENDING',
    created_at: new Date().toISOString(),
    followerCount: 16,
  },
];

function isDbConnectionError(error: any) {
  if (!error) return false;
  const message = String(error.message || error.sqlMessage || '');
  return (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    message.includes('ECONNREFUSED') ||
    message.includes('connect ECONNREFUSED') ||
    message.includes('Connection refused')
  );
}

function isMissingActionColumnError(error: any) {
  if (!error) return false;
  const message = String(error.message || error.sqlMessage || '');
  return error?.errno === 1054 && /unknown column .*action/i.test(message);
}

function isMissingColumnError(error: any, columnName: string) {
  if (!error) return false;
  const message = String(error.message || error.sqlMessage || '');
  return error?.errno === 1054 && new RegExp(`unknown column .*${columnName}`, 'i').test(message);
}

function normalizeLotSize(value: any) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.01;
  return Math.max(0.0001, Number(parsed.toFixed(4)));
}

/**
 * @fileOverview Self-Hosted Signal API
 * This endpoint is now MySQL-only and returns pending signals from your own server database.
 */

export async function GET(request: NextRequest) {
  const followerKey = (request.nextUrl.searchParams.get('followerKey') || '').trim();
  const statusParam = (request.nextUrl.searchParams.get('status') || '').toString().toUpperCase();
  const includeAll = statusParam === 'ALL';
  const statusFilter = includeAll ? null : (statusParam || 'PENDING');

  if (useMockDb && isDatabaseMock()) {
    const signals = listPendingSignals().map((row) => ({
      id: row.id,
      source: row.source,
      currencyPair: row.currencyPair,
      direction: row.direction,
      entryPrice: row.entryPrice,
      stopLoss: row.stopLoss,
      takeProfit: row.takeProfit,
      lotSize: row.lotSize ?? 0.01,
      action: row.action,
      status: row.status,
      createdAt: row.createdAt,
      followerCount: row.followerCount,
    }));
    return NextResponse.json({
      success: true,
      count: signals.length,
      followerKey: followerKey || null,
      signals,
      serverTime: new Date().toISOString(),
    });
  }

  try {
    let sqlSignals: any[] = [];
    try {
      if (followerKey) {
        try {
          const params: any[] = [followerKey];
          let statusWhere = '';
          if (statusFilter === 'PENDING') {
            statusWhere = "AND (s.status = 'PENDING' OR s.status = 'PENDING_CLOSE')";
          } else if (statusFilter) {
            statusWhere = 'AND s.status = ?';
            params.push(statusFilter);
          }
          const [rows] = await sqlQuery(
            `SELECT s.id, s.currency_pair AS currencyPair, s.direction, s.action, s.entry_price AS entryPrice, s.stop_loss AS stopLoss, s.take_profit AS takeProfit, COALESCE(s.lot_size, 0) AS lotSize, s.status, s.created_at
             FROM signals s
             JOIN followers f ON f.signal_id = s.id
             JOIN follower_accounts fa ON fa.follower_key = f.follower_key
             WHERE f.follower_key = ? AND f.status = 'ACTIVE' AND fa.copy_trading_enabled = 1 ${statusWhere} AND (f.last_seen IS NULL OR f.last_seen < s.created_at)
             ORDER BY s.created_at DESC
             LIMIT 1`,
            params
          );
          sqlSignals = Array.isArray(rows) ? rows : [];

          if (sqlSignals.length > 0) {
            const signalIds = sqlSignals.map((signal: any) => String(signal.id));
            const placeholders = signalIds.map(() => '?').join(',');
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            await sqlQuery(
              `UPDATE followers SET last_seen = ? WHERE follower_key = ? AND signal_id IN (${placeholders})`,
              [now, followerKey, ...signalIds]
            );
          }
          if (isMissingActionColumnError(sqlErr)) {
            const [rows] = await sqlQuery(
              `SELECT s.id, s.currency_pair AS currencyPair, s.direction, s.entry_price AS entryPrice, s.stop_loss AS stopLoss, s.take_profit AS takeProfit, s.status, s.created_at
               FROM signals s
               JOIN followers f ON f.signal_id = s.id
               JOIN follower_accounts fa ON fa.follower_key = f.follower_key
               WHERE f.follower_key = ? AND f.status = 'ACTIVE' AND fa.copy_trading_enabled = 1 AND s.status = 'PENDING' AND (f.last_seen IS NULL OR f.last_seen < s.created_at)
               ORDER BY s.created_at DESC
               LIMIT 1`,
              [followerKey]
            );
            sqlSignals = Array.isArray(rows) ? rows : [];

            if (sqlSignals.length > 0) {
              const signalIds = sqlSignals.map((signal: any) => String(signal.id));
              const placeholders = signalIds.map(() => '?').join(',');
              const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
              await sqlQuery(
                `UPDATE followers SET last_seen = ? WHERE follower_key = ? AND signal_id IN (${placeholders})`,
                [now, followerKey, ...signalIds]
              );
            }
          } else {
            throw sqlErr;
          }
        }
      } else {
        try {
          const params: any[] = [];
          const statusWhere = statusFilter ? 'WHERE s.status = ?' : '';
          if (statusFilter) params.push(statusFilter);
          const [rows] = await sqlQuery(
            `SELECT s.id, s.currency_pair AS currencyPair, s.direction, s.action, s.entry_price AS entryPrice, s.stop_loss AS stopLoss, s.take_profit AS takeProfit, COALESCE(s.lot_size, 0) AS lotSize, s.status, s.created_at,
                    COALESCE(SUM(f.status = 'ACTIVE'), 0) AS followerCount
             FROM signals s
             LEFT JOIN followers f ON f.signal_id = s.id
             ${statusWhere}
             GROUP BY s.id
             ORDER BY s.created_at DESC
             LIMIT 50`,
            params
          );
          sqlSignals = Array.isArray(rows) ? rows : [];
        } catch (sqlErr) {
          if (isMissingActionColumnError(sqlErr)) {
            const [rows] = await sqlQuery(
              `SELECT id, currency_pair AS currencyPair, direction, entry_price AS entryPrice, stop_loss AS stopLoss, take_profit AS takeProfit, status, created_at
               FROM signals
               WHERE status = ?
               ORDER BY created_at DESC
               LIMIT 50`,
              ['PENDING']
            );
            sqlSignals = Array.isArray(rows) ? rows : [];
          } else {
            throw sqlErr;
          }
        }
      }
    } catch (sqlErr: any) {
      console.error('SQL select failed', sqlErr);
      if (isDbConnectionError(sqlErr) || isMissingActionColumnError(sqlErr)) {
        if (useMockDb && isDatabaseMock()) {
          console.warn('Database error or schema mismatch, using mock signals', sqlErr?.message);
          const signals = MOCK_SIGNALS.map((row) => ({
            id: row.id,
            source: row.source,
            currencyPair: row.currencyPair,
            direction: row.direction,
            entryPrice: row.entryPrice,
            stopLoss: row.stopLoss,
            takeProfit: row.takeProfit,
            lotSize: row.lotSize ?? 0.01,
            action: row.action,
            status: row.status,
            createdAt: row.created_at,
            followerCount: row.followerCount,
          }));
          return NextResponse.json({
            success: true,
            count: signals.length,
            followerKey: followerKey || null,
            signals,
            serverTime: new Date().toISOString(),
          });
        }
      }
      throw sqlErr;
    }

    if (useMockDb && isDatabaseMock()) {
      const signals = MOCK_SIGNALS.map((row) => ({
        id: row.id,
        source: row.source,
        currencyPair: row.currencyPair,
        direction: row.direction,
        entryPrice: row.entryPrice,
        stopLoss: row.stopLoss,
        takeProfit: row.takeProfit,
        action: row.action,
        status: row.status,
        createdAt: row.created_at,
        followerCount: row.followerCount,
      }));
      return NextResponse.json({
        success: true,
        count: signals.length,
        followerKey: followerKey || null,
        signals,
        serverTime: new Date().toISOString(),
      });
    }

    const signals = sqlSignals.map((row: any) => {
      const inferredAction = row.action || (row.status === 'PENDING_CLOSE' ? 'CLOSE' : 'OPEN');
      return {
        id: String(row.id),
        source: 'mysql',
        currencyPair: row.currencyPair,
        direction: row.direction,
        entryPrice: Number(row.entryPrice),
        stopLoss: Number(row.stopLoss),
        takeProfit: Number(row.takeProfit),
        lotSize: normalizeLotSize(row.lotSize ?? row.lots ?? row.volume ?? 0.01),
        action: inferredAction,
        status: row.status,
        createdAt: row.created_at
      };
    });

    return NextResponse.json({
      success: true,
      count: signals.length,
      followerKey: followerKey || null,
      signals,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    const isFieldError = error?.errno === 1054;
    if ((isDbConnectionError(error) || isFieldError) && useMockDb && isDatabaseMock()) {
      console.warn('Using mock signals because database is unavailable or has schema issues:', error?.message);
      const signals = MOCK_SIGNALS.map((row) => ({
        id: row.id,
        source: row.source,
        currencyPair: row.currencyPair,
        direction: row.direction,
        entryPrice: row.entryPrice,
        stopLoss: row.stopLoss,
        takeProfit: row.takeProfit,
        action: row.action,
        status: row.status,
        createdAt: row.created_at,
        followerCount: row.followerCount,
      }));
      return NextResponse.json({
        success: true,
        count: signals.length,
        followerKey: followerKey || null,
        signals,
        serverTime: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = (body.action || request.nextUrl?.searchParams.get('action') || 'create').toString().toLowerCase();

    if (action === 'ack' || action === 'complete') {
      const signalId = body.signalId || body.id;
      if (!signalId) {
        return NextResponse.json({ success: false, error: 'Missing signalId for acknowledgement' }, { status: 400 });
      }

      try {
        await sqlQuery(`UPDATE signals SET status = ? WHERE id = ?`, ['EXECUTED', signalId]);
      } catch (sqlErr: any) {
        console.error('SQL update failed', sqlErr);
        if (sqlErr?.errno === 1054 || isDbConnectionError(sqlErr)) {
          console.warn('Schema error or database unavailable for update, continuing anyway');
        } else {
          return NextResponse.json({ success: false, error: 'MySQL update failed' }, { status: 500 });
        }
      }

      markSignalExecuted(signalId);
      return NextResponse.json({ success: true, acknowledged: true, signalId });
    }

    const requestedSignalId = Number(body.signalId ?? body.id ?? 0) || null;
    let currencyPair = (body.currencyPair || body.pair || body.currency_pair || '').toString();
    let direction = (body.direction || body.side || body.type || 'BUY').toString().toUpperCase();
    const entryPrice = Number(body.entryPrice ?? body.entry_price ?? 0) || 0;
    const stopLoss = Number(body.stopLoss ?? body.stop_loss ?? 0) || 0;
    const takeProfit = Number(body.takeProfit ?? body.take_profit ?? 0) || 0;
    const lotSize = normalizeLotSize(body.lotSize ?? body.lots ?? body.volume ?? body.lot ?? 0.01);
    const followerKeys = Array.isArray(body.followerKeys)
      ? body.followerKeys.map((key: string) => String(key).trim()).filter(Boolean)
      : typeof body.followerKeys === 'string'
      ? body.followerKeys.split(',').map((key: string) => String(key).trim()).filter(Boolean)
      : Array.isArray(body.followers)
      ? body.followers.map((key: string) => String(key).trim()).filter(Boolean)
      : typeof body.followers === 'string'
      ? body.followers.split(',').map((key: string) => String(key).trim()).filter(Boolean)
      : [];

    if (requestedSignalId && (!currencyPair || !direction)) {
      try {
        const [rows] = await sqlQuery(
          `SELECT currency_pair AS currencyPair, direction FROM signals WHERE id = ? LIMIT 1`,
          [requestedSignalId]
        );
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (row) {
          currencyPair = currencyPair || row.currencyPair;
          direction = direction || row.direction;
        }
      } catch (sqlErr: any) {
        console.error('SQL lookup failed', sqlErr);
        // Continue with lookup failure - use whatever was provided in the request
      }
    }

    if (action === 'close') {
      if (!currencyPair) {
        return NextResponse.json({ success: false, error: 'Missing currencyPair for close action' }, { status: 400 });
      }

      let closeSignalId: number | null = null;
      try {
        try {
          const [result] = await db.execute(
            `INSERT INTO signals (currency_pair, direction, entry_price, stop_loss, take_profit, status, source, action) VALUES (?, ?, 0, 0, 0, 'PENDING', ?, 'CLOSE');`,
            [currencyPair, direction, 'app']
          );
          const insertInfo = result as { insertId?: number };
          closeSignalId = insertInfo.insertId ?? null;
        } catch (sqlErr: any) {
          if (isMissingActionColumnError(sqlErr)) {
            const [result] = await db.execute(
              `INSERT INTO signals (currency_pair, direction, entry_price, stop_loss, take_profit, status, source) VALUES (?, ?, 0, 0, 0, 'PENDING', ?);`,
              [currencyPair, direction, 'app']
            );
            const insertInfo = result as { insertId?: number };
            closeSignalId = insertInfo.insertId ?? null;
          } else {
            throw sqlErr;
          }
        }
      } catch (sqlErr: any) {
        console.error('SQL close signal insert failed', sqlErr);
        if (sqlErr?.errno === 1054 || isDbConnectionError(sqlErr)) {
          console.warn('Schema error or database unavailable for close insert, continuing');
        } else {
          return NextResponse.json({ success: false, error: 'MySQL insert failed' }, { status: 500 });
        }
      }

      let mappedFollowerKeys = followerKeys;
      if (!mappedFollowerKeys.length && requestedSignalId) {
        try {
          const [rows] = await sqlQuery(
            `SELECT follower_key FROM followers WHERE signal_id = ? AND status = 'ACTIVE'`,
            [requestedSignalId]
          );
          mappedFollowerKeys = Array.isArray(rows) ? rows.map((row: any) => String(row.follower_key).trim()).filter(Boolean) : [];
        } catch (sqlErr: any) {
          console.error('SQL follower lookup failed for close action', sqlErr);
          if (!(sqlErr?.errno === 1054 || isDbConnectionError(sqlErr))) {
            return NextResponse.json({ success: false, error: 'MySQL query failed' }, { status: 500 });
          }
        }
      }

      if (!mappedFollowerKeys.length) {
        try {
          const [rows] = await sqlQuery(`SELECT follower_key FROM follower_accounts WHERE status = 'ACTIVE'`, []);
          mappedFollowerKeys = Array.isArray(rows) ? rows.map((r: any) => String(r.follower_key).trim()).filter(Boolean) : [];
        } catch (sqlErr: any) {
          console.error('SQL follower_accounts lookup failed for close action', sqlErr);
        }
      }

      if (!mappedFollowerKeys.length && closeSignalId) {
        try {
          const [rows] = await sqlQuery(`SELECT follower_key FROM follower_accounts WHERE status = 'ACTIVE'`, []);
          mappedFollowerKeys = Array.isArray(rows) ? rows.map((r: any) => String(r.follower_key).trim()).filter(Boolean) : [];
        } catch (sqlErr: any) {
          console.error('SQL follower_accounts lookup failed for close action', sqlErr);
        }
      }

      if (closeSignalId && mappedFollowerKeys.length) {
        try {
          const followerValues = mappedFollowerKeys.map((key: string) => [key, closeSignalId, 'ACTIVE']);
          await db.query(
            `INSERT INTO followers (follower_key, signal_id, status) VALUES ?`,
            [followerValues]
          );
        } catch (sqlErr: any) {
          console.error('SQL close follower mapping insert failed', sqlErr);
          if (!(sqlErr?.errno === 1054 || isDbConnectionError(sqlErr))) {
            return NextResponse.json({ success: false, error: 'MySQL insert failed' }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ success: true, signalId: closeSignalId, followerKeys: mappedFollowerKeys });
    }

    const actionValue = 'OPEN';
    let signalId: number | null = null;
    let mappedFollowerKeys = followerKeys;

    if (currencyPair && direction) {
      try {
        const [existingRows] = await sqlQuery(
          `SELECT id FROM signals WHERE currency_pair = ? AND direction = ? AND status IN ('PENDING', 'PENDING_CLOSE') AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY created_at DESC LIMIT 1`,
          [currencyPair, direction]
        );
        const existingRow = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
        if (existingRow?.id) {
          return NextResponse.json({ success: true, signalId: Number(existingRow.id), duplicate: true, followerKeys: mappedFollowerKeys });
        }
      } catch (dupErr) {
        console.warn('Duplicate signal check failed', dupErr);
      }
    }

    try {
      try {
        const [result] = await db.execute(
          `INSERT INTO signals (currency_pair, direction, entry_price, stop_loss, take_profit, status, source, action, lot_size) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?);`,
          [currencyPair, direction, entryPrice, stopLoss, takeProfit, 'app', actionValue, lotSize]
        );
        const insertInfo = result as { insertId?: number };
        signalId = insertInfo.insertId ?? null;
      } catch (sqlErr: any) {
        if (isMissingActionColumnError(sqlErr) || isMissingColumnError(sqlErr, 'lot_size')) {
          const [result] = await db.execute(
            `INSERT INTO signals (currency_pair, direction, entry_price, stop_loss, take_profit, status, source) VALUES (?, ?, ?, ?, ?, 'PENDING', ?);`,
            [currencyPair, direction, entryPrice, stopLoss, takeProfit, 'app']
          );
          const insertInfo = result as { insertId?: number };
          signalId = insertInfo.insertId ?? null;
        } else {
          throw sqlErr;
        }
      }
    } catch (sqlErr: any) {
      console.error('SQL insert failed', sqlErr);
      if (sqlErr?.errno === 1054 || isDbConnectionError(sqlErr)) {
        console.warn('Schema error or database unavailable for signal insert, using in-memory fallback');
        const fallbackSignal = createPendingSignal({
          currencyPair,
          direction,
          entryPrice,
          stopLoss,
          takeProfit,
          action: actionValue,
          followerCount: followerKeys.length,
        });
        return NextResponse.json({ success: true, signalId: fallbackSignal.id, followerKeys, lotSize });
      }
      return NextResponse.json({ success: false, error: 'MySQL insert failed' }, { status: 500 });
    }

    if (!mappedFollowerKeys.length) {
      try {
        const [rows] = await sqlQuery(`SELECT follower_key FROM follower_accounts WHERE status = 'ACTIVE'`, []);
        mappedFollowerKeys = Array.isArray(rows) ? rows.map((r: any) => String(r.follower_key).trim()).filter(Boolean) : [];
      } catch (sqlErr: any) {
        console.error('SQL follower_accounts lookup failed for open action', sqlErr);
      }
    }

    if (signalId && mappedFollowerKeys.length) {
      try {
        const followerValues = mappedFollowerKeys.map((key: string) => [key, signalId, 'ACTIVE']);
        await db.query(
          `INSERT INTO followers (follower_key, signal_id, status) VALUES ?`,
          [followerValues]
        );
      } catch (sqlErr: any) {
        console.error('SQL follower mapping insert failed', sqlErr);
        if (!(sqlErr?.errno === 1054 || isDbConnectionError(sqlErr))) {
          return NextResponse.json({ success: false, error: 'MySQL insert failed' }, { status: 500 });
        }
      }
    }

    if (signalId === null) {
      const fallbackSignal = createPendingSignal({
        currencyPair,
        direction,
        entryPrice,
        stopLoss,
        takeProfit,
        lotSize,
        action: actionValue,
        followerCount: mappedFollowerKeys.length,
      });
      return NextResponse.json({ success: true, signalId: fallbackSignal.id, followerKeys: mappedFollowerKeys, lotSize });
    }

    return NextResponse.json({ success: true, signalId, followerKeys: mappedFollowerKeys, lotSize });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
