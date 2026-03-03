-- ============================================
-- AgentPit - Supabase Schema Migration
-- 001: Initial schema
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE,
  email TEXT UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'free',  -- free | starter | pro | whale
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- Agents
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- LLM config
  llm_provider TEXT NOT NULL DEFAULT 'deepseek',
  llm_model TEXT NOT NULL DEFAULT 'deepseek-chat',
  
  -- Trading config
  symbol TEXT NOT NULL,
  max_position_size NUMERIC NOT NULL DEFAULT 1000,
  max_leverage INTEGER NOT NULL DEFAULT 10,
  decision_interval_ms INTEGER NOT NULL DEFAULT 300000,
  
  -- Strategy (stored as JSONB)
  strategy JSONB NOT NULL DEFAULT '{}',
  
  -- Risk config (stored as JSONB)
  risk_config JSONB NOT NULL DEFAULT '{}',
  
  -- State
  status TEXT NOT NULL DEFAULT 'idle',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);

-- ============================================
-- API Keys (BYOK - encrypted)
-- ============================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- ============================================
-- Trades
-- ============================================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,           -- 'long' | 'short'
  action TEXT NOT NULL,         -- 'open' | 'close' | 'reduce'
  size NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  realized_pnl NUMERIC,
  fee NUMERIC NOT NULL DEFAULT 0,
  reasoning TEXT,
  llm_decision JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_agent ON trades(agent_id);
CREATE INDEX idx_trades_executed ON trades(executed_at DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol);

-- ============================================
-- Open Positions
-- ============================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_positions_agent ON positions(agent_id);
CREATE INDEX idx_positions_open ON positions(agent_id, is_open) WHERE is_open = TRUE;

-- ============================================
-- Agent Events (audit log)
-- ============================================
CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,    -- 'decision' | 'trade' | 'error' | 'status_change' | 'risk_alert'
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_agent ON agent_events(agent_id);
CREATE INDEX idx_events_type ON agent_events(event_type);
CREATE INDEX idx_events_created ON agent_events(created_at DESC);

-- ============================================
-- Performance Stats (materialized per agent per day)
-- ============================================
CREATE TABLE agent_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  avg_trade_duration_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(agent_id, date)
);

CREATE INDEX idx_perf_agent ON agent_performance(agent_id);
CREATE INDEX idx_perf_date ON agent_performance(date DESC);

-- ============================================
-- Row Level Security (RLS)
-- Users can only see their own data
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own row
CREATE POLICY users_own ON users
  FOR ALL USING (id = auth.uid());

-- Agents: users can CRUD their own agents
CREATE POLICY agents_own ON agents
  FOR ALL USING (user_id = auth.uid());

-- API Keys: users can CRUD their own keys
CREATE POLICY api_keys_own ON api_keys
  FOR ALL USING (user_id = auth.uid());

-- Trades: users can read trades for their agents
CREATE POLICY trades_own ON trades
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- Positions: users can read positions for their agents
CREATE POLICY positions_own ON positions
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- Events: users can read events for their agents
CREATE POLICY events_own ON agent_events
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- Performance: users can read performance for their agents
CREATE POLICY perf_own ON agent_performance
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
