CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- One wallet per user. Balance stored in kobo (smallest NGN unit) to avoid
-- floating-point precision bugs. The CHECK constraint is a last-resort safety
-- net; the application enforces this earlier.
CREATE TABLE IF NOT EXISTS wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable ledger — rows are never updated or deleted.
-- Both successful and failed transactions are recorded for auditability.
-- from_wallet_id is NULL for deposits (no sender).
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'transfer')),
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id   UUID NOT NULL REFERENCES wallets(id),
  amount         INTEGER NOT NULL CHECK (amount > 0),
  status         VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  reference      UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast transaction history lookups
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet  ON transactions(to_wallet_id);
