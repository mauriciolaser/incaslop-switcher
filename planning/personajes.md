# Personajes — Bio & Diálogos

## Objetivo
Enriquecer cada personaje con:
- **bio**: Texto narrativo que describe la historia y origen del personaje. Se muestra durante la pelea en un modal informativo.
- **dialogos** (array de 3 strings): Frases que dice el peleador al iniciar la pelea. Se selecciona una al azar antes de cada combate.

## Flujo de juego
1. Se emparejan dos peleadores.
2. **Pre-pelea**: Cada peleador aparece en pantalla con uno de sus 3 diálogos (seleccionado al azar).
3. **Durante la pelea**: Se puede abrir un modal con la **bio** de cada peleador.

## Estructura de datos (personajes.json)
```json
{
  "id": 1,
  "name": "Guerrero Inca",
  "attackRange": [18, 24],
  "defenseRange": [6, 9],
  "speedRange": [4, 7],
  "bio": "Texto de la bio...",
  "dialogos": [
    "Diálogo 1",
    "Diálogo 2",
    "Diálogo 3"
  ]
}
```

## Personajes

| # | Nombre | Arquetipo |
|---|--------|-----------|
| 1 | Guerrero Inca | Guerrero clásico del Tahuantinsuyo |
| 2 | Jaguar Negro | Bestia felina de la selva |
| 3 | Condor de Fuego | Ave mítica de los Andes |
| 4 | Serpiente Dorada | Reptil sagrado y veloz |
| 5 | Puma Sagrado | Felino guardián |
| 6 | Halcon Andino | Ave rápida de alta montaña |
| 7 | Lobo de Plata | Cánido resistente y táctico |
| 8 | Toro Bravo | Bestia de fuerza bruta |
| 9 | Fenix Oscuro | Ave de renacimiento oscuro |
| 10 | Titan de Piedra | Coloso lento pero devastador |
| 11 | Sombra Veloz | Asesino sigiloso |
| 12 | Apu del Trueno | Espíritu de montaña |
| 13 | Sacerdote Solar | Místico del sol |
| 14 | Chasqui Fantasma | Mensajero fantasmal ultrarrápido |
| 15 | Sierpe de Oro | Dragón serpiente dorado |
| 16 | Amaru Celeste | Serpiente alada celestial |
