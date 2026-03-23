# Mechas IncaSlop - RPG Battle Betting Game

## Overview
A web-based RPG auto-battle game where two 3D fighters battle in turns. Users can bet on which fighter will win each round. Built with React + Vite + Three.js.

## Tech Stack
- **Frontend Framework:** React 18 + Vite (JavaScript)
- **3D Engine:** Three.js + @react-three/fiber + @react-three/drei
- **Styling:** CSS Modules / plain CSS
- **State Management:** React Context + useReducer

## Architecture

### Directory Structure
```
mechas-incaslop/
├── public/
├── src/
│   ├── assets/
│   │   └── models/
│   │       ├── model1.glb
│   │       └── model2.glb
│   ├── components/
│   │   ├── BattleScene.jsx       # Three.js 3D battle arena
│   │   ├── Fighter.jsx           # Individual fighter 3D model
│   │   ├── HealthBar.jsx         # HTML overlay health bars
│   │   ├── BettingModal.jsx      # Pre-fight betting window with timer
│   │   ├── BattleLog.jsx         # Turn-by-turn combat log
│   │   ├── BattleHUD.jsx         # Heads-up display (health, names, round)
│   │   └── GameOver.jsx          # Round result + payout display
│   ├── context/
│   │   └── GameContext.jsx       # Global game state
│   ├── hooks/
│   │   └── useBattle.js          # Battle logic hook
│   ├── utils/
│   │   └── battleEngine.js       # Core battle calculations
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── package.json
└── planning/
    └── Plan.md
```

## Game Mechanics

### Battle System
- **Turn-based automatic combat** - no player input during fights
- Each turn: one fighter attacks the other, alternating
- **Damage** = base_attack * random(0.8, 1.2) - defense * random(0.3, 0.6)
- **Critical hits** = 15% chance, 2x damage
- **Miss chance** = 10%
- Turn delay: ~1.5 seconds between attacks for dramatic effect

### Fighter Stats
- **HP:** 100
- **Attack:** 15-25 (randomized per fighter spawn)
- **Defense:** 5-10 (randomized per fighter spawn)
- **Speed:** determines who goes first

### Death & Respawn
- When a fighter's HP reaches 0, they die
- A new fighter spawns in their place with fresh stats
- The surviving fighter recovers **20% of max HP** (capped at max)
- Round counter increments

### Betting System
- Before each fight, a **betting modal** opens
- **Timer:** 15 seconds countdown to place bet
- Player chooses: **"Bet on Fighter 1"** or **"Bet on Fighter 2"**
- **Stake:** auto-generated random amount (10-100 coins)
- If the chosen fighter wins → player receives 2x stake
- If the chosen fighter loses → player loses the stake
- Player starts with **500 coins**
- Betting is optional — if timer expires, no bet is placed

### Visual Flow
1. Betting modal appears with timer (15s)
2. Player bets or timer expires
3. Battle begins — fighters attack in turns
4. Damage numbers float up on hit
5. Health bars update in real-time
6. Loser death animation (fall/fade)
7. Result screen: winner announced, payout shown
8. Survivor heals slightly, new opponent spawns
9. Loop back to step 1

## 3D Scene Setup
- **Camera:** perspective, slightly elevated angle
- **Lighting:** ambient + directional
- **Floor:** simple plane/grid
- **Fighter 1:** positioned left (x: -2)
- **Fighter 2:** positioned right (x: 2)
- **Animations:** idle bounce, attack lunge, hit shake, death fall

## Implementation Phases

### Phase 1: Project Setup ✅
- [x] Initialize Vite + React
- [x] Install dependencies (three, @react-three/fiber, @react-three/drei)
- [x] Create directory structure

### Phase 2: 3D Scene
- [ ] Set up Canvas with camera and lights
- [ ] Load and display both GLB models
- [ ] Position fighters left/right
- [ ] Add arena floor

### Phase 3: Battle Engine
- [ ] Implement turn-based combat logic
- [ ] Implement damage/crit/miss calculations
- [ ] Implement death detection and respawn
- [ ] Implement survivor healing

### Phase 4: UI Overlay
- [ ] Health bars above fighters
- [ ] Battle log (scrolling combat text)
- [ ] Round counter
- [ ] Damage numbers

### Phase 5: Betting System
- [ ] Betting modal with countdown timer
- [ ] Coin balance tracking
- [ ] Stake generation
- [ ] Payout calculation
- [ ] Result display

### Phase 6: Polish
- [ ] Attack/hit/death animations
- [ ] Sound effects (optional)
- [ ] Visual effects (particles on hit)
- [ ] Mobile responsive layout

