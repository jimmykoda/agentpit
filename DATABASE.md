# AgentPit Database Setup

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for it to provision (~2 minutes)

### 2. Run Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Copy contents of `src/db/schema.sql`
3. Paste and click **Run**
4. Verify tables were created in **Table Editor**

### 3. Get Credentials

1. In Supabase dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **Anon (public) key** → `SUPABASE_ANON_KEY`

### 4. Configure `.env`

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ENCRYPTION_KEY=your_generated_64_char_hex_key
```

### 5. Test Connection

```bash
npm run dev
```

Should see:
```
[INFO] [Database] Supabase client initialized
[INFO] [AgentManager] AgentManager initialized
```

---

## Schema Overview

### Tables

| Table          | Purpose                           |
|----------------|-----------------------------------|
| `users`        | User accounts                     |
| `agents`       | Trading agent configurations      |
| `trades`       | Executed trades log               |
| `positions`    | Open and closed positions         |
| `api_keys`     | Encrypted API keys (BYOK)         |
| `agent_events` | Full event history for all agents |

### Indexes

All common queries are indexed:
- Agents by user_id and status
- Trades by agent_id and timestamp
- Positions by agent_id and closed_at
- Events by agent_id and timestamp

---

## Security Notes

### Row-Level Security (RLS)

**Default:** All tables are accessible by the anon key.

For multi-tenant production, enable RLS:

```sql
-- Example: Restrict agents to their owner
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own agents"
ON agents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own agents"
ON agents FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

Repeat for other tables as needed.

### API Key Encryption

- Keys are encrypted using AES-256-GCM
- Master key stored in `ENCRYPTION_KEY` env var
- **Never commit the master key to git**
- Rotate the master key periodically

---

## Useful Queries

### Agent Performance

```sql
-- PnL by agent
SELECT
  a.name,
  COUNT(t.id) as trade_count,
  SUM(t.realized_pnl) as total_pnl,
  AVG(t.realized_pnl) as avg_pnl
FROM agents a
LEFT JOIN trades t ON t.agent_id = a.id
WHERE t.realized_pnl IS NOT NULL
GROUP BY a.id, a.name
ORDER BY total_pnl DESC;
```

### Recent Activity

```sql
-- Last 100 events across all agents
SELECT
  a.name as agent_name,
  e.event_type,
  e.data,
  e.timestamp
FROM agent_events e
JOIN agents a ON a.id = e.agent_id
ORDER BY e.timestamp DESC
LIMIT 100;
```

### Open Positions

```sql
-- All open positions with current unrealized PnL
SELECT
  a.name as agent_name,
  p.symbol,
  p.side,
  p.size,
  p.entry_price,
  p.leverage,
  p.unrealized_pnl,
  p.opened_at
FROM positions p
JOIN agents a ON a.id = p.agent_id
WHERE p.closed_at IS NULL
ORDER BY p.opened_at DESC;
```

### Error Log

```sql
-- Recent errors
SELECT
  a.name as agent_name,
  e.data->>'error' as error_message,
  e.timestamp
FROM agent_events e
JOIN agents a ON a.id = e.agent_id
WHERE e.event_type = 'error'
ORDER BY e.timestamp DESC
LIMIT 50;
```

---

## Maintenance

### Cleanup Old Events

The `agent_events` table can grow large. Clean up old data:

```typescript
// In code
const eventRepo = new AgentEventRepository();
await eventRepo.deleteOlderThan(30); // Delete events older than 30 days
```

Or via SQL:

```sql
DELETE FROM agent_events
WHERE timestamp < NOW() - INTERVAL '30 days';
```

### Vacuum

Run occasionally to reclaim space:

```sql
VACUUM ANALYZE agent_events;
VACUUM ANALYZE trades;
```

---

## Backup

Supabase includes daily backups on paid plans.

For critical data, set up your own backup:

```bash
# Using pg_dump
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
```

---

## Troubleshooting

### Connection Issues

```
Error: Supabase URL and ANON_KEY must be configured
```

→ Check `.env` has correct values

### Authentication Errors

```
Error: JWT expired
```

→ RLS policies may be blocking access. Disable RLS for testing:

```sql
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
```

### Slow Queries

→ Check `EXPLAIN ANALYZE`:

```sql
EXPLAIN ANALYZE
SELECT * FROM trades WHERE agent_id = 'xxx';
```

→ Ensure indexes are present (run schema again if needed)

---

**Need help?** Check Supabase docs: [supabase.com/docs](https://supabase.com/docs)
