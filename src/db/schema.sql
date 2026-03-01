-- ============================================
-- AgentPit - Database Schema
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  symbol TEXT NOT NULL,
  strategy_template TEXT NOT NULL,
  strategy_config JSONB NOT NULL DEFAULT '{}',
  risk_config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'idle',
  max_leverage INTEGER NOT NULL DEFAULT 10,
  max_position_size NUMERIC NOT NULL DEFAULT 1000,
  decision_interval_ms INTEGER NOT NULL DEFAULT 300000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  action TEXT NOT NULL,
  size NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  leverage INTEGER NOT NULL,
  realized_pnl NUMERIC,
  fee NUMERIC NOT NULL,
  reasoning TEXT,
  llm_decision JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  leverage INTEGER NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE(agent_id, symbol, side)
);

-- API Keys table (encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Agent Events table
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_trades_agent_id ON trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_agent_id ON positions(agent_id);
CREATE INDEX IF NOT EXISTS idx_positions_closed_at ON positions(closed_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON agent_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_timestamp ON agent_events(timestamp DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts';
COMMENT ON TABLE agents IS 'Trading agents configuration';
COMMENT ON TABLE trades IS 'Executed trades log';
COMMENT ON TABLE positions IS 'Open and closed positions';
COMMENT ON TABLE api_keys IS 'Encrypted API keys for BYOK';
COMMENT ON TABLE agent_events IS 'Agent events and decision log';
