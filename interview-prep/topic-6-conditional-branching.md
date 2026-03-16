# Topic 6: Conditional Branching / Ramas Condicionales

## The Problem / El problema

Your current engine has a FIXED DAG — every step always runs (unless a dependency fails). In reality, verification flows need to take DIFFERENT PATHS based on results.

Tu motor actual tiene un DAG FIJO — cada paso siempre se ejecuta (a menos que una dependencia falle). En realidad, los flujos de verificacion necesitan tomar CAMINOS DIFERENTES basados en resultados.

Remember the IDnow InstantSign diagram:

```
Check ID validity
       |
  ┌────┴─────┐
  |          |
ID VALID   ID NOT VALID
  |          |
  v          v
 Sign     Full verification
           (VideoIdent/eID)
            then Sign
```

The path depends on the RESULT of the ID check. Your engine can't do this yet.

El camino depende del RESULTADO de la verificacion de ID. Tu motor no puede hacer esto todavia.

---

## The Solution: Guard Conditions on Edges / La solucion: Condiciones en las aristas

Instead of `next: ["stepB", "stepC"]` (always go to both), add conditions:

En vez de `next: ["stepB", "stepC"]` (siempre ir a ambos), agregar condiciones:

```
BEFORE (your current engine / tu motor actual):
  step: { id: "check_id", next: ["sign", "full_verification"] }
  // BOTH always execute / AMBOS siempre se ejecutan

AFTER (with conditions / con condiciones):
  step: {
    id: "check_id",
    next: [
      { stepId: "sign",              when: "output.id_valid == true"  },
      { stepId: "full_verification", when: "output.id_valid == false" }
    ]
  }
  // Only ONE executes based on the condition
  // Solo UNO se ejecuta basado en la condicion
```

---

## How It Works in the Orchestrator / Como funciona en el orquestador

```
1. Step "check_id" completes with output: { id_valid: true }
   Paso "check_id" completa con output: { id_valid: true }

2. Orchestrator looks at its "next" edges
   El orquestador mira sus aristas "next"

3. Evaluates each condition:
   Evalua cada condicion:
     "output.id_valid == true"  → TRUE  → "sign" is ACTIVATED
     "output.id_valid == false" → FALSE → "full_verification" is SKIPPED

4. Only activated steps become eligible to run
   Solo los pasos activados se vuelven elegibles para ejecutar

5. Skipped steps are marked as "SKIPPED" (new status!)
   Pasos saltados se marcan como "SKIPPED" (nuevo estado!)
```

---

## The Diamond Pattern with Conditions / El patron diamante con condiciones

The interviewer mentioned a diamond workflow. Here's how conditions work with diamonds:

El entrevistador menciono un workflow diamante. Asi funcionan las condiciones con diamantes:

```
SIMPLE DIAMOND (no conditions, what your engine already does):
DIAMANTE SIMPLE (sin condiciones, lo que tu motor ya hace):

        A
       / \
      B   C        ← both B and C always run in parallel
       \ /           ambos B y C siempre corren en paralelo
        D          ← D waits for BOTH B and C
                     D espera a AMBOS B y C

CONDITIONAL DIAMOND:
DIAMANTE CONDICIONAL:

        A
       / \
      B   C        ← only one runs, based on A's output
       \ /           solo uno corre, basado en el output de A
        D          ← D waits for whichever branch was ACTIVATED
                     D espera a la rama que fue ACTIVADA
```

**The challenge with conditional diamonds / El reto con diamantes condicionales:**

D depends on B and C, but only ONE of them ran. How does D know it's ready?

D depende de B y C, pero solo UNO corrio. Como sabe D que esta listo?

**Solution:** D is ready when all its ACTIVATED dependencies are COMPLETED. Skipped dependencies don't count.

**Solucion:** D esta listo cuando todas sus dependencias ACTIVADAS estan COMPLETADAS. Dependencias saltadas no cuentan.

```
Modified ready check / Verificacion de listo modificada:

BEFORE: step is ready if ALL dependencies are COMPLETED
ANTES:  paso esta listo si TODAS las dependencias estan COMPLETED

AFTER:  step is ready if all dependencies are either COMPLETED or SKIPPED
DESPUES: paso esta listo si todas las dependencias estan COMPLETED o SKIPPED
```

---

## New Step Status: SKIPPED / Nuevo estado: SKIPPED

Your current engine has: WAITING, RUNNING, COMPLETED, FAILED

Tu motor actual tiene: WAITING, RUNNING, COMPLETED, FAILED

Add: **SKIPPED** — the step was not needed because its condition was false.

Agregar: **SKIPPED** — el paso no fue necesario porque su condicion fue falsa.

```
State transitions / Transiciones de estado:

  WAITING → RUNNING → COMPLETED
                    → FAILED
  WAITING → SKIPPED (condition was false / condicion fue falsa)
```

---

## Real IDnow Example / Ejemplo real de IDnow

Different countries require different verification methods:

Diferentes paises requieren diferentes metodos de verificacion:

```yaml
workflow: identity_verification
steps:
  - id: document_capture
    next:
      - stepId: ocr
        when: "always"

  - id: ocr
    next:
      - stepId: video_ident
        when: "input.country in ['DE', 'AT'] AND ocr.confidence < 0.8"
      - stepId: auto_ident
        when: "input.country in ['DE', 'AT'] AND ocr.confidence >= 0.8"
      - stepId: eid_check
        when: "input.country in ['FR', 'ES']"

  - id: video_ident    # agent-assisted video call
    next: [decision]

  - id: auto_ident     # fully automated
    next: [decision]

  - id: eid_check      # electronic ID
    next: [decision]

  - id: decision
    # waits for whichever verification method was activated
```

---

## What to Propose / Que proponer

**"The basic engine runs a fixed DAG. To support real verification flows, we need conditional edges — where the next step depends on the previous step's output. I'd extend the `next` field from a simple array of step IDs to an array of objects with a `stepId` and a `when` condition. The orchestrator evaluates conditions after each step completes, activating or skipping downstream steps. For the dependency check, a step is ready when all its active dependencies are COMPLETED and all inactive ones are SKIPPED."**

**"El motor basico ejecuta un DAG fijo. Para soportar flujos de verificacion reales, necesitamos aristas condicionales — donde el siguiente paso depende del output del paso anterior. Extenderia el campo `next` de un array simple de IDs a un array de objetos con `stepId` y una condicion `when`. El orquestador evalua condiciones despues de que cada paso completa, activando o saltando pasos posteriores. Para la verificacion de dependencias, un paso esta listo cuando todas sus dependencias activas estan COMPLETED y las inactivas estan SKIPPED."**

---

## Interview Question to Expect / Pregunta que esperar

**"How would you handle different verification flows for different countries?"**

**Your answer:** "Two levels. First, different workflow definitions per product or region — Germany might use a different DAG than France. Second, conditional branching within a workflow — based on OCR confidence, the flow might take the automated path or route to video verification. The orchestrator supports both: it selects the right workflow definition at creation time, and evaluates conditions at runtime as steps complete."

"Dos niveles. Primero, diferentes definiciones de workflow por producto o region — Alemania podria usar un DAG diferente que Francia. Segundo, ramas condicionales dentro de un workflow — basado en la confianza del OCR, el flujo podria tomar el camino automatizado o dirigirse a verificacion por video. El orquestador soporta ambos: selecciona la definicion correcta del workflow al crearlo, y evalua condiciones en tiempo de ejecucion a medida que los pasos completan."
