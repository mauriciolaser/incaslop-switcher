# Audio

Este es un plan para el mejoramiento de los procesos que controlan el audio en el switcher

## Necesidad
Necesito una herramienta de carga de archivos .mp3 a la carpeta /audio que está montada en el backend (switcher). Desde el dashboard el usuario deberá poder cargar archivos de hasta 10 MB al servidor mediante un panel estilizado como el resto del proyecto.

# UX
El usuario debe poder ver la lista de canciones actuales (las cargadas en la carpeta). El usuario puede decidir si quiere elegir una canción inmediatamente, luego de seleccionarla. El usuario debe de poder parar la música también o ponerle mute.

El usuario puede crear audio-playlist en /audio-playlist/nombredeplaylist.json

Tiene que ser una vista amigable y estandarizada para poder seleccionar canciones de la cola y poder dragear y ordenarlas. Al final debe tener un switcher que decida que cuando la playlist se acabe REPETIR? Si no selecciona el switch, entonces vuelve a reproducir la lista de todo el catálogo cargado en /audio

El usuario debe poder archivar canciones, para que no se vean en la cola de reproducción y que no puedan verse en la playlist.

Se debe poder importar playlist en formato JSON y subir al servidor desde el dashboard.

# Documentacion
Documenta todo en docs/audio.md