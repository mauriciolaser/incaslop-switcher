# API Candidatos

Existe una API pública de candidatos. El problema es que solo maneja 500 por página, debe hacerse iterativamente el fetch una vez que se carga la aplicación:

Todos los senadores:
/v1/candidates?type=senador&page=1&pageSize=500
Todos los vicepresidentes:
/v1/candidates?type=vicepresidente&page=1&pageSize=500
Todos los diputados:
/v1/candidates?type=diputado&page=1&pageSize=500

## Retratos en frontend

Los retratos no deben cargarse desde `src/assets/images/candidates` como imports de Vite ni desde `/assets/...` con hash.

La ruta estable del proyecto es:

`/images/candidates/<archivo>.webp`

Implementacion actual:

- La fuente de archivos vive en `src/assets/images/candidates/`.
- En `vite.config.js` esa carpeta se sirve en desarrollo como `/images/candidates`.
- En build, esa carpeta se copia a `dist/images/candidates`.
- `src/utils/portraitResolver.js` normaliza cualquier valor recibido (`images/candidates/...`, `/uploads/images/candidates/...` o URL absoluta) a `/images/candidates/<archivo>`.

Ventajas:

- evita `404` por assets hasheados o rutas relativas inconsistentes
- evita meter miles de retratos dentro del bundle JS
- mantiene una URL publica simple y compatible con snapshots viejos del backend
