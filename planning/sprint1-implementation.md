# Sprint 1: Plan de Trabajo de Implementacion

## Resumen
- Reemplazar el acceso actual `Local/Online` por un home unico con solo `ENDLESS` y `TOURNAMENT`.
- `ENDLESS` pasa a ser la arena online permanente del VPS: 10 creditos iniciales, apuestas, panel de jugadores conectados, game over al quedar en 0 y salida al home.
- `TOURNAMENT` pasa a 32 peleadores, sin apuestas, con seleccion de congresista por `Partido -> Region -> Nombre`, bracket horizontal, flujo completo de ver peleas ajenas, `skip pelea`, `skip ronda` y vistas de fin de ronda.
- La fuente de verdad de candidatos queda en la API HTTP; frontend y backend hacen warmup de metadata completa y usan imagenes solo por URL cuando un candidato entra en pantalla.
- El backend online queda en Node.js con SQLite temporal y reinicio automatico del proceso.

## Objetivos de implementacion
- Dejar el frontend alineado con el sprint: solo dos modos visibles y flujos completos para ambos.
- Convertir el endless en una experiencia online permanente con estado temporal, lista de jugadores y eliminacion al perder todos los creditos.
- Extender el torneo para soportar 32 peleadores, seleccion de congresista real desde API, visualizacion del bracket y progresion completa por rondas.
- Mantener la logica de combate consistente entre peleas jugadas y peleas resueltas por simulacion.
- Reducir persistencia innecesaria y usar almacenamiento temporal liviano en servidor.

## Cambios principales

### 1. Shell de app y navegacion
- Mover el home fuera del `GameContext` actual y dejar dos entradas directas:
  - `ENDLESS`: monta la sesion online.
  - `TOURNAMENT`: monta la sesion local del torneo.
- Eliminar del flujo visible el selector actual `LOCAL/ONLINE`.
- Mantener un boton `Volver al Home` en ambas sesiones.
- Adaptar el HUD:
  - Endless muestra ronda, creditos, estado de conexion y sala.
  - Tournament muestra ronda, combate, progreso y bracket.
- Mantener la arena 3D y los overlays actuales como base, pero condicionar mejor cada vista segun el modo.

### 2. Catalogo de candidatos y warmup HTTP
- Cambiar el catalogo para cargar todas las paginas necesarias con `pageSize=500`, no una pagina aleatoria.
- Filtrar el pool legislativo del torneo a `Diputado + Senador`.
- Conservar en cache solo metadata y URLs de imagen; no descargar imagenes en warmup.
- Reusar el mismo criterio de normalizacion en frontend y backend:
  - `id`
  - `name`
  - `party`
  - `region`
  - `type`
  - `typeKey`
  - `partyId`
  - `portraitUrl`
  - `imageUrl`
- Aplicar dedupe por `id` al construir pools de candidatos.
- Dejar una API interna utilitaria para:
  - cargar pool completo
  - obtener opciones unicas de partido
  - obtener opciones unicas de region por partido
  - obtener candidatos por filtros
  - elegir rivales aleatorios sin repetir

### 3. Endless online permanente
- `ENDLESS` usa la arena online existente, pero el contrato de estado cambia para soportar sala permanente:
  - 10 creditos iniciales
  - identidad visible `guestN`
  - lista de jugadores activos con `guestN($monto)`
  - estado `active/eliminated`
  - flag de `gameOver`
- Flujo:
  - `POST /session` crea o reingresa al jugador
  - `GET /state` devuelve estado publico de arena + jugador actual + lista de jugadores
  - `POST /bet` registra apuesta solo si el jugador sigue activo y la ventana esta abierta
  - `DELETE /session` saca al jugador de la sala y limpia su registro temporal
- Al liquidar una ronda:
  - si el jugador queda con `coins <= 0`, se marca eliminado
  - se elimina de sala, apuestas pendientes y listado activo
  - el frontend muestra `Game Over`
  - al cerrar vuelve al home
- Agregar panel lateral en frontend con jugadores conectados y highlight del jugador actual.
- Mantener polling, pero limitar eventos recientes y limpiar usuarios inactivos por TTL.
- El log de batalla y countdown siguen viniendo desde el backend como fuente de verdad.

### 4. Store temporal en SQLite + auto restart
- Reemplazar el fallback actual por SQLite temporal como store por defecto del modo online.
- Usar un archivo liviano temporal, por ejemplo `server/data/arena-temp.sqlite`, recreado o truncado al boot.
- Tablas minimas:
  - `arena_state`
  - `arena_events`
  - `arena_players`
  - `arena_bets`
- Guardar en jugadores:
  - `user_key`
  - `guest_number`
  - `coins`
  - `status`
  - `created_at`
  - `last_seen_at`
- Agregar operaciones de store:
  - `ensureUser`
  - `touchUser`
  - `listActivePlayers`
  - `placeBet`
  - `settleRound`
  - `removeUser`
  - `cleanup`
