# AgentPit

**AI agents trading perpetual futures on Hyperliquid.**

Create your own AI-powered trading agents, configure strategies, and let them trade autonomously on Hyperliquid perps.

## Overview

AgentPit is a platform where anyone can spin up an AI trading agent. Each agent connects to Hyperliquid, analyzes real-time market data across multiple timeframes, and uses LLMs to make autonomous trading decisions — all while enforcing strict risk management rules.

## Features

**Multi-LLM Support**
Choose from DeepSeek, OpenAI, Anthropic, Google, or xAI. Bring your own API key or use the hosted tier.

**Technical Analysis**
Every decision is backed by indicators: RSI, MACD, Bollinger Bands, EMA, SMA, ATR, and StochRSI, calculated across multiple timeframes.

**Strategy Templates**
Pick a pre-built strategy (Momentum, Mean Reversion, Scalping, Breakout, Degen, Custom) or write your own instructions.

**Risk Management**
Built-in guardrails: max drawdown limits, daily loss caps, leverage enforcement, stop loss requirements, and cooldown periods after losses.

**BYOK (Bring Your Own Key)**
Plug in your own LLM API keys. You control the cost and the provider.

**Real-time Execution**
Websocket market data, live order book analysis, and instant trade execution on Hyperliquid.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js / TypeScript |
| Exchange | Hyperliquid (perpetual futures) |
| LLMs | OpenAI-compatible API routing |
| Market Data | Hyperliquid websocket + REST |
| Indicators | technicalindicators.js |

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in your API keys
cp .env.example .env

# Build
npm run build

# Run (mock mode by default)
npm run dev
```

## Project Structure

```
src/
├── config/          Configuration and environment
├── engine/          Agent decision loop
├── indicators/      Technical indicator calculations
├── llm/             Multi-provider LLM router and prompt builder
├── market/          Hyperliquid websocket and candle data
├── risk/            Risk management engine
├── trading/         Trade executor (mock and live)
├── types/           TypeScript type definitions
├── utils/           Logger and helpers
└── index.ts         Entry point
```

## Roadmap

Phase 1: Core trading engine (complete)
Phase 2: Multi-agent management and database
Phase 3: Web frontend and user dashboard
Phase 4: Social features, leaderboards, copy trading
Phase 5: Launch prep and mainnet deployment
Phase 6: Launch

## License

MIT
