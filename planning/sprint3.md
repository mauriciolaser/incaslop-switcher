# Sprint 3

## Estado

Implementado en frontend.

## Cambios aplicados

### Pantalla de pelea

- Se agrando el nombre del candidato y se lo movio a un panel superior mas jerarquico.
- Nombre, partido, stats y estados ahora viven dentro de un panel decorado pero minimalista.
- Se elimino el porcentaje de probabilidad de victoria del HUD superior.
- Se agrandaron los stats visibles del personaje.
- Se agrando y mejoro el panel de estados/notificaciones del combatiente.
- Se agrego un panel espejo vacio en la esquina inferior derecha para el futuro chat por websocket.

### Efectos visuales durante la pelea

- Se agrego flash verde para `veneno`.
- Se agrego flash celeste para `congelamiento`.
- Los ataques y efectos con color propio disparan flashes de pantalla con ese color.
- Se agrego una etiqueta grande en pantalla para reforzar visualmente el efecto/ataque activado.
- El overlay de KO se mantiene y convive con los flashes nuevos.

## Alcance tecnico

- No se cambiaron APIs del backend ni del cliente online.
- La logica visual se resolvio desde el estado ya disponible:
  - `battleLog`
  - `fighter.efectos`
  - `ataque.color`
  - `ataque.efecto`
- El panel de chat solo es visual en este sprint. No abre websocket ni agrega integracion real.

## Archivos afectados

- `src/components/HealthBar.jsx`
- `src/components/BattleScene.jsx`
- `src/components/FutureChatPanel.jsx`
- `src/App.jsx`
- `src/App.css`
- `src/utils/battleVisuals.js`
- `README.md`
- `docs/estructura.md`

## Validacion esperada

- El HUD superior se ve mas limpio, grande y legible.
- El log queda abajo a la izquierda con mas presencia.
- El panel de chat vacio aparece abajo a la derecha.
- Los flashes aparecen al aplicar efectos o ataques especiales, no de forma continua.
- El layout sigue siendo usable en desktop y mobile.
