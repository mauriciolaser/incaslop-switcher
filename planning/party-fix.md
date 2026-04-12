# Party-Fix

Vamos a arreglar los id de los parties y la forma en que se usan.

1. Los id los extraes del nombre en candidates.json:

cand_2933

el id: 2933

2. Actualiza candidates.json con el id. partyId debe usar el id extraido (2933, por ejepmplo), y que lo que actualmente es partyId será partyLabel.

3. Luego, actualiza src/data/parties.json para que esos parties tengan el id que extraerás de candidates.json.

4. Finalmente, documenta estos cambios.

---

## Cambios implementados

### Esquema de IDs

| Campo | Antes | Ahora |
|---|---|---|
| `partyId` | slug (ej. `"libertad-popular"`) | ID numérico (ej. `"2933"`) |
| `partyLabel` | no existía | slug original (ej. `"libertad-popular"`) |

El ID numérico se extrae del campo `id` del candidato: `cand_2933_...` → `2933`.

### Archivos modificados

**Datos:**
- `server/src/data/candidates.json` — `partyId` ahora es numérico; se agrega `partyLabel` con el slug anterior.
- `src/data/parties.json` — `id` de cada partido ahora es el ID numérico (ej. `"2933"`).

**Servidor:**
- `server/src/candidateCatalog.js` — `normalizeCandidate` extrae `partyLabel` y `transparentUrl`.
- `server/src/battleEngine.js` — `createFighter` incluye `partyLabel` y `transparentUrl`.

**Cliente:**
- `src/utils/candidateCatalog.js` — `normalizeCandidate` propaga `partyLabel`.
- `src/utils/fighterFactory.js` — `buildCandidateProfile` e `instantiateRosterFighter` propagan `partyLabel`.
- `src/components/BattleScene.jsx` — sprite sheet lookup usa `fighter.partyLabel` (slug) en lugar de `fighter.partyId`.

### Imágenes transparentes en modo Endless

En el servidor, `candidateCatalog.js` ahora mapea `transparentImage` → `transparentUrl` con el prefijo `/`.
`battleEngine.js` incluye `transparentUrl` en el objeto fighter enviado al cliente.
`BattleScene.jsx` ya usaba `fighter.transparentUrl ?? fighter.portraitUrl`, por lo que los personajes del modo Endless ahora muestran la imagen recortada igual que en Tournament.