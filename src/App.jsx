import { GameProvider } from './context/GameContext'
import BattleScene from './components/BattleScene'
import HealthBars from './components/HealthBar'
import BattleHUD from './components/BattleHUD'
import BattleLog from './components/BattleLog'
import BettingModal from './components/BettingModal'
import GameOver from './components/GameOver'
import './App.css'

export default function App() {
  return (
    <GameProvider>
      <div className="game-container">
        <BattleScene />
        <BattleHUD />
        <HealthBars />
        <BattleLog />
        <BettingModal />
        <GameOver />
      </div>
    </GameProvider>
  )
}
