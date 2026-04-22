# Acceso y deploy al servidor VPS

## Datos de conexión

| Campo  | Valor               |
|--------|---------------------|
| Host   | `159.198.65.35`     |
| Puerto | `22`                |
| Usuario| `mauri`             |
| OS     | AlmaLinux           |

Las credenciales completas están en `credenciales.txt` (no commitear).

## Herramientas requeridas (Windows)

El servidor solo acepta autenticación por contraseña para el usuario `mauri`. Desde Windows se necesita **PuTTY** (incluye `plink` y `pscp`), que ya está instalado en esta máquina.

> `sshpass` no está disponible en Git Bash/Windows, por eso se usa PuTTY.

## Subir un archivo al servidor

Los archivos del proyecto tienen permisos de `root`, así que `pscp` directo falla. La forma correcta es pipar el contenido local via `sudo tee`:

```bash
cat ruta/local/archivo.js | plink -pw 'PASSWORD' -P 22 mauri@159.198.65.35 \
  "echo 'PASSWORD' | sudo -S tee /home/mauri/switcher/archivo.js > /dev/null && echo OK"
```

Ejemplo concreto — subir `stream-manager.js`:

```bash
cat switcher/stream-manager.js | plink -pw 'PASS' -P 22 mauri@159.198.65.35 \
  "echo 'PASS' | sudo -S tee /home/mauri/switcher/stream-manager.js > /dev/null && echo OK"
```

## Ejecutar comandos remotos

```bash
plink -pw 'PASSWORD' -P 22 mauri@159.198.65.35 "comando aqui"
```

Para comandos que requieren `sudo`:

```bash
plink -pw 'PASSWORD' -P 22 mauri@159.198.65.35 "echo 'PASSWORD' | sudo -S comando"
```

## Reiniciar el switcher (PM2)

```bash
plink -pw 'PASSWORD' -P 22 mauri@159.198.65.35 "echo 'PASSWORD' | sudo -S pm2 restart all"
```

Ver estado de los procesos:

```bash
plink -pw 'PASSWORD' -P 22 mauri@159.198.65.35 "echo 'PASSWORD' | sudo -S pm2 list"
```

## Ubicación del proyecto en el servidor

```
/home/mauri/switcher/
├── stream-manager.js
├── server.js
├── ecosystem.config.cjs
├── .env
└── data/
```

PM2 corre el proceso como `root` (ver columna `user` en `pm2 list`). El ecosystem está en esa misma carpeta.

## Flujo completo de deploy

1. Editar archivo localmente
2. Subir con `plink` + `sudo tee`
3. Reiniciar con `pm2 restart all`

```bash
# 1. Subir
cat switcher/stream-manager.js | plink -pw 'PASS' -P 22 mauri@159.198.65.35 \
  "echo 'PASS' | sudo -S tee /home/mauri/switcher/stream-manager.js > /dev/null && echo OK"

# 2. Reiniciar
plink -pw 'PASS' -P 22 mauri@159.198.65.35 "echo 'PASS' | sudo -S pm2 restart all"
```

## Deploy en un solo comando (backend + audios)

Ahora existe un script local que empaqueta y despliega backend + `switcher/audio/*.mp3`:

```powershell
npm run deploy:switcher
```

El script:

1. Valida sintaxis de `server.js`, `stream-manager.js`, `playlist-manager.js`, `audio-loop-manager.js`
2. Empaqueta archivos backend y la carpeta `switcher/audio/`
3. Sube el paquete al VPS por `pscp`
4. Extrae en `/home/mauri/switcher/` con `sudo`
5. Ejecuta `pm2 restart all` y `pm2 list`

Opcionalmente, puedes pasar host/usuario/puerto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-switcher-backend.ps1 `
  -ServerHost 159.198.65.35 -Port 22 -User mauri
```

## Notas

- La llave privada en `ssh.txt` (ed25519) **no funciona** con `root` — el servidor tiene acceso por llave deshabilitado para root.
- El usuario `mauri` pertenece al grupo `wheel` (sudo habilitado con contraseña).
- PM2 usa `sudo` porque fue instalado y configurado como root.
