# Copy Trading Control System - Implementation Guide

## Overview
This implementation adds the ability for master traders to control copy trading for individual followers. Masters can now **start** or **stop** copy trading for each follower, and all follower trades will automatically stop when disabled and resume when enabled.

## Features Implemented

### 1. **Individual Follower Copy Trading Control**
   - Each follower has a `copy_trading_enabled` flag in the database
   - Master/Admin can toggle copy trading on/off for each follower with a single click
   - Real-time UI updates showing active/stopped status

### 2. **Enhanced Followers Dashboard**
   - **Start/Stop Button**: Toggle copy trading for each follower
   - **P/L Statistics**: Display total profit/loss for each follower
   - **Win Rate**: Show wins/losses and win percentage
   - **Status Indicator**: Visual indicator (green/red dot) showing if copy trading is active
   - **Performance Chart**: Line chart showing cumulative P/L over time
   - **Color Coding**: Red background when copy trading is stopped

### 3. **Database Schema Update**
   - New column: `copy_trading_enabled` (TINYINT, default 1/TRUE)
   - Follower trades are aggregated and displayed per follower

### 4. **API Endpoints**

#### Get/Update Follower Status
```
GET /api/followers/{id}/status
  Returns: { success, follower: { id, followerKey, name, mt5Login, copyTradingEnabled, ... } }

PATCH /api/followers/{id}/status
  Body: { copyTradingEnabled: true/false }
  Returns: { success, message, followerId, copyTradingEnabled }
```

#### List All Followers (Enhanced)
```
GET /api/followers
  Returns followers with copyTradingEnabled field included
```

### 5. **Signal Execution Flow**
When MT5 polls for signals, it will only receive signals if:
- The follower account is ACTIVE
- The follower's `copy_trading_enabled` is TRUE (1)
- There are pending signals available

**Query Logic**: Updated to check both `follower_accounts.status` and `follower_accounts.copy_trading_enabled`

## Setup Instructions

### Step 1: Run Database Migration
Execute the migration script to add the new column:

```bash
# Via MySQL CLI
mysql -u your_user -p your_database < sql/add-copy-trading-status.sql

# Or manually in phpMyAdmin/MySQL Workbench:
ALTER TABLE follower_accounts ADD COLUMN IF NOT EXISTS copy_trading_enabled TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE follower_accounts ADD INDEX IF NOT EXISTS idx_copy_trading_enabled (copy_trading_enabled);
```

### Step 2: Restart the Application
```bash
npm run dev
```

## How to Use

### Master/Admin Dashboard
1. Open the **Followers Dashboard** on the app
2. Each follower card now displays:
   - **P/L**: Total profit/loss from executed trades
   - **W/L**: Win/Loss count
   - **Win %**: Win rate percentage
   - **Chart**: Visual P/L trend
   - **Start/Stop Button**: Toggle copy trading status

### Starting Copy Trading for a Follower
1. Click the **"Start"** button (green) on any stopped follower card
2. The button changes to **"Stop"** (red)
3. Green status indicator appears
4. MT5 will now receive signals for that follower

### Stopping Copy Trading for a Follower
1. Click the **"Stop"** button (red) on any active follower card
2. The button changes to **"Start"** (green)
3. Red status indicator appears
4. MT5 will **NOT** receive any new signals for that follower
5. Existing open positions remain (they can be closed manually or via master CLOSE signal)

### Monitoring Follower Performance
- **Total P/L**: Quick view of cumulative profit/loss
- **Win Rate**: Understand trader performance percentage
- **Chart**: See the equity curve and trend over time
- **Status Dot**: Green = Active, Red = Stopped

## Technical Architecture

### Database Changes
```sql
-- follower_accounts table now includes:
- copy_trading_enabled TINYINT(1) DEFAULT 1
```

### Signal Query Updates
The signals API now filters by:
```sql
WHERE f.follower_key = ? 
  AND f.status = 'ACTIVE' 
  AND fa.copy_trading_enabled = 1  -- NEW CHECK
  AND s.status IN ('PENDING', 'PENDING_CLOSE')
```

### Frontend Components
**[FollowersDashboard.tsx](../../components/dashboard/FollowersDashboard.tsx)** - Updated with:
- `toggleCopyTrading()` function to call the PATCH API
- `calculateTotalPnL()` to sum trades for each follower
- `calculateWinRate()` to compute win/loss stats
- Enhanced UI with stats, controls, and visual indicators

