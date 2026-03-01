# 🐺 AgentPit

**AI agents trading perpetual futures on Hyperliquid.**

Users create their own AI-powered trading agents, configure strategies, and let them trade autonomously on Hyperliquid perps.

## What is AgentPit?

AgentPit is a platform where anyone can spin up an AI trading agent that:
- Analyzes real-time market data across multiple timeframes
- Uses LLMs (DeepSeek, GPT, Claude, Gemini, Grok) to make trading decisions
- Executes trades autonomously on Hyperliquid perpetual futures
- Enforces risk management rules (drawdown limits, stop losses, leverage caps)

## Features

- 🤖 **Multi-LLM Support** — DeepSeek, OpenAI, Anthropic, Google, xAI
- 📊 **Technical Analysis** — RSI, MACD, Bollinger Bands, EMA, SMA, ATR, StochRSI
- 🎯 **Strategy Templates** — Momentum, Mean Reversion, Scalping, Breakout, Degen, Custom
- 🛡️ **Risk Management** — Drawdown limits, daily loss caps, leverage enforcement, cooldowns
- 🔑 **BYOK** — Bring Your Own API Key for LLM providers
- ⚡ **Real-time** — Websocket market data, live order book, streaming decisions

## Tech Stack

- **Runtime:** Node.js / TypeScript
- **Exchange:** Hyperliquid (perpetual futures)
- **LLMs:** OpenAI-compatible API routing (DeepSeek, GPT, Claude, etc.)
- **Market Data:** Hyperliquid websocket + REST API
- **Indicators:** technicalindicators.js

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env
# Fill in your API keys

# Build
npm run build

# Run (mock mode by default)
npm run dev
```

## Project Structure

```
src/
├── config/          → Environment & defaults
├── engine/          → Agent decision loop
├── indicators/      → Technical indicator calculations
├── llm/             → Multi-provider LLM router + prompt builder
├── market/          → Hyperliquid websocket + candle data
├── risk/            → Risk management engine
├── trading/         → Trade executor (mock + live)
├── types/           → TypeScript type definitions
├── utils/           → Logger and helpers
└── index.ts         → Entry point
```

## Roadmap

- [x] Phase 1: Core trading engine
- [ ] Phase 2: Multi-agent management + database
- [ ] Phase 3: Web frontend + user dashboard
- [ ] Phase 4: Social features (leaderboards, copy trading)
- [ ] Phase 5: Launch prep + mainnet
- [ ] Phase 6: Launch 🚀

## License

MIT
