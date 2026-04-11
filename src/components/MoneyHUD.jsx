import { useGame } from '../context/GameContext'
import moneyIconUrl from '../assets/sprites/money_icon.png?url'

export default function MoneyHUD() {
  const { coins } = useGame()

  return (
    <div className="money-hud" aria-live="polite">
      <img className="money-hud-icon" src={moneyIconUrl} alt="" aria-hidden="true" />
      <div className="money-hud-copy">
        <span className="money-hud-label">Dinero</span>
        <span className="money-hud-value">{coins}</span>
      </div>
    </div>
  )
}
