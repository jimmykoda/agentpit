'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Trophy, TrendingUp, Target } from 'lucide-react'

interface LeaderboardEntry {
  id: string
  name: string
  userId: string
  strategy: string
  model: string
  totalPnl: number
  winRate: number
  totalTrades: number
  sharpeRatio: number
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [sortBy, setSortBy] = useState<'pnl' | 'winRate' | 'trades'>('pnl')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    setLoading(true)
    try {
      const data = await api.getLeaderboard()
      setLeaderboard(data)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case 'pnl':
        return b.totalPnl - a.totalPnl
      case 'winRate':
        return b.winRate - a.winRate
      case 'trades':
        return b.totalTrades - a.totalTrades
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-neutral-400">Top performing trading agents</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Agent</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaderboard[0]?.name || 'N/A'}</div>
            <p className="text-xs text-neutral-400">
              {leaderboard[0] ? formatCurrency(leaderboard[0].totalPnl) : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Win Rate</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...leaderboard.map(a => a.winRate)).toFixed(1)}%
            </div>
            <p className="text-xs text-neutral-400">
              {leaderboard.sort((a, b) => b.winRate - a.winRate)[0]?.name || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...leaderboard.map(a => a.totalTrades))}
            </div>
            <p className="text-xs text-neutral-400">
              {leaderboard.sort((a, b) => b.totalTrades - a.totalTrades)[0]?.name || 'N/A'} trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sort Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rankings</CardTitle>
              <CardDescription>Top agents by performance</CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('pnl')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'pnl'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                P&L
              </button>
              <button
                onClick={() => setSortBy('winRate')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'winRate'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                Win Rate
              </button>
              <button
                onClick={() => setSortBy('trades')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'trades'
                    ? 'bg-white text-black'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                Trades
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="grid grid-cols-7 gap-4 pb-3 border-b border-neutral-800 text-sm font-medium text-neutral-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-2">Agent</div>
            <div className="col-span-1">Strategy</div>
            <div className="col-span-1 text-right">P&L</div>
            <div className="col-span-1 text-right">Win Rate</div>
            <div className="col-span-1 text-right">Trades</div>
          </div>

          {/* Table Rows */}
          <div className="space-y-3 mt-3">
            {sortedLeaderboard.map((agent, index) => {
              const isTopThree = index < 3
              const rankColor = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-neutral-400' : index === 2 ? 'text-orange-600' : 'text-neutral-500'

              return (
                <div
                  key={agent.id}
                  className={`grid grid-cols-7 gap-4 p-4 rounded-lg ${
                    isTopThree ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-950'
                  }`}
                >
                  <div className="col-span-1 flex items-center">
                    <span className={`text-2xl font-bold ${rankColor}`}>
                      {index + 1}
                      {index === 0 && ' 🏆'}
                      {index === 1 && ' 🥈'}
                      {index === 2 && ' 🥉'}
                    </span>
                  </div>
                  
                  <div className="col-span-2 flex flex-col justify-center">
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-neutral-500">{agent.model}</p>
                  </div>
                  
                  <div className="col-span-1 flex items-center">
                    <Badge variant="outline" className="capitalize">
                      {agent.strategy.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="col-span-1 flex items-center justify-end">
                    <span className={`font-bold ${agent.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(agent.totalPnl)}
                    </span>
                  </div>
                  
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="font-medium">{agent.winRate.toFixed(1)}%</span>
                  </div>
                  
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-neutral-400">{agent.totalTrades}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
