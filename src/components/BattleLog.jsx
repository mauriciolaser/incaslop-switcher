import { useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'

export default function BattleLog() {
  const { battleLog } = useGame()
  const scrollRef = useRef()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [battleLog])

  return (
    <div className="battle-log battle-panel-shell" ref={scrollRef}>
      <div className="battle-log-title">Registro de Batalla</div>
      {battleLog.map((entry, i) => (
        <div key={i} className={`log-entry log-${entry.type}`}>
          {entry.text}
        </div>
      ))}
      {battleLog.length === 0 && (
        <div className="log-entry log-info">Esperando que comience la batalla...</div>
      )}
    </div>
  )
}
