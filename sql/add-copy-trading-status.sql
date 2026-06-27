-- Add copy_trading_enabled column to follower_accounts table
-- This allows master/admin to start/stop copy trading for specific followers

ALTER TABLE follower_accounts ADD COLUMN IF NOT EXISTS copy_trading_enabled TINYINT(1) NOT NULL DEFAULT 1;

-- Add index for faster queries
ALTER TABLE follower_accounts ADD INDEX IF NOT EXISTS idx_copy_trading_enabled (copy_trading_enabled);

-- Display current status
SELECT id, follower_key, name, copy_trading_enabled FROM follower_accounts;
