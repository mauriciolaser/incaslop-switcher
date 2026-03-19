# Server Integration Log

## Resumen

Se implemento una separacion explicita entre modo `LOCAL` y modo `ONLINE`.

- `LOCAL` conserva la simulacion actual en cliente.
- `ONLINE` usa un backend Node.js pensado para `Setup Node.js App` en Namecheap shared hosting.
- La sincronizacion online se hace por polling HTTP.
- La pelea online es una sola arena global e infinita compartida por todos los jugadores.
- Las monedas y apuestas son personales por sesion/cookie.

## Cambios en frontend

### Selector de modo

Se reemplazo la entrada unica del juego por una seleccion inicial:

- `LOCAL`
- `ONLINE`

Archivo principal:

- `src/App.jsx`

Cambios clave:

- Se agrego la pantalla inicial de seleccion de modo.
- Se agrego una barra superior con estado de sesion y boton `Cambiar Modo`.
- `LOCAL` monta `LocalGameProvider`.
- `ONLINE` monta `OnlineGameProvider`.
- El flujo local y el flujo online reutilizan la misma UI principal siempre que el contrato de datos sea compatible.

### Contrato comun del juego

Archivo:

- `src/context/GameContext.jsx`

Cambios:

- `GameContext` ahora se exporta para permitir reutilizacion desde el proveedor online.
- `GameProvider` paso a ser alias de `LocalGameProvider`.
- El contexto local expone ahora tambien:
  - `isOnline`
  - `connectionStatus`
  - `countdown`
  - `onlineError`

### Nuevo proveedor online

Archivo:

- `src/context/OnlineGameContext.jsx`

Responsabilidades:

- Crear o recuperar sesion online.
- Leer snapshot del servidor.
- Consultar eventos nuevos con polling incremental.
- Exponer al frontend una forma de estado compatible con el modo local.
- Registrar apuestas del usuario en el servidor.
- Mostrar errores de conexion sin cambiar automaticamente a `LOCAL`.

Comportamiento:

- Polling cada `1500ms`.
- Usa `latestEventId` para pedir solo eventos nuevos.
- Mantiene `battleLog`, `phase`, `fighters`, `winner`, `lastResult`, `coins`, `bet` y `countdown`.
- Si falla una llamada, marca `connectionStatus = 'error'` y conserva el ultimo estado conocido.

### Cliente API online

Archivo:

- `src/utils/onlineApi.js`

Endpoints consumidos:

- `POST /api/online/session`
- `GET /api/online/state`
- `GET /api/online/events?since=<id>`
- `POST /api/online/bet`

Configuracion:

- Usa `VITE_ONLINE_API_BASE`
- Si no existe, toma por defecto `/api/online`

### Componentes adaptados para ONLINE

Archivos:

- `src/components/FightIntroModal.jsx`
- `src/components/BettingModal.jsx`
- `src/components/GameOver.jsx`
- `src/components/BattleHUD.jsx`

Cambios:

- `FightIntroModal`:
  - En `ONLINE` ya no abre apuestas manualmente.
  - Muestra countdown o mensaje de espera del servidor.

- `BettingModal`:
  - En `ONLINE` no usa countdown local ni llama al motor local.
  - Usa el countdown recibido del servidor.
  - Deshabilita apuesta si no hay conexion.
  - El mensaje final indica que la pelea comenzara automaticamente.

- `GameOver`:
  - En `ONLINE` no ofrece boton de siguiente ronda.
  - Informa que la siguiente ronda comenzara automaticamente.

- `BattleHUD`:
  - Muestra si la sesion es `Local` u `Online`.
  - En online muestra el estado de conexion.

### Integracion con torneo/menu existente

Archivo:

- `src/context/TournamentContext.jsx`

Cambio:

- `TournamentProvider` ahora acepta `initialMode`.

Uso actual:

- `LOCAL` inicia con `menu`.
- `ONLINE` inicia directamente con `online`.

Observacion:

- El modo online no implementa torneo.
- El torneo local existente no fue eliminado.

## Backend Node online

### Estructura creada

Nueva carpeta:

- `server/`

Archivos principales:

- `server/package.json`
- `server/.env.example`
- `server/src/app.js`
- `server/src/config.js`
- `server/src/gameData.js`
- `server/src/battleEngine.js`
- `server/src/gameService.js`
- `server/src/store/index.js`
- `server/src/store/fileStore.js`
- `server/src/store/mysqlStore.js`

