# Acceso SSH de Codex al VPS

## Datos del servidor

- **Host:** `172.234.228.138`
- **Puerto:** `22`
- **Usuario:** `mauri`
- **Servicio backend:** `incaslop-mechas-backend.service`
- **Backend desplegado en:** `/home/mauri/incaslop-mechas/backend`
- **Proyecto remoto base:** `/home/mauri/incaslop-mechas`

## Clave SSH dedicada para Codex

- **Clave privada (local recomendada):** `ssh-vps.txt` en la raíz de este repo
- **Clave privada alternativa:** `C:\Users\mauri\.ssh\claude_vps`
- **Clave pública (en servidor):** `~/.ssh/authorized_keys` — línea que termina en `claude-agent`

La clave pública fue instalada con:

```cmd
type C:\Users\mauri\.ssh\claude_vps.pub | ssh -p 22 mauri@172.234.228.138 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## Cómo darle acceso a Codex en una conversación

1. Abre `C:\Users\mauri\.ssh\claude_vps` con un editor de texto.
2. Copia todo el contenido.
3. Al inicio de la conversación con Codex, pega la clave y di algo como:
   > "Conéctate al servidor: host 172.234.228.138, puerto 22, usuario mauri, clave: [pegado]"

Codex puede usar directamente `ssh-vps.txt` si existe en el workspace. Eso evita recrear la clave en archivos temporales.

## Nota útil para este proyecto

- El backend corre como servicio de usuario, no como servicio global de `systemd`:

```bash
systemctl --user status incaslop-mechas-backend.service --no-pager
systemctl --user restart incaslop-mechas-backend.service
journalctl --user -u incaslop-mechas-backend.service -n 50 --no-pager
```

- El healthcheck local del backend es:

```bash
curl http://127.0.0.1:3003/health
```

- Comando SSH recomendado desde este repo:

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138
```

- Verificación rápida antes de desplegar:

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "systemctl --user status incaslop-mechas-backend.service --no-pager --lines=6"
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "curl -fsS http://127.0.0.1:3003/health"
```

## Deploy backend rápido

Principio:
- Subir el código fuente del backend y `src/data` de este proyecto.
- No subir `node_modules`.
- No subir `dist`.
- No tocar `.env` remoto salvo que el cambio lo requiera explícitamente.
- No volver a subir `src/data` si no hubo cambios en esos JSON.

Empaquetar solo backend:

```bash
tar --exclude='node_modules' --exclude='dist' -czf backend_deploy.tar.gz -C server .
```

Subir paquete:

```bash
scp -i ssh.txt -o StrictHostKeyChecking=accept-new backend_deploy.tar.gz mauri@172.234.228.138:/home/mauri/backend_deploy.tar.gz
```

Sincronizar datos de juego (`src/data`):

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "mkdir -p /home/mauri/incaslop-mechas/src"
scp -i ssh.txt -o StrictHostKeyChecking=accept-new -r src/data mauri@172.234.228.138:/home/mauri/incaslop-mechas/src/
```

Desplegar preservando `.env`:

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "set -e; mkdir -p /home/mauri/incaslop-mechas; cd /home/mauri/incaslop-mechas; if [ -f /home/mauri/incaslop-mechas/backend/.env ]; then cp /home/mauri/incaslop-mechas/backend/.env /home/mauri/backend.env.backup; fi; rm -rf /home/mauri/incaslop-mechas/backend; mkdir -p /home/mauri/incaslop-mechas/backend; tar -xzf /home/mauri/backend_deploy.tar.gz -C /home/mauri/incaslop-mechas/backend; if [ -f /home/mauri/backend.env.backup ]; then cp /home/mauri/backend.env.backup /home/mauri/incaslop-mechas/backend/.env; elif [ -f /home/mauri/incaslop-mechas/backend/.env.example ]; then cp /home/mauri/incaslop-mechas/backend/.env.example /home/mauri/incaslop-mechas/backend/.env; fi; if grep -q '^PORT=' /home/mauri/incaslop-mechas/backend/.env; then sed -i 's/^PORT=.*/PORT=3003/' /home/mauri/incaslop-mechas/backend/.env; else echo 'PORT=3003' >> /home/mauri/incaslop-mechas/backend/.env; fi; cd /home/mauri/incaslop-mechas/backend; npm install; systemctl --user restart incaslop-mechas-backend.service"
```

Notas:
- Este flujo ya fue validado en producción.
- `npm install` se ejecuta en el VPS; por eso no hace falta subir dependencias locales.
- Este backend no requiere `build`; se ejecuta directamente con `node src/app.js`.
- `PORT=3003` evita colisión con otros servicios ya activos en el VPS.

## Verificación post-deploy

Confirmar que el reinicio fue real:

```bash
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "systemctl --user status incaslop-mechas-backend.service --no-pager --lines=6"
ssh -i ssh.txt -o StrictHostKeyChecking=accept-new mauri@172.234.228.138 "curl -fsS http://127.0.0.1:3003/health"
```

Qué mirar:
- `Active: active (running)` debe seguir sano.
- El `since` del servicio debe ser reciente si hubo reinicio.
- El `Main PID` debe cambiar si el proceso se recreó.
- En `/health`, `uptimeMs` debe volver a un valor bajo tras el restart.

Si `status` tarda o parece cacheado, usar `/health` como fuente de verdad rápida.

## Permisos sudo del usuario mauri en el servidor

`mauri` pertenece al grupo `wheel` y tiene sudo completo con password.  
Además tiene NOPASSWD para estos comandos específicos (configurado en `/etc/sudoers.d/`):

```text
(ALL) NOPASSWD: /bin/systemctl
(ALL) NOPASSWD: /bin/chown
(ALL) NOPASSWD: /usr/bin/journalctl
```

En este proyecto igual conviene probar primero `systemctl --user`, porque el backend actual corre en la sesión del usuario `mauri`.

## Para revocar acceso a Codex

```bash
nano ~/.ssh/authorized_keys
# Eliminar la línea que termina en "claude-agent"
```
