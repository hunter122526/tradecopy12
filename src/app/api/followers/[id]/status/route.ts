import { NextResponse, NextRequest } from 'next/server';
import { query as sqlQuery } from '@/lib/database';

/**
 * API endpoint to manage individual follower copy trading status
 * GET /api/followers/[id]/status - Get follower status
 * PATCH /api/followers/[id]/status - Toggle or set copy trading status
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const followerId = params.id;

    const [rows] = await sqlQuery(
      `SELECT id, follower_key AS followerKey, name, mt5_login AS mt5Login, 
              status, copy_trading_enabled AS copyTradingEnabled, 
              last_seen AS lastSeen, created_at 
       FROM follower_accounts WHERE id = ?`,
      [followerId]
    );

    const followers = Array.isArray(rows) ? rows : [];
    if (followers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Follower not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      follower: followers[0],
    });
  } catch (err: any) {
    console.error('Followers status GET failed', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const followerId = params.id;
    const body = await request.json();
    const { copyTradingEnabled } = body;

    if (copyTradingEnabled === undefined || copyTradingEnabled === null) {
      return NextResponse.json(
        { success: false, error: 'Missing copyTradingEnabled field' },
        { status: 400 }
      );
    }

    const enabledValue = copyTradingEnabled ? 1 : 0;

    const [result] = await sqlQuery(
      `UPDATE follower_accounts SET copy_trading_enabled = ? WHERE id = ?`,
      [enabledValue, followerId]
    );

    const updateInfo = (result as any);
    if (updateInfo.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Follower not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Copy trading ${enabledValue ? 'enabled' : 'disabled'} for follower`,
      followerId,
      copyTradingEnabled: enabledValue === 1,
    });
  } catch (err: any) {
    console.error('Followers status PATCH failed', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