### Backend API
**[/api/followers/[id]/status/route.ts](../../app/api/followers/[id]/status/route.ts)** - New endpoint:
- GET to fetch current status
- PATCH to toggle copy trading

**[/api/signals/route.ts](../../app/api/signals/route.ts)** - Updated:
- Joined `follower_accounts` table in query
- Checks `copy_trading_enabled = 1` before returning signals

## Workflow Example

### Scenario: Master wants to pause a follower to review performance

1. Master opens Followers Dashboard
2. Sees "Alpha Demo" follower with -$250 P/L and 35% win rate
3. Clicks **"Stop"** button on Alpha Demo card
4. API sends PATCH request to `/api/followers/{id}/status`
5. Database updates: `copy_trading_enabled = 0`
6. UI shows red background, "Start" button, red status indicator
7. Next time MT5 polls for signals, query filters out Alpha Demo
8. Alpha Demo no longer receives new signals
9. Master can review the account or make adjustments
10. When ready, Master clicks **"Start"** to resume
11. Next poll, Alpha Demo receives signals again

## Testing the Feature

### Mock Mode (No Database)
The system works with mock data when `USE_MOCK_DB=true`:
- Mock followers have `copyTradingEnabled: true` by default
- Toggle buttons work (state updates in UI)
- To see database behavior, set up MySQL connection

### Database Mode
1. Ensure MySQL is configured via environment variables
2. Run the migration SQL script
3. All changes persist in database
4. Check `follower_accounts` table: `SELECT * FROM follower_accounts;`

## Advanced Usage

### Bulk Stop All Followers
To stop all followers at once (for market emergencies):
```javascript
// In browser console or add button to UI
const followers = await fetch('/api/followers').then(r => r.json()).then(j => j.followers);
for (const follower of followers) {
  await fetch(`/api/followers/${follower.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ copyTradingEnabled: false })
  });
}
```

### Query Active Followers Only
```sql
SELECT * FROM follower_accounts WHERE copy_trading_enabled = 1 AND status = 'ACTIVE';
```

## Troubleshooting

### Signals not stopping when I click Stop
1. Check database migration was run: `DESCRIBE follower_accounts;` - should show `copy_trading_enabled` column
2. Verify MT5 bridge is polling with correct follower_key
3. Check browser console for API errors
4. Restart the app and MT5 EA

### P/L not calculating correctly
1. Ensure trades are being saved to `follower_trades` table
2. Check follower_key matches between `follower_accounts` and `follower_trades`
3. Verify `profit_loss` values are numeric in database

### Button not responding
1. Check browser network tab for 404 errors
2. Verify follower ID is correct
3. Check server logs for errors

## Database Schema Reference

```sql
-- follower_accounts table structure
CREATE TABLE follower_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  follower_key VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255),
  mt5_login VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  copy_trading_enabled TINYINT(1) NOT NULL DEFAULT 1,  -- NEW
  last_seen TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Performance Notes

- Dashboard fetches follower list and trades on component load
- Each follower card calculates P/L and win rate on client-side
- Start/Stop toggles are instant in UI with server sync
- Consider adding pagination if > 50 followers

## Future Enhancements

1. **Scheduled Copy Trading**: Start/Stop at specific times
2. **Per-Pair Control**: Enable/disable specific currency pairs per follower
3. **Risk Limits**: Auto-stop if losses exceed threshold
4. **Batch Operations**: Start/Stop multiple followers at once
5. **Audit Log**: Track who stopped/started which followers and when
6. **Email Notifications**: Alert when copy trading is toggled

## Related Files Modified

- [sql/add-copy-trading-status.sql](../sql/add-copy-trading-status.sql) - Migration script
- [src/app/api/followers/route.ts](../src/app/api/followers/route.ts) - Enhanced with copyTradingEnabled
- [src/app/api/followers/[id]/status/route.ts](../src/app/api/followers/[id]/status/route.ts) - NEW endpoint
- [src/app/api/signals/route.ts](../src/app/api/signals/route.ts) - Updated signal query logic
- [src/components/dashboard/FollowersDashboard.tsx](../src/components/dashboard/FollowersDashboard.tsx) - Enhanced UI

---

**Questions?** Check the relevant component or API file for inline comments.
