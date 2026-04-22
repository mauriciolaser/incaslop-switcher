# Plan

Esta aplicación es un switcher, es una página que se ejecuta en el servidor, un navegador lightweight con capacidad de Javascript que ejecuta una página y que transmite su contenido a Kick.

La idea es que transmita las páginas cada cierto tiempo, y que también un dashboard externo permita controlar y monitorear.

Entonces necesito que exista una carpeta /switcher y otra que se llame /dashboard con sus propias formas de deployment. Switcher va a ir a un VPS y Dashboard va a ir a un shared namecheap hosting. 

El proyecto debe ser un mega MVP.

## Dashboard

Es una aplicación expuesta en la que yo puedo ver el programa que está trasmitiéndose (la página que está streameándose) y puedo elegir otra URL para que esa sea la página que se streamea. La información viaja al servidor mediante un HTTP post básico y genera el cambio.

## Switcher

Es un navegador que streamea páginas en tamaño 1920 x 1080 y que muestra el contenido que está viendo al canal de Kick como se puede ver en la configuración previa.