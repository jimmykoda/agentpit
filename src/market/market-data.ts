// ============================================
// AgentPit - Market Data Service
// Connects to Hyperliquid websocket for 
// real-time price data and candles
// ============================================

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { OHLCV, MarketTicker, OrderBook } from '../types';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('MarketData');

export class MarketDataService extends EventEmitter {
  private ws: WebSocket | null = null;
  private candles: Map<string, Map<string, OHLCV[]>> = new Map(); // symbol -> timeframe -> candles
  private tickers: Map<string, MarketTicker> = new Map();
  private orderBooks: Map<string, OrderBook> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private subscriptions: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Connect to Hyperliquid websocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      log.info(`Connecting to Hyperliquid WS: ${config.hyperliquid.wsUrl}`);

      this.ws = new WebSocket(config.hyperliquid.wsUrl);

      this.ws.on('open', () => {
        log.info('WebSocket connected');
        this.reconnectAttempts = 0;
        // Re-subscribe to existing subscriptions on reconnect
        for (const sub of this.subscriptions) {
          this.sendSubscription(sub);
        }
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (e) {
          log.error('Failed to parse WS message', e);
        }
      });

      this.ws.on('close', () => {
        log.warn('WebSocket disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (err) => {
        log.error('WebSocket error', err);
        reject(err);
      });
    });
  }

  /**
   * Subscribe to a trading pair's data
   */
  subscribe(symbol: string): void {
    // Subscribe to trades/ticker updates
    const tickerSub = JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'allMids' },
    });

    // Subscribe to L2 order book
    const l2Sub = JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'l2Book', coin: symbol },
    });

    this.subscriptions.add(tickerSub);
    this.subscriptions.add(l2Sub);

    this.sendSubscription(tickerSub);
    this.sendSubscription(l2Sub);

    // Initialize candle storage for this symbol
    if (!this.candles.has(symbol)) {
      this.candles.set(symbol, new Map());
    }

    log.info(`Subscribed to ${symbol}`);
  }

  /**
   * Get candles for a symbol and timeframe
   */
  async getCandles(symbol: string, timeframe: string, limit: number = 200): Promise<OHLCV[]> {
    // Fetch historical candles via REST API
    try {
      const interval = this.timeframeToInterval(timeframe);
      const now = Date.now();
      const startTime = now - this.timeframeToMs(timeframe) * limit;

      const response = await fetch(`${config.hyperliquid.apiUrl}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: symbol,
            interval,
            startTime,
            endTime: now,
          },
        }),
      });

      const data = await response.json() as any[];

      const candles: OHLCV[] = data.map((c: any) => ({
        timestamp: c.t,
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.v),
      }));

      // Cache the candles
      if (!this.candles.has(symbol)) {
        this.candles.set(symbol, new Map());
      }
      this.candles.get(symbol)!.set(timeframe, candles);

      return candles;
    } catch (err) {
      log.error(`Failed to fetch candles for ${symbol} ${timeframe}`, err);
      return this.candles.get(symbol)?.get(timeframe) || [];
    }
  }

  /**
   * Get current ticker for a symbol
   */
  getTicker(symbol: string): MarketTicker | undefined {
    return this.tickers.get(symbol);
  }

  /**
   * Get current order book for a symbol
   */
  getOrderBook(symbol: string): OrderBook | undefined {
    return this.orderBooks.get(symbol);
  }

  /**
   * Get current price for a symbol
   */
  getCurrentPrice(symbol: string): number | undefined {
    return this.tickers.get(symbol)?.lastPrice;
  }

  /**
   * Disconnect from websocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    log.info('Disconnected from market data');
  }

  // --- Private Methods ---

  private sendSubscription(sub: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(sub);
    }
  }

  private handleMessage(msg: any): void {
    if (msg.channel === 'allMids') {
      this.handleMidsUpdate(msg.data);
    } else if (msg.channel === 'l2Book') {
      this.handleL2Update(msg.data);
    }
  }

  private handleMidsUpdate(data: any): void {
    if (!data?.mids) return;

    for (const [symbol, mid] of Object.entries(data.mids)) {
      const price = parseFloat(mid as string);
      const existing = this.tickers.get(symbol);

      const ticker: MarketTicker = {
        symbol,
        lastPrice: price,
        bid: existing?.bid || price,
        ask: existing?.ask || price,
        volume24h: existing?.volume24h || 0,
        change24h: existing?.change24h || 0,
        high24h: existing?.high24h || price,
        low24h: existing?.low24h || price,
        fundingRate: existing?.fundingRate || 0,
        openInterest: existing?.openInterest || 0,
        timestamp: Date.now(),
      };

      this.tickers.set(symbol, ticker);
      this.emit('ticker', ticker);
    }
  }

  private handleL2Update(data: any): void {
    if (!data?.coin) return;

    const orderBook: OrderBook = {
      bids: (data.levels?.[0] || []).map((l: any) => [parseFloat(l.px), parseFloat(l.sz)]),
      asks: (data.levels?.[1] || []).map((l: any) => [parseFloat(l.px), parseFloat(l.sz)]),
      timestamp: Date.now(),
    };

    this.orderBooks.set(data.coin, orderBook);
    this.emit('orderbook', { symbol: data.coin, orderBook });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error('Max reconnect attempts reached');
      this.emit('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    log.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => {
        log.error('Reconnect failed', err);
      });
    }, delay);
  }

  private timeframeToInterval(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m',
      '1h': '1h', '4h': '4h', '1d': '1d',
    };
    return map[tf] || '15m';
  }

  private timeframeToMs(tf: string): number {
    const map: Record<string, number> = {
      '1m': 60000, '5m': 300000, '15m': 900000,
      '1h': 3600000, '4h': 14400000, '1d': 86400000,
    };
    return map[tf] || 900000;
  }
}
