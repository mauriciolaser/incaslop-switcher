# IncaSlop Mechas

Frontend React/Vite para `mechas.incaslop.online` y backend Node/Express para la arena online publicada en `api-mechas.incaslop.online`.

## Estado real del proyecto

- La fuente de verdad del frontend vive en la raiz del repo: `index.html`, `src/`, `vite.config.js`.
- `dist/` es solo un artefacto generado por `npm run build`.
- El backend vive en `server/`.
- El despliegue del frontend se hace con GitHub Actions por FTP.
- El despliegue del backend se documenta aparte para el VPS AlmaLinux.

## Estructura util

- `index.html`: entrada real del frontend en desarrollo.
- `src/`: codigo fuente React, utilidades y assets.
- `src/assets/images/candidates/`: repositorio fuente de retratos de candidatos.
- `server/`: backend online Node/Express.
- `.github/workflows/deploy.yml`: build y deploy del frontend.
- `scripts/deploy.ps1`: helper local para disparar el workflow `Deploy`.
- `docs/`: documentacion operativa.

## Flujo correcto de frontend

1. Se modifica codigo fuente en `index.html`, `src/` o `vite.config.js`.
2. `npm run build` genera `dist/`.
3. El workflow `Deploy` sube `dist/` al hosting.

Regla importante:

- No se versionan cambios manuales en `dist/`.
- Si algo debe aparecer en `dist/`, la logica debe vivir en el codigo fuente o en el pipeline de build.

## Retratos de candidatos

Los retratos viven en `src/assets/images/candidates/`, pero la URL publica estable del proyecto es:

`/images/candidates/<archivo>.webp`

Eso se resuelve asi:

- en desarrollo, `vite.config.js` expone esa carpeta en `/images/candidates`
- en build, `vite.config.js` copia la carpeta a `dist/images/candidates`
- `src/utils/portraitResolver.js` normaliza rutas del backend o de la API a esa URL publica estable

La idea es evitar:

- `404` por rutas antiguas como `/images/candidates/...` que no existian en hosting
- dependencia de assets hasheados de Vite para miles de imagenes
- bundles gigantes por meter todos los retratos dentro del JS

## Variables y deploy del frontend

El workflow `Deploy` exige estos secretos:

- `FTP_HOST`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_DESTINATION`
- `VITE_GA_ID`
- `VITE_ONLINE_API_BASE`

`VITE_ONLINE_API_BASE` debe apuntar a:

`https://api-mechas.incaslop.online/server`

Para lanzar el deploy desde local:

```powershell
npm run deploy
```

Modo debug:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -DebugDeploy
```

## Documentacion relacionada

- [docs/estructura.md](C:/IncaSlop/incaslop-mechas/docs/estructura.md)
- [docs/api-candidatos.md](C:/IncaSlop/incaslop-mechas/docs/api-candidatos.md)
- [docs/backend-stack-vps-almalinux.md](C:/IncaSlop/incaslop-mechas/docs/backend-stack-vps-almalinux.md)
- [docs/codex-ssh-access.md](C:/IncaSlop/incaslop-mechas/docs/codex-ssh-access.md)
