# Deploy Runbook

Documento canonico de deployment para este repo.

## Workflow oficial

- Archivo: `.github/workflows/deploy.yml`
- Nombre: `Deploy Switcher`
- Trigger: `workflow_dispatch`

Inputs:

- `deploy_dashboard` (boolean): ejecuta job FTP del dashboard.
- `deploy_switcher` (boolean): ejecuta job VPS del backend.
- `debug` (boolean): agrega pasos de diagnostico en ambos jobs.

## Secrets requeridos

### Dashboard (FTP)

- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_DESTINATION`

Consumo en workflow:

- Job `dashboard`, paso `Verificar secrets FTP`.
- Job `dashboard`, paso `Deploy dashboard via FTP`.

### Switcher deploy (VPS)

- `SWITCHER_HOST`
- `SWITCHER_PORT`
- `SWITCHER_USER`
- `SWITCHER_PASSWORD`
- `SWITCHER_REMOTE_BASE_DIR`
- `SWITCHER_REMOTE_SERVICE_DIR`

Consumo en workflow:

- Job `switcher`, paso `Verificar secrets switcher`.
- Job `switcher`, paso `Subir paquete al VPS`.
- Job `switcher`, paso `Aplicar deploy remoto y reiniciar PM2`.

### Runtime del switcher (.env remoto)

- `PORT`
- `KICK_RTMP_URL`
- `KICK_STREAM_KEY`
- `ALLOWED_ORIGIN`
- `API_TOKEN`
- `CHROMIUM_EXECUTABLE_PATH`
- `DISPLAY_NUM`
- `STREAM_WIDTH`
- `STREAM_HEIGHT`
- `STREAM_FPS`
- `VIDEO_BITRATE`
- `MAXRATE`
- `BUFSIZE`
- `GOP`
- `PRESET`
- `AUDIO_BITRATE`
- `DEFAULT_URL`

Consumo en workflow:

- Job `switcher`, paso `Verificar secrets switcher`.
- Job `switcher`, paso `Armar paquete de deploy`.
- Se materializan en `deploy_bundle/switcher/.env` y se despliegan al VPS.

## Flujo de ejecucion

1. Ir a GitHub > `Actions` > `Deploy Switcher`.
2. Click en `Run workflow`.
3. Seleccionar rama/ref.
4. Definir toggles:
- Solo dashboard: `deploy_dashboard=true`, `deploy_switcher=false`.
- Solo backend: `deploy_dashboard=false`, `deploy_switcher=true`.
- Deploy completo: ambos `true`.
5. Revisar logs del run.

## Dispatch desde local (GitHub CLI)

Prerequisitos:

- `gh` instalado.
- `gh auth status` en estado autenticado.

Comando directo (repo explicito recomendado):

```powershell
gh workflow run "Deploy Switcher" -R mauriciolaser/incaslop-switcher --ref main -f deploy_dashboard=true -f deploy_switcher=true -f debug=false
```

Variantes utiles:

- Solo dashboard:

```powershell
gh workflow run "Deploy Switcher" -R mauriciolaser/incaslop-switcher --ref main -f deploy_dashboard=true -f deploy_switcher=false -f debug=false
```

- Solo switcher:

```powershell
gh workflow run "Deploy Switcher" -R mauriciolaser/incaslop-switcher --ref main -f deploy_dashboard=false -f deploy_switcher=true -f debug=false
```

- Modo debug:

```powershell
gh workflow run "Deploy Switcher" -R mauriciolaser/incaslop-switcher --ref main -f deploy_dashboard=true -f deploy_switcher=true -f debug=true
```

Helper local incluido en este repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

Ejemplos con helper:

```powershell
# Solo backend
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DeployDashboard:$false -DeploySwitcher:$true

# Solo dashboard
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DeployDashboard:$true -DeploySwitcher:$false

# Con debug y otra rama
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -branch feature/overlay -DebugDeploy
```

## Que hace cada job

### Job `dashboard`

1. Checkout.
2. Verifica secrets FTP.
3. Verifica `dashboard/index.html`, `dashboard/config.js`, `dashboard/.htaccess`.
4. Publica carpeta `dashboard/` via `SamKirkland/FTP-Deploy-Action@v4.3.5`.

### Job `switcher`

1. Checkout + Node 22.
2. Verifica todos los secrets de deploy y runtime.
3. `node --check` para:
- `switcher/server.js`
- `switcher/stream-manager.js`
- `switcher/playlist-manager.js`
- `switcher/audio-loop-manager.js`
4. Empaqueta backend + audio en `switcher-deploy.tgz`.
5. Genera `.env` desde GitHub Secrets y lo incluye en el bundle.
6. Sube tarball al VPS por `scp`.
7. Extrae en ruta remota y reinicia PM2 (`restart all` o `start ecosystem`).
8. Ejecuta `pm2 list` para verificacion final.

## Validacion post deploy

### Dashboard

- Abrir dashboard publico.
- Confirmar que carga sin errores de JS/CORS.
- Confirmar que `window.SWITCHER_API` y `window.SWITCHER_TOKEN` en `dashboard/config.js` estan alineados con backend.

### Switcher

- Validar run de Actions en verde.
- En VPS, validar proceso:

```bash
pm2 list
pm2 logs --lines 100
```

- Confirmar API:

```bash
curl -s http://127.0.0.1:3000/status
```

Ajustar puerto si `PORT` usa otro valor.

## Troubleshooting rapido

- Error `... no esta definido en GitHub Secrets`:
  falta cargar secret requerido.
- Falla FTP:
  revisar host, user, password y destino remoto con slash final.
- Falla SSH/SCP:
  revisar `SWITCHER_HOST`, `SWITCHER_PORT`, `SWITCHER_USER`, `SWITCHER_PASSWORD`.
- Falla PM2:
  verificar que PM2 exista en PATH del usuario remoto y que `ecosystem.config.cjs` este en `SWITCHER_REMOTE_SERVICE_DIR`.
- API responde `401` desde dashboard:
  `window.SWITCHER_TOKEN` no coincide con `API_TOKEN` del deploy.

## Fallback local (Windows)

Si GitHub Actions esta bloqueado, usar:

```powershell
npm run deploy:switcher
```

Script usado: `scripts/deploy-switcher-backend.ps1`.

Notas:

- Este fallback despliega backend + audios y opcionalmente dashboard FTP.
- Para omitir dashboard:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-switcher-backend.ps1 -SkipDashboard
```