### Objetivo del backend

La app Node actua como fuente de verdad del modo `ONLINE`.

Responsabilidades:

- Mantener la pelea global compartida.
- Avanzar automaticamente las fases del combate.
- Guardar el estado para recuperacion tras reinicios.
- Guardar apuestas y monedas por usuario.
- Servir snapshots y eventos via API.

### Motor online

Archivo:

- `server/src/gameService.js`

Fases manejadas:

- `intro`
- `betting`
- `fighting`
- `result`

Timers del servidor:

- `INTRO_DURATION_MS = 5000`
- `BETTING_DURATION_MS = 15000`
- `TURN_DELAY_MS = 1800`
- `RESULT_DURATION_MS = 7000`

Flujo:

1. Intro de ronda.
2. Apertura automatica de apuestas.
3. Inicio automatico del combate.
4. Procesamiento de turnos, DOT, stun, golpes, criticos y muerte.
5. Liquidacion de apuestas.
6. Preparacion automatica de la siguiente ronda.

Notas:

- El backend usa timers internos del proceso Node, no cron.
- Al iniciar, intenta cargar el estado persistido y continuar desde ahi.
- `catchUp()` procesa transiciones atrasadas si el reloj ya supero `nextActionAt`.

### API HTTP implementada

Archivo:

- `server/src/app.js`

Endpoints:

- `POST /api/online/session`
  - crea o recupera la cookie de sesion.

- `GET /api/online/state`
  - devuelve snapshot actual de la arena y vista del usuario.

- `GET /api/online/events?since=<id>`
  - devuelve eventos nuevos a partir del ultimo id conocido.

- `POST /api/online/bet`
  - registra o reemplaza la apuesta del usuario para la ronda actual.

- `GET /health`
  - endpoint simple de salud.

### Sesiones

Implementacion:

- cookie HTTP-only
- nombre configurable por `SESSION_COOKIE_NAME`
- generacion de `userKey` aleatoria

Objetivo:

- identificar al jugador sin login
- mantener monedas y apuestas propias por navegador/sesion

## Persistencia

### Almacenamiento principal

Archivo:

- `server/src/store/mysqlStore.js`

Tablas creadas automaticamente:

- `online_state`
- `online_events`
- `online_users`
- `online_bets`

Datos persistidos:

- snapshot completo de la arena
- eventos del combate
- saldo por usuario
- apuesta por usuario y ronda

### Fallback local de desarrollo

Archivo:

- `server/src/store/fileStore.js`

Se agrego para poder probar el backend incluso sin MySQL configurado.

Archivos usados:

- `server/data/arena-state.json`
- `server/data/arena-users.json`
- `server/data/arena-bets.json`
- `server/data/arena-events.json`

Regla:

- si hay variables de MySQL configuradas, usa MySQL
- si no hay MySQL y `ALLOW_FILE_FALLBACK=true`, usa archivos

Selector:

- `server/src/store/index.js`

## Scripts agregados

Archivo:

- `package.json`

Scripts nuevos:

- `online:install`
- `online:start`

Objetivo:

- instalar dependencias del backend con `npm --prefix server install`
- arrancar el backend con `npm --prefix server start`

## Verificaciones realizadas

Se verifico:

- `npm run build` del frontend: OK
- `node --check server/src/app.js`: OK
- `node --check server/src/gameService.js`: OK

No se pudo verificar:

- `npm run lint`

Motivo:

- el entorno local arrojo `EPERM` al resolver rutas fuera del workspace (`C:\\Users\\User`)

## Pendiente para despliegue real en Namecheap

Todavia falta configurar en hosting:

- instalar dependencias en `server/`
- variables reales de MySQL
- `PORT`
- `SESSION_COOKIE_NAME`
- URL final para `VITE_ONLINE_API_BASE` si frontend y backend no comparten base

Tambien conviene revisar antes del deploy:

- si el Node App se expone bajo subruta o subdominio
- si se necesita `secure: true` en cookies bajo HTTPS
- si se desea agregar CORS explicito para frontend y backend en dominios separados

## Observaciones tecnicas

- `ONLINE` reutiliza la UI actual, pero ya no depende de `useBattle` para simular.
- `LOCAL` conserva el flujo anterior.
- El modo online actualmente se apoya en una sola arena global.
- No se implementaron WebSockets; todo es polling.
- No se implemento autenticacion real; la identidad es por cookie.
