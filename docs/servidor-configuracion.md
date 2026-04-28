# Checklist de Configuración del Servidor

Este documento asegura que el servidor siempre esté correctamente configurado.

## Checklist de Permisos

- [ ] `~/switcher/` es propiedad de `mauri:mauri`
- [ ] `~/switcher/data/` es propiedad de `mauri:mauri`
- [ ] `~/switcher/logs/` es propiedad de `mauri:mauri`

Verificar:
```bash
ls -la ~/ | grep switcher
ls -la ~/switcher/data/
ls -la ~/switcher/logs/
```

Corregir si es necesario:
```bash
sudo chown -R mauri:mauri ~/switcher/
```

## Checklist de Variables de Entorno

Verificar en GitHub Secrets:
- [ ] `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser` (NO `/usr/bin/chromium`)
- [ ] `KICK_RTMP_URL` y `KICK_STREAM_KEY` están presentes
- [ ] `API_TOKEN`, `PORT`, `ALLOWED_ORIGIN` están configurados

## Checklist de PM2

- [ ] PM2 ejecuta como usuario `mauri` (verificar con `pm2 status` - debe mostrar `user=mauri`)
- [ ] El proceso `incaslop-switcher` está en estado `online`
- [ ] No hay múltiples procesos corriendo (máximo 1 instancia)

Verificar estado:
```bash
pm2 status
pm2 logs --lines 20
```

Si PM2 está como root, reiniciar:
```bash
sudo pm2 kill
sleep 2
pm2 start ~/switcher/ecosystem.config.cjs
```

## Checklist de Herramientas

- [ ] Chromium instalado: `which chromium-browser` → `/usr/bin/chromium-browser`
- [ ] FFmpeg instalado: `which ffmpeg` → `/usr/local/bin/ffmpeg`
- [ ] Xvfb instalado: `which Xvfb` → `/usr/bin/Xvfb`
- [ ] Node.js v22+: `node --version`
- [ ] npm 10+: `npm --version`

## Checklist Post-Deployment

Después de cada deployment:

1. Verificar que el `.env` fue actualizado:
   ```bash
   grep CHROMIUM ~/switcher/.env
   # Debe mostrar: CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

2. Verificar que PM2 corre como `mauri`:
   ```bash
   pm2 status
   # Debe mostrar user=mauri
   ```

3. Verificar que el stream está activo:
   ```bash
   tail -n 10 ~/switcher/logs/general.log | grep -E "stream.start|ffmpeg|error"
   # Debe mostrar: [stream.start.ok] [stream] Started
   ```

4. Verificar que FFmpeg está transmitiendo:
   ```bash
   tail -n 5 ~/switcher/logs/general.log
   # Debe mostrar: frame=XXX fps=30
   ```

## Troubleshooting Rápido

| Problema | Síntoma | Solución |
|---|---|---|
| Permisos de data/ | `EACCES: permission denied` | `sudo chown -R mauri:mauri ~/switcher/` |
| Chromium no encontrado | `spawn /usr/bin/chromium ENOENT` | Verificar `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser` en `.env` |
| PM2 como root | `user=root` en `pm2 status` | `sudo pm2 kill && pm2 start ~/switcher/ecosystem.config.cjs` |
| FFmpeg no encontrado | `spawn ffmpeg ENOENT` | Verificar PATH incluye `/usr/local/bin` o que PM2 corre como `mauri` |
| Puerto 3000 en uso | `EADDRINUSE port 3000` | `sudo pkill -f 'node.*server.js' && pm2 restart all` |

## Notas Importantes

- **PM2 como mauri**: El usuario `mauri` debe ser quien ejecute PM2 siempre. Esto asegura permisos correctos en `~/switcher/data/`.
- **Chromium path**: AlmaLinux instala Chromium como `chromium-browser`, no `chromium`. Esto está configurado en GitHub Secrets.
- **FFmpeg PATH**: FFmpeg está en `/usr/local/bin`, asegurarse que esté en el PATH de sesión de `mauri`.
