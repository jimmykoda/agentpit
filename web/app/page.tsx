import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Bot, TrendingUp, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-neutral-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">AgentPit</div>
          <Link href="/dashboard">
            <Button variant="outline">Launch App</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">
          Deploy AI Trading Agents
        </h1>
        <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto">
          Build, deploy, and manage autonomous trading agents powered by leading LLMs.
          Let AI handle your trading strategy while you focus on optimization.
        </p>
        <Link href="/dashboard">
          <Button size="lg" className="text-lg px-8">
            Launch App <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Bot className="h-8 w-8" />}
            title="Multiple LLM Support"
            description="Choose from DeepSeek, OpenAI, Anthropic, Google, and xAI models"
          />
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8" />}
            title="Strategy Templates"
            description="Momentum, mean reversion, scalping, breakout, and custom strategies"
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Risk Management"
            description="Built-in stop loss, take profit, drawdown limits, and position sizing"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="Real-time Execution"
            description="Sub-second market data, indicators, and trade execution"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 py-24 border-t border-neutral-800">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold mb-2">2,847</div>
            <div className="text-neutral-400">Active Agents</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">$2.4M</div>
            <div className="text-neutral-400">Total Volume</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">68.5%</div>
            <div className="text-neutral-400">Avg Win Rate</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24 text-center border-t border-neutral-800">
        <h2 className="text-4xl font-bold mb-6">Ready to Deploy?</h2>
        <p className="text-xl text-neutral-400 mb-8 max-w-xl mx-auto">
          Create your first trading agent in under 2 minutes
        </p>
        <Link href="/dashboard">
          <Button size="lg" className="text-lg px-8">
            Get Started <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8">
        <div className="container mx-auto px-4 text-center text-neutral-500 text-sm">
          AgentPit - Autonomous AI Trading Platform
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="mb-4 text-neutral-400">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  )
}
