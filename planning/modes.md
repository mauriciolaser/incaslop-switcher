# Modos de Juego

## Menu Principal (`src/components/MainMenu.jsx`)

Al iniciar la app se muestra el menu con dos opciones:

- **MODO INFINITO** — Peleas aleatorias sin fin, el ganador sobrevive y pelea contra un nuevo oponente. Apuestas con monedas.
- **MODO TORNEO** — Bracket de eliminacion directa con 16 peleadores predefinidos.

El modo se controla via `TournamentContext.mode`: `'menu'` | `'endless'` | `'torneo'`

---

## Modo Infinito (Endless)

Comportamiento original del juego. Sin cambios.

**Flujo:** betting → fighting → result → NEXT_ROUND (sobreviviente sana 20%, nuevo oponente) → betting → ...

**Archivos clave:** `GameContext.jsx`, `useBattle.js`, `battleEngine.js`

---

## Modo Torneo

### Roster de 16 Peleadores (`src/data/personajes.json`)

Cada personaje tiene rangos de stats que le dan una personalidad:

| # | Nombre | ATK | DEF | SPD | Perfil |
|---|--------|-----|-----|-----|--------|
| 1 | Guerrero Inca | 18-24 | 6-9 | 4-7 | Equilibrado |
| 2 | Jaguar Negro | 20-25 | 5-7 | 7-10 | Ofensivo rapido |
| 3 | Condor de Fuego | 17-22 | 7-10 | 5-8 | Defensivo |
| 4 | Serpiente Dorada | 16-21 | 5-8 | 8-10 | Veloz, baja defensa |
| 5 | Puma Sagrado | 19-24 | 6-9 | 6-9 | Equilibrado |
| 6 | Halcon Andino | 15-20 | 5-7 | 9-10 | Cristal rapido |
| 7 | Lobo de Plata | 18-23 | 7-10 | 4-7 | Tank lento |
| 8 | Toro Bravo | 22-25 | 8-10 | 1-4 | Bruiser pesado |
| 9 | Fenix Oscuro | 20-25 | 4-6 | 6-9 | Glass cannon |
| 10 | Titan de Piedra | 21-25 | 9-10 | 1-3 | Muralla |
| 11 | Sombra Veloz | 16-21 | 4-6 | 9-10 | Asesino rapido |
| 12 | Apu del Trueno | 19-24 | 6-8 | 5-8 | Equilibrado |
| 13 | Sacerdote Solar | 17-22 | 8-10 | 3-6 | Tanque magico |
| 14 | Chasqui Fantasma | 15-19 | 5-7 | 8-10 | Veloz debil |
| 15 | Sierpe de Oro | 20-25 | 5-8 | 5-8 | Ofensivo medio |
| 16 | Amaru Celeste | 18-23 | 7-9 | 6-8 | Equilibrado |

Los stats se randomean dentro del rango al iniciar cada torneo.

### Estructura del Bracket

```
  OCTAVOS (8)    CUARTOS (4)   SEMIS (2)    FINAL (1)
  [1 vs 2]  ──┐
               ├── [W vs W] ──┐
  [3 vs 4]  ──┘               │
                               ├── [W vs W] ──┐
  [5 vs 6]  ──┐               │               │
               ├── [W vs W] ──┘               │
  [7 vs 8]  ──┘                               ├── [W vs W] → CAMPEON
  [9 vs 10] ──┐                               │
               ├── [W vs W] ──┐               │
  [11vs12]  ──┘               │               │
                               ├── [W vs W] ──┘
  [13vs14]  ──┐               │
               ├── [W vs W] ──┘
  [15vs16]  ──┘
```

Total: 15 combates (8 + 4 + 2 + 1)

### Bracket Indexing (flat array de 15 slots)

| Indices | Ronda | Nombre |
|---------|-------|--------|
| 0-7 | 0 | Octavos de Final |
| 8-11 | 1 | Cuartos de Final |
| 12-13 | 2 | Semifinales |
| 14 | 3 | Final |

### Flujo del Torneo

