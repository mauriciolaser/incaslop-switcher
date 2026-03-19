# Sistema de Camaras - Battle Scene

## Modos de camara

### 1. Libre (default)
- OrbitControls habilitado
- El usuario mueve la camara libremente con mouse
- Zoom habilitado (min: 6, max: 18)

### 2. Peleador 1 (over-the-shoulder)
- Camara fija detras del hombro derecho del Peleador 1
- Mira hacia el oponente (Peleador 2)
- OrbitControls deshabilitado automaticamente

### 3. Peleador 2 (over-the-shoulder)
- Camara fija detras del hombro derecho del Peleador 2
- Mira hacia el oponente (Peleador 1)
- OrbitControls deshabilitado automaticamente

## Parametros de camara (constantes en BattleScene.jsx)

| Constante        | Valor | Descripcion                        |
|------------------|-------|------------------------------------|
| CAM_BACK         | 1.6   | Distancia detras del peleador      |
| CAM_SHOULDER     | 0.5   | Offset lateral (hombro derecho)    |
| CAM_HEIGHT       | 1.6   | Altura Y de la camara              |
| CAM_LOOK_HEIGHT  | 0.8   | Altura Y del punto de mira         |
| CAM_LERP_SPEED   | 4     | Velocidad de transicion suave      |

## Componentes

### CameraController
- Componente dentro del Canvas (usa useThree/useFrame)
- Calcula posicion over-the-shoulder usando vector forward (fighter -> opponent) y vector right (cross product)
- Transicion suave con lerp al cambiar entre modos
- Al volver a "Libre", reactiva OrbitControls y resetea target a [0, 0.5, 0]

### CameraSelector
- UI overlay (HTML) fuera del Canvas
- Botones centrados en la parte inferior de la pantalla
- Estilo translucido con backdrop blur
- Boton activo resaltado en azul

## Archivo modificado
- `src/components/BattleScene.jsx`
