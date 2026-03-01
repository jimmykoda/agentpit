'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { LLMProvider, StrategyTemplate, Timeframe } from '@/lib/types'

const LLM_PROVIDERS: { value: LLMProvider; label: string; models: string[] }[] = [
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'] },
  { value: 'google', label: 'Google', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { value: 'xai', label: 'xAI', models: ['grok-2', 'grok-2-mini'] },
]

const STRATEGIES: { value: StrategyTemplate; label: string; description: string }[] = [
  { value: 'momentum', label: 'Momentum', description: 'Follow trends and ride strong directional moves' },
  { value: 'mean_reversion', label: 'Mean Reversion', description: 'Buy dips and sell rips, fade extremes' },
  { value: 'scalping', label: 'Scalping', description: 'Quick in and out trades for small profits' },
  { value: 'breakout', label: 'Breakout', description: 'Trade breakouts from consolidation zones' },
  { value: 'degen', label: 'Degen', description: 'High risk, high leverage, YOLO mode' },
]

const TRADING_PAIRS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP']
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d']
const DECISION_INTERVALS = [
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 900000, label: '15 minutes' },
  { value: 3600000, label: '1 hour' },
]

export default function CreateAgentPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: 'BTC-PERP',
    llmProvider: 'deepseek' as LLMProvider,
    llmModel: 'deepseek-chat',
    strategy: 'momentum' as StrategyTemplate,
    timeframes: ['1m', '5m', '15m'] as Timeframe[],
    maxLeverage: 5,
    maxPositionSize: 5000,
    stopLossPercent: 3,
    takeProfitPercent: 5,
    maxDrawdownPercent: 15,
    decisionIntervalMs: 60000,
    apiKey: '',
  })

  const selectedProvider = LLM_PROVIDERS.find(p => p.value === formData.llmProvider)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)

    try {
      const agent = await api.createAgent({
        name: formData.name,
        symbol: formData.symbol,
        llmProvider: formData.llmProvider,
        llmModel: formData.llmModel,
        maxPositionSize: formData.maxPositionSize,
        maxLeverage: formData.maxLeverage,
        decisionIntervalMs: formData.decisionIntervalMs,
        apiKey: formData.apiKey || undefined,
        strategy: {
          template: formData.strategy,
          timeframes: formData.timeframes,
          indicators: ['rsi', 'macd', 'ema'],
        },
        risk: {
          maxDrawdownPercent: formData.maxDrawdownPercent,
          maxDailyLossPercent: 10,
          stopLossPercent: formData.stopLossPercent,
          takeProfitPercent: formData.takeProfitPercent,
          maxOpenPositions: 2,
          cooldownAfterLossMs: 300000,
        },
      })

      router.push(`/dashboard/agent/${agent.id}`)
    } catch (error) {
      console.error('Failed to create agent:', error)
      alert('Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Create Trading Agent</h1>
        <p className="text-neutral-400">Configure your autonomous trading agent</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Name and trading pair for your agent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g. Momentum Hunter"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="symbol">Trading Pair</Label>
              <select
                id="symbol"
                className="flex h-9 w-full rounded-md border border-neutral-800 bg-transparent px-3 py-1 text-sm"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              >
                {TRADING_PAIRS.map(pair => (
                  <option key={pair} value={pair} className="bg-neutral-950">{pair}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* LLM Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>LLM Configuration</CardTitle>
            <CardDescription>Choose the AI model to power your agent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="llmProvider">Provider</Label>
              <select
                id="llmProvider"
                className="flex h-9 w-full rounded-md border border-neutral-800 bg-transparent px-3 py-1 text-sm"
                value={formData.llmProvider}
                onChange={(e) => {
                  const provider = e.target.value as LLMProvider
                  const providerData = LLM_PROVIDERS.find(p => p.value === provider)
                  setFormData({
                    ...formData,
                    llmProvider: provider,
                    llmModel: providerData?.models[0] || '',
                  })
                }}
              >
                {LLM_PROVIDERS.map(provider => (
                  <option key={provider.value} value={provider.value} className="bg-neutral-950">
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="llmModel">Model</Label>
              <select
                id="llmModel"
                className="flex h-9 w-full rounded-md border border-neutral-800 bg-transparent px-3 py-1 text-sm"
                value={formData.llmModel}
                onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
              >
                {selectedProvider?.models.map(model => (
                  <option key={model} value={model} className="bg-neutral-950">{model}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="apiKey">API Key (Optional - BYOK)</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your API key (encrypted at rest)"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              />
              <p className="text-xs text-neutral-500 mt-1">
                Bring your own key for better rate limits and privacy
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Strategy */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy</CardTitle>
            <CardDescription>Choose a trading strategy template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {STRATEGIES.map(strategy => (
                <button
                  key={strategy.value}
                  type="button"
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    formData.strategy === strategy.value
                      ? 'border-white bg-neutral-900'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                  onClick={() => setFormData({ ...formData, strategy: strategy.value })}
                >
                  <div className="font-medium mb-1">{strategy.label}</div>
                  <div className="text-sm text-neutral-400">{strategy.description}</div>
                </button>
              ))}
            </div>

            <div>
              <Label>Timeframes</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    type="button"
                    className={`px-3 py-1 rounded border text-sm ${
                      formData.timeframes.includes(tf)
                        ? 'border-white bg-neutral-900'
                        : 'border-neutral-800'
                    }`}
                    onClick={() => {
                      const newTimeframes = formData.timeframes.includes(tf)
                        ? formData.timeframes.filter(t => t !== tf)
                        : [...formData.timeframes, tf]
                      setFormData({ ...formData, timeframes: newTimeframes })
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="decisionInterval">Decision Interval</Label>
              <select
                id="decisionInterval"
                className="flex h-9 w-full rounded-md border border-neutral-800 bg-transparent px-3 py-1 text-sm"
                value={formData.decisionIntervalMs}
                onChange={(e) => setFormData({ ...formData, decisionIntervalMs: parseInt(e.target.value) })}
              >
                {DECISION_INTERVALS.map(interval => (
                  <option key={interval.value} value={interval.value} className="bg-neutral-950">
                    {interval.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Risk Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Parameters</CardTitle>
            <CardDescription>Configure risk management settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxLeverage">Max Leverage: {formData.maxLeverage}x</Label>
              <input
                id="maxLeverage"
                type="range"
                min="1"
                max="50"
                value={formData.maxLeverage}
                onChange={(e) => setFormData({ ...formData, maxLeverage: parseInt(e.target.value) })}
                className="w-full mt-2"
              />
            </div>

            <div>
              <Label htmlFor="maxPositionSize">Max Position Size (USD)</Label>
              <Input
                id="maxPositionSize"
                type="number"
                value={formData.maxPositionSize}
                onChange={(e) => setFormData({ ...formData, maxPositionSize: parseInt(e.target.value) })}
                min="100"
                step="100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stopLoss">Stop Loss %</Label>
                <Input
                  id="stopLoss"
                  type="number"
                  value={formData.stopLossPercent}
                  onChange={(e) => setFormData({ ...formData, stopLossPercent: parseFloat(e.target.value) })}
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="takeProfit">Take Profit %</Label>
                <Input
                  id="takeProfit"
                  type="number"
                  value={formData.takeProfitPercent}
                  onChange={(e) => setFormData({ ...formData, takeProfitPercent: parseFloat(e.target.value) })}
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="maxDrawdown">Max Drawdown %</Label>
              <Input
                id="maxDrawdown"
                type="number"
                value={formData.maxDrawdownPercent}
                onChange={(e) => setFormData({ ...formData, maxDrawdownPercent: parseFloat(e.target.value) })}
                min="1"
                max="50"
                step="1"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Agent will stop trading if drawdown exceeds this threshold
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating || !formData.name}>
            {creating ? 'Creating...' : 'Create Agent'}
          </Button>
        </div>
      </form>
    </div>
  )
}
