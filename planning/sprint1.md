# Sprint 1

## Modos de juego
Vamos a hacer un cambio. Necesito que en el frontend haya un menú principal y que puedas elegir 2 modos de juego:

1. ENDLESS
2. TOURNAMENT

### Endless
Es un formato infinito. Las peleas ocurren en el servidor VPS y se van mandando con data binaria a los jugadores. Comienza con dos candidatos al azar. El jugador comienza con 10 fichas de crédito y tiene que apostar. Al apostar puede ganar, en base a los stakes, dinero. Si es que llega a perder el dinero, pierdo el run y es Game Over, de vuelva al Home.

Los jugadores pueden ver, además de la pelea, la lista de jugadores conectados en un panel. Al lado del guest# sale entre paréntesis la cantidad de dinero que tiene, por ejemplo: guest20($200).

Al perder, el jugador es retirado de la sala y su registro se elimina. El servidor debe guardar data temporalmente de la forma más eficiente.

### Tournament
Este es un formato limitado. El torneo tiene 32 peleadores. El jugador elige uno de los congresistas de la lista del total. Estos están organizados mediante selectores de Partido, Región, Nombre.

Luego de esto va a ver un fixture de las peleas (tipo torneo con llaves. la vista es horizontal, se encuentran los finalistas en el centro).

No hay apuestas. El jugador ve su pelea. Al terminar su pelea entra a una vista de fin de ronda, donde se ve cómo avanza su personaje y çomo se quedan los otros. Luego ve las peleas de los demás, pero puede hacer skip de pelea, o skip general para irse a la vista de fin de ronda.

## Multiplayer

Este modo es un endless que se está jugando permanentemente. 

## Data
La fuente de verdad de la data es /server/src/data/candidates.json. La imagen debe obtenerse haciendo un request a la API HTTP. El servidor debe hacer un warmup cargando toda la data que necesita y pedir las imágenes dinámicamente solo cuando son necesarias.

Debe buscarse el mejor enfoque, considerando que la data en el servidor no debe ser persistente.

## Procesos de trabajo
No toques nada en el backend que no esté relacionado a este proyecto. En algunos casos los proyectos son desplegados con patrones de otros backends y esto puede confundir. Revisar que no se interrumpan los procesos en curso.

Los procesos del VPS deben tener auto restart.

## Patrones de diseño
Debe optimizarse la memoria. Los temas de apuestas y demás deben verse en el frontend y enviarse como resultado al backend para que se guarden con la información de los jugadores.

## Visual
Necesito que las imágenes de los candidatos se peguen en el modelo de los peleadores. Recomiendo usar un Billboard / Sprite pegado a la cabeza.