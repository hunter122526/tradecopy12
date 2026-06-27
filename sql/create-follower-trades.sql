-- Create table to store follower trade reports
CREATE TABLE IF NOT EXISTS follower_trades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  follower_key VARCHAR(128) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  side VARCHAR(32) NOT NULL,
  volume DECIMAL(18,8) NOT NULL DEFAULT 0,
  price DECIMAL(24,12) NOT NULL DEFAULT 0,
  profit_loss DECIMAL(24,12) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_follower_key (follower_key),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