1. Menu → "MODO TORNEO" → `INIT_TOURNAMENT`
2. Se cargan 16 personajes, se shufflean, se rollean stats
3. **Pantalla Bracket** — muestra bracket completo, match actual resaltado
4. "Siguiente Combate" → `SET_FIGHTERS` en GameContext + `START_MATCH` en TournamentContext
5. **BettingModal** (15s, apuestas normales con monedas)
6. **Batalla** (sistema de combate identico al modo endless)
7. **FIGHT_ENDED** → GameContext actualiza monedas
8. **TournamentResult** — muestra ganador, resultado apuesta, boton "Ver Bracket"
9. "Ver Bracket" → `MATCH_RESULT` → ganador sana 20%, avanza al siguiente slot
10. Bracket actualizado → siguiente combate → repetir
11. Despues de la final → **Pantalla Campeon** → "NUEVO TORNEO" o "MENU PRINCIPAL"

### Estado del Torneo (`src/context/TournamentContext.jsx`)

```js
{
  mode: 'menu' | 'endless' | 'torneo',
  fighters: [16],                    // Instancias con stats rolleados y HP actual
  bracket: [15],                     // Match slots
  currentGlobalMatchIdx: number,     // Indice del match actual en el bracket
  currentRound: 0-3,
  tournamentPhase: 'bracket' | 'fighting' | 'champion',
  champion: null | fighter,
}
```

**Acciones del reducer:**
- `SET_MODE` — Cambia modo
- `INIT_TOURNAMENT` — Crea 16 fighters, genera bracket
- `START_MATCH` — Marca match como 'current', cambia a tournamentPhase 'fighting'
- `MATCH_RESULT` — Graba ganador, sana 20%, propaga al siguiente slot, busca proximo match
- `RESET_TOURNAMENT` — Vuelve al menu

### Match Slot Structure

```js
{
  round: 0,           // Ronda (0-3)
  matchIndex: 0,      // Posicion dentro de la ronda
  fighter1Idx: 0,     // Indice en el array fighters[]
  fighter2Idx: 1,
  winnerIdx: null,    // Se llena al terminar
  status: 'pending' | 'current' | 'done'
}
```

### Propagacion de Ganadores

Cuando match `i` en ronda `r` termina:
- `nextMatch = roundStartIndex(r+1) + floor(matchIndex / 2)`
- Si matchIndex es par → fighter1Idx del next match
- Si matchIndex es impar → fighter2Idx del next match

### HP entre Rondas

- Ganador conserva su HP post-batalla
- Se aplica `healSurvivor()` (20% heal, limpia efectos)
- El HP se guarda en `fighters[]` del TournamentContext

---

## Arquitectura de Componentes

```
App.jsx
  GameProvider
    TournamentProvider
      GameUI
        BattleScene .............. siempre (fondo 3D)
        MainMenu ................. mode === 'menu'
        BattleHUD ................ mode !== 'menu'
        HealthBars ............... endless || torneo+fighting
        BattleLog ................ endless || torneo+fighting
        BettingModal ............. endless || torneo+fighting
        GameOver ................. endless && phase === 'result'
        TournamentBracket ........ torneo && tournamentPhase === 'bracket'
        TournamentResult ......... torneo && phase === 'result'
        ChampionScreen ........... torneo && tournamentPhase === 'champion'
```

## Archivos Nuevos

| Archivo | Descripcion |
|---------|-------------|
| `src/data/personajes.json` | 16 peleadores con rangos de stats |
| `src/context/TournamentContext.jsx` | Estado y reducer del torneo |
| `src/utils/tournamentEngine.js` | Logica pura: bracket, propagacion, nombres |
| `src/components/MainMenu.jsx` | Pantalla de seleccion de modo |
| `src/components/TournamentBracket.jsx` | Visualizacion del bracket |
| `src/components/TournamentResult.jsx` | Resultado de match + pantalla campeon |

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/context/GameContext.jsx` | Nuevas acciones SET_FIGHTERS, RESET_GAME |
| `src/App.jsx` | TournamentProvider + routing condicional por modo |
| `src/components/BattleHUD.jsx` | Muestra ronda/combate del torneo |
| `src/components/BettingModal.jsx` | Header con nombre de ronda en torneo |
| `src/components/GameOver.jsx` | Solo renderiza en modo endless |
| `src/App.css` | Estilos para menu, bracket, campeon |
