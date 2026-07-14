import type { Position } from '@shared/types'

const placeholderPosition: Position = {
  id: 'placeholder',
  symbol: 'BTCUSDT',
  side: 'long',
  entryPrice: 0,
  size: 0,
  stopLoss: 0,
  takeProfit: 0,
  openedAt: 0,
  unrealizedPnl: 0,
}

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
      <p className="text-lg">
        Traiderim dashboard scaffold — {placeholderPosition.symbol}
      </p>
    </div>
  )
}

export default App
