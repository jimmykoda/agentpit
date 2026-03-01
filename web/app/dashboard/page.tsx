'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { AgentConfig, Position } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { PlusCircle, Play, Pause, TrendingUp, TrendingDown, Activity, Wallet } from 'lucide-react'

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [positions, setPositions] = useState<Record<string, Position | null>>({})
  const [summary, setSummary] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalPnl: 0,
    accountBalance: 0,
    dailyPnl: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [agentsData, summaryData] = await Promise.all([
        api.getAgents(),
        api.getAccountSummary(),
      ])
      
      setAgents(agentsData)
      setSummary(summaryData)

      // Load positions for each agent
      const positionPromises = agentsData.map(a => api.getAgentPosition(a.id))
      const positionsData = await Promise.all(positionPromises)
      const positionsMap: Record<string, Position | null> = {}
      agentsData.forEach((agent, i) => {
        positionsMap[agent.id] = positionsData[i]
      })
      setPositions(positionsMap)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleAgent(agentId: string, currentStatus: string) {
    if (currentStatus === 'running') {
      await api.pauseAgent(agentId)
    } else {
      await api.startAgent(agentId)
    }
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Activity className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAgents}</div>
            <p className="text-xs text-neutral-400">
              {summary.activeAgents} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {summary.totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(summary.totalPnl)}
            </div>
            <p className="text-xs text-neutral-400">
              {formatCurrency(summary.dailyPnl)} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <TrendingUp className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(positions).filter(p => p !== null).length}
            </div>
            <p className="text-xs text-neutral-400">
              Across {summary.activeAgents} agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.accountBalance)}</div>
            <p className="text-xs text-neutral-400">
              Available capital
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Your Agents</h2>
        <Link href="/dashboard/create">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const position = positions[agent.id]
          const pnl = position?.unrealizedPnl || 0

          return (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{agent.name}</CardTitle>
                    <CardDescription>{agent.symbol}</CardDescription>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-400">Strategy</span>
                  <span className="text-sm font-medium capitalize">
                    {agent.strategy.template.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-400">Model</span>
                  <span className="text-sm font-medium">{agent.llmModel}</span>
                </div>

                {position && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-400">Current P&L</span>
                    <span className={`text-sm font-bold ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(pnl)}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleAgent(agent.id, agent.status)}
                  >
                    {agent.status === 'running' ? (
                      <>
                        <Pause className="mr-2 h-3 w-3" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-3 w-3" />
                        Start
                      </>
                    )}
                  </Button>
                  <Link href={`/dashboard/agent/${agent.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {agents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-400 mb-4">No agents yet. Create your first trading agent to get started.</p>
            <Link href="/dashboard/create">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
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