- Limpiar:
  - jugadores stale por TTL
  - apuestas viejas ya liquidadas
  - eventos fuera de ventana reciente
- Preparar configuracion de proceso con auto restart, preferentemente PM2, sin tocar otros backends del repo.

### 5. Tournament 32 con seleccion de congresista
- Extender el torneo a 32 peleadores y 5 rondas.
- Agregar una vista de setup antes de iniciar:
  - selector de `Partido`
  - selector de `Region`
  - selector de `Nombre`
  - preview del candidato elegido
  - boton de inicio
- Construccion del roster:
  - incluir exactamente al congresista elegido
  - completar con 31 rivales unicos aleatorios del pool legislativo
  - randomizar posicion en el bracket
- El torneo no usa apuestas:
  - no renderizar `BettingModal`
  - no mostrar economia de monedas
  - el combate inicia tras la intro o con CTA simple
- Bracket:
  - vista horizontal
  - final en el centro
  - progreso visual de ganadores y eliminados
  - estado visible del jugador seleccionado
- Flujo de ronda:
  - si el combate es del jugador, se juega en arena
  - si el combate es ajeno, se puede `Ver pelea`, `Saltar pelea` o `Saltar hasta fin de ronda`
  - `skip pelea` resuelve solo ese combate con simulacion instantanea
  - `skip ronda` resuelve todos los combates NPC restantes de la ronda
  - despues de la pelea del jugador aparece vista `fin de ronda`
- Si el jugador pierde, el torneo continua en modo espectador hasta la pantalla final.
- Reusar una simulacion pura compartida para que peleas vistas y skipeadas respeten la misma logica.

## Interfaces y contratos a ajustar
- Router de sesion frontend:
  - `home | endless | tournament`
- `TournamentContext`:
  - pasar a flujo `setup | bracket | fighting | round_summary | champion`
  - agregar `selectedCandidate`
  - agregar `playerFighterId` o `playerFighterIdx`
  - agregar `watchMode`
  - agregar cola o lista de combates pendientes por ronda
- `OnlineGameContext`:
  - mapear `viewer`
  - mapear `players[]`
  - mapear `guestLabel`
  - mapear `gameOver`
- API online:
  - `POST /api/online/session`
  - `DELETE /api/online/session`
  - `GET /api/online/state`
  - `POST /api/online/bet`
- Store backend:
  - nueva implementacion SQLite temporal con limpieza y listado de jugadores activos.

## Orden de trabajo recomendado
1. Ajustar home y navegacion para exponer solo `ENDLESS` y `TOURNAMENT`.
2. Rehacer el catalogo de candidatos con warmup completo y filtros de legislativos.
3. Implementar setup del torneo con selectores y roster de 32.
4. Extender engine y contexto del torneo para bracket 32, progreso, peleas ajenas y skips.
5. Adaptar overlays del frontend para ocultar apuestas/economia en torneo.
6. Migrar backend online a SQLite temporal.
7. Extender estado online con jugadores conectados, `guestN`, eliminacion y `gameOver`.
8. Agregar panel de jugadores en frontend endless.
9. Configurar auto restart del proceso online.
10. Verificar flujos completos y corregir inconsistencias de UX.

## Pruebas y escenarios
- Build frontend y arranque backend sin errores.
- Home:
  - solo aparecen `ENDLESS` y `TOURNAMENT`
- Endless:
  - crea sesion y muestra `guestN`
  - creditos iniciales = 10
  - lista de jugadores visible
  - apuesta valida durante betting
  - monto actualizado tras resultado
  - al llegar a 0 muestra `Game Over`
  - al cerrar `Game Over` vuelve al home
  - usuarios stale desaparecen por TTL
  - reinicio del proceso resetea el estado temporal
- Tournament:
  - setup carga pool HTTP completo
  - filtros `Partido`, `Region`, `Nombre` funcionan encadenados
  - roster contiene al candidato elegido una sola vez
  - bracket se genera con 32
  - no aparecen apuestas ni monedas
  - combate del jugador corre normalmente
  - peleas ajenas permiten `Ver pelea`, `Saltar pelea` y `Saltar hasta fin de ronda`
  - la vista de fin de ronda refleja progreso real
  - si el jugador pierde, el torneo continua en modo espectador
  - pantalla de campeon funciona
- Datos:
  - warmup no descarga imagenes
  - las imagenes solo se solicitan al renderizar candidatos visibles

## Supuestos y defaults
- “Congresistas” = solo `Diputado` y `Senador`.
- `ENDLESS` es exclusivamente la arena online permanente; el endless local deja de ser una opcion visible.
- Creditos iniciales en endless: `10`.
- Tournament no usa apuestas ni economia.
- El store online sera SQLite temporal en Node.js.
- El archivo SQLite se considera temporal y se resetea al boot.
- Si faltara algun rival unico al armar 32, se permite fallback con repeticion, aunque no deberia ocurrir con el volumen actual de la API.
