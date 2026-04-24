# Controles
Este es un plan para el mejoramiento de los procesos que controlan el switcher

## Necesidad
Necesito mejorar las herramientas que tengo para reproducir contenido y programarlo. Además, necesito que esto sea fácil de usar.

## PLAYLIST
Los usuarios dashboard necesitan crear una video-playlist. 

En un panel ingresan urls y tiempo de duración en minutos y segundos. Son UX friendly de manera lógica y funcional, por lo que se puede trabajar con minutos y segundos fácilmente.

Las playlist se deben guardar como archivos json en la carpeta del backend /video-playlist/nombredeplaylist.json

El frontend muestra todas las video-playlist. 

El panel principal del dashboard debe poder switchear entre tabs entre modo LIVE | PLAYLIST

En la vista de PLAYLIST tienes paneles para poder crear una playlist, y para programar playlist, es decir, puedes hacer un programa de playlist. Al final tiene que haber un switch para que se decida qué pasa cuando acaba la cola: REPETIR? Si no se selecciona el switch, entonces vuelve al VIDEO_DEFAULT

La vista playlist tiene que tener sus controles para poder poner Stop o Play, los cuales deben hacer override a lo que viene del modo LIVE.

Se debe poder importar playlist en formato JSON y subir al servidor desde el dashboard.

## DEFAULT_URL
El campo DEFAULT_URL debe ser configurable en el dashboard. Por defecto debe ir como https://sinadef.incaslop.online

## LIVE
Es el modo que actualmente existe. 

Actualmente hay un bug que hace que la URL que está reproduciéndose reemplace el texto que ingreso para cambiar la url en la sección CAMBIAR URL

## Mensajes Overlay
Todo lo relacionado a los mensajes de overlay debería estar en un menú que lleva a una vista donde se controla.

## UX 
Debe haber un panel superior de una línea con data: status (rojo o verde), now playing en video, now playing en audio y uptime.

## Documentación 
Documenta todo en docs/controles.md