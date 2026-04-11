# Estructura y Fuente de Verdad

## Regla principal

La fuente de verdad del frontend no esta en `dist/`.

La fuente de verdad esta en:

- `index.html`
- `src/`
- `vite.config.js`

`dist/` existe solo como salida de `npm run build` y como contenido que luego se despliega al hosting.

## Que significa en la practica

- No se deben hacer cambios manuales dentro de `dist/`.
- Si un archivo debe terminar en `dist/`, hay que conseguirlo desde:
  - un cambio en `index.html`
  - un cambio en `src/`
  - un cambio en `vite.config.js`
  - o un paso automatizado del pipeline de build

## Frontend

- `index.html` raiz: entrada real del proyecto en desarrollo.
- `src/main.jsx`: boot del frontend.
- `src/components/`: componentes React.
- `src/context/`: estado de juego local y online.
- `src/utils/`: helpers de API, retratos y generacion de peleadores.
- `src/assets/`: assets fuente versionados.

## Retratos de candidatos

Los retratos fuente viven en:

`src/assets/images/candidates/`

Pero la URL publica estable del sitio es:

`/images/candidates/<archivo>.webp`

Razon:

- el backend y snapshots viejos ya manejan rutas del estilo `images/candidates/...`
- el navegador necesita una URL publica simple y estable
- no queremos meter miles de retratos dentro del bundle JS

Implementacion actual:

- `vite.config.js` expone esa carpeta en desarrollo bajo `/images/candidates`
- `vite.config.js` copia esa carpeta a `dist/images/candidates` al hacer build
- `src/utils/portraitResolver.js` transforma entradas como:
  - `images/candidates/cand_x.webp`
  - `/uploads/images/candidates/cand_x.webp`
  - `https://api.candidatos.incaslop.online/uploads/images/candidates/cand_x.webp`
  en:
  - `/images/candidates/cand_x.webp`

## Build

Comando:

```bash
npm run build
```

Efecto:

- Vite empaqueta JS/CSS en `dist/assets/`
- el plugin de `vite.config.js` copia `src/assets/images/candidates/` a `dist/images/candidates/`

## Deploy del frontend

Fuente:

- `.github/workflows/deploy.yml`
- `scripts/deploy.ps1`

Flujo:

1. el workflow genera un `.env` temporal con los secretos requeridos
2. corre `npm ci`
3. corre `npm run build`
4. sube `dist/` por FTP

## Regla para futuras correcciones

Si algo falla en produccion y el error apunta a una ruta dentro de `dist/`, la correccion no debe hacerse editando `dist/` a mano.

La correccion debe vivir en la fuente o en el build para que el siguiente deploy la regenere correctamente.
