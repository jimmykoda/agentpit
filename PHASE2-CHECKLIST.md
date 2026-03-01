# ✅ Phase 2 Setup Checklist

Follow these steps to get Phase 2 running.

---

## 🎯 Prerequisites

- [ ] Node.js installed (v18+)
- [ ] Redis installed or Docker available
- [ ] Supabase account (free tier works)

---

## 📦 Step 1: Install Dependencies

Already installed in Phase 2:
```bash
npm install
```

New dependency added:
- `@supabase/supabase-js` ✅

---

## 🗄️ Step 2: Database Setup

### A. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose organization, name, and password
4. Wait ~2 minutes for provisioning

### B. Run Schema

1. In Supabase dashboard → **SQL Editor**
2. Click **New Query**
3. Open `src/db/schema.sql` in your editor
4. Copy entire contents
5. Paste into Supabase SQL Editor
6. Click **Run** (or Ctrl+Enter)
7. Verify no errors
8. Go to **Table Editor** and verify 6 tables exist:
   - users
   - agents
   - trades
   - positions
   - api_keys
   - agent_events

### C. Get Credentials

1. In Supabase dashboard → **Settings → API**
2. Copy:
   - **URL** (starts with `https://`)
   - **anon public** key (long JWT string)

---

## 🔐 Step 3: Generate Encryption Key

Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (64-character hex string).

---

## ⚙️ Step 4: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in:
   ```bash
   # Supabase
   SUPABASE_URL=https://xxxxx.supabase.co  # From Step 2C
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # From Step 2C
   
   # Encryption
   ENCRYPTION_KEY=abc123...  # From Step 3 (64 chars)
   
   # Redis (leave default if running locally)
   REDIS_URL=redis://localhost:6379
   
   # Scheduler (defaults are fine)
   SCHEDULER_CONCURRENCY=5
   SCHEDULER_MAX_JOBS_PER_SEC=10
   ```

3. **Important:** Make sure `.env` is in `.gitignore` (it already is)

---

## 🚀 Step 5: Start Redis

### Option A: Local Redis
```bash
redis-server
```

### Option B: Docker
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

Verify it's running:
```bash
redis-cli ping
# Should return: PONG
```

---

## ✅ Step 6: Verify Setup

Run the type checker:
```bash
npx tsc --noEmit
```

Should see no errors (already verified ✅).

---

## 🎬 Step 7: Launch AgentPit

```bash
npm run dev
```

### Expected Output

```
[INFO] [Main] === AgentPit Engine Starting ===
[INFO] [Main] Mode: TESTNET
[INFO] [MarketData] Connected to Hyperliquid WebSocket
[INFO] [Main] Market data connected
[INFO] [Database] Supabase client initialized
[INFO] [AgentManager] AgentManager initialized
[INFO] [Scheduler] Scheduler initialized
[INFO] [Scheduler] Worker started
[INFO] [AgentManager] AgentManager started
[INFO] [Main] --- Creating demo agents ---
[INFO] [AgentRepo] Agent created: xxxx (BTC Momentum Bot)
[INFO] [AgentRepo] Agent created: xxxx (ETH Scalper)
[INFO] [AgentRepo] Agent created: xxxx (SOL Mean Reversion)
[INFO] [Main] Demo agents created in database
[INFO] [AgentLoop] Starting agent "BTC Momentum Bot" [xxxx]
[INFO] [Scheduler] Scheduled repeatable job for agent BTC Momentum Bot every 300000ms
[INFO] [AgentRepo] Agent xxxx status updated: running
[INFO] [AgentManager] Agent BTC Momentum Bot started
... (same for ETH and SOL)
[INFO] [Main] === AgentPit Engine Running ===
[INFO] [Main] Managing 3 active agents
[INFO] [Main] Press Ctrl+C to stop
```

---

## 🎯 Step 8: Verify Database

While the system is running, check Supabase:

1. Go to **Table Editor**
2. Open `agents` table → should see 3 agents
3. Open `agent_events` table → should see events populating
4. Open `trades` table → will populate after first decisions

---

## 🛠️ Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
→ Start Redis (Step 5)

### Supabase Connection Error
```
Error: Supabase URL and ANON_KEY must be configured
```
→ Check `.env` has correct values (Step 4)

### Encryption Error
```
Error: ENCRYPTION_KEY not configured
```
→ Generate and add key to `.env` (Step 3-4)

### Market Data Error
```
Error: Could not connect to Hyperliquid
```
→ Check internet connection, verify `HL_WS_URL` in `.env`

---

## 📊 Monitoring

### View Logs
All logs go to console. Filter by component:
```
[AgentManager] ...
[Scheduler] ...
[AgentLoop] ...
[TradeRepo] ...
```

### Query Database
Use Supabase **SQL Editor**:

```sql
-- Recent agent activity
SELECT * FROM agent_events
ORDER BY timestamp DESC
LIMIT 50;

-- All active agents
SELECT * FROM agents
WHERE status = 'running';

-- Trades today
SELECT * FROM trades
WHERE timestamp > NOW() - INTERVAL '1 day';
```

### Scheduler Stats
Logged every minute:
```
[INFO] [Main] Scheduler: 3 active | 0 waiting | 45 completed | 0 failed
```

---

## 🎨 Next Steps

### Customize Agents
Edit `src/index.ts` to modify:
- Symbols (BTC, ETH, SOL, etc.)
- Strategies (momentum, scalping, mean_reversion, etc.)
- Risk parameters
- Decision intervals

### Add Web UI
Build a frontend to:
- Create/manage agents
- View live trades
- Monitor PnL
- Adjust configs

### Real Trading
When ready:
1. Set `TradeExecutor` mock mode to `false`
2. Add real Hyperliquid private key to `.env`
3. Test with small position sizes first!

---

## ✅ Completion Checklist

- [ ] Dependencies installed
- [ ] Supabase project created
- [ ] Schema executed
- [ ] `.env` configured
- [ ] Redis running
- [ ] AgentPit launches without errors
- [ ] Agents appear in database
- [ ] Events are logging

**All done?** 🎉 **Phase 2 is live!**

Read `phase2-summary.md` for full technical details.
Read `DATABASE.md` for database management tips.
