'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { AgentConfig, Position, Trade, LLMDecision } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Play, Pause, StopCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  
  const [agent, setAgent] = useState<AgentConfig | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [decisions, setDecisions] = useState<LLMDecision[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  async function loadData() {
    setLoading(true)
    try {
      const [agentData, positionData, tradesData, decisionsData] = await Promise.all([
        api.getAgent(agentId),
        api.getAgentPosition(agentId),
        api.getAgentTrades(agentId),
        api.getAgentDecisions(agentId),
      ])
      
      setAgent(agentData)
      setPosition(positionData)
      setTrades(tradesData)
      setDecisions(decisionsData)
    } catch (error) {
      console.error('Failed to load agent:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    await api.startAgent(agentId)
    loadData()
  }

  async function handlePause() {
    await api.pauseAgent(agentId)
    loadData()
  }

  async function handleStop() {
    await api.stopAgent(agentId)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400 mb-4">Agent not found</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    )
  }

  // Calculate P&L for chart
  const chartData = trades.slice(-10).map((trade, i) => ({
    name: `Trade ${i + 1}`,
    pnl: trade.realizedPnl || 0,
    cumulative: trades.slice(0, trades.indexOf(trade) + 1).reduce((sum, t) => sum + (t.realizedPnl || 0), 0),
  }))

  const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) + (position?.unrealizedPnl || 0)
  const realizedPnl = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0)
  const winningTrades = trades.filter(t => t.realizedPnl && t.realizedPnl > 0).length
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          <div className="flex items-center gap-4 text-sm text-neutral-400">
            <span>{agent.symbol}</span>
            <span>•</span>
            <span className="capitalize">{agent.strategy.template.replace('_', ' ')}</span>
            <span>•</span>
            <span>{agent.llmModel}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {agent.status !== 'running' && (
            <Button onClick={handleStart}>
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          {agent.status === 'running' && (
            <Button variant="outline" onClick={handlePause}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          <Button variant="destructive" onClick={handleStop}>
            <StopCircle className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(totalPnl)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Activity className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-neutral-400">
              {winningTrades}/{trades.length} trades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={agent.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(realizedPnl)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Position */}
      {position && (
        <Card>
          <CardHeader>
            <CardTitle>Current Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-neutral-400 mb-1">Side</p>
                <p className="text-lg font-medium capitalize">{position.side}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400 mb-1">Size</p>
                <p className="text-lg font-medium">{position.size}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400 mb-1">Entry Price</p>
                <p className="text-lg font-medium">{formatCurrency(position.entryPrice)}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400 mb-1">Leverage</p>
                <p className="text-lg font-medium">{position.leverage}x</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400 mb-1">Unrealized P&L</p>
                <p className={`text-lg font-bold ${position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(position.unrealizedPnl)}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-400 mb-1">Stop Loss</p>
                <p className="text-lg font-medium">
                  {position.stopLoss ? formatCurrency(position.stopLoss) : 'None'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* P&L Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>P&L History</CardTitle>
            <CardDescription>Last {chartData.length} trades</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Line type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Decisions */}
      {decisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Decisions</CardTitle>
            <CardDescription>Latest AI decision reasoning</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {decisions.map((decision, i) => (
              <div key={i} className="p-4 rounded-lg border border-neutral-800 bg-neutral-950">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={decision.action === 'hold' ? 'secondary' : 'default'}>
                    {decision.action.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-neutral-400">Confidence: {decision.confidence}%</span>
                </div>
                <p className="text-sm text-neutral-300">{decision.reasoning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>{trades.length} total trades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trades.map((trade) => (
              <div key={trade.id} className="p-4 rounded-lg border border-neutral-800 bg-neutral-950">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={trade.side === 'long' ? 'success' : 'destructive'}>
                        {trade.side}
                      </Badge>
                      <Badge variant="outline">{trade.action}</Badge>
                      <span className="text-sm font-medium">{trade.size} @ {formatCurrency(trade.price)}</span>
                    </div>
                    <p className="text-sm text-neutral-400">
                      {new Date(trade.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {trade.realizedPnl !== undefined && (
                    <div className={`text-lg font-bold ${trade.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(trade.realizedPnl)}
                    </div>
                  )}
                </div>
                <p className="text-sm text-neutral-300 mt-2">{trade.reasoning}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
    running: 'success',
    paused: 'warning',
    idle: 'secondary',
    stopped: 'secondary',
    error: 'destructive',
  }

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status}
    </Badge>
  )
}
