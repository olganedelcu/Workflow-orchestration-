# Topic 3: The Decision Step / El Paso de Decision

## Why It's Special / Por que es especial

Every other step calls an EXTERNAL service (OCR, face match, sanctions). The decision step is YOURS — it's internal business logic that IDnow owns.

Todos los demas pasos llaman a un servicio EXTERNO. El paso de decision es TUYO — es logica de negocio interna que IDnow controla.

It's the brain of the workflow / Es el cerebro del workflow.

---

## What It Does / Que hace

The decision step:
1. Receives ALL outputs from ALL previous steps
2. Applies business rules
3. Returns a final verdict: APPROVED, REJECTED, or MANUAL_REVIEW

El paso de decision:
1. Recibe TODOS los outputs de TODOS los pasos anteriores
2. Aplica reglas de negocio
3. Devuelve un veredicto final: APROBADO, RECHAZADO, o REVISION_MANUAL

```
INPUTS (from previous steps / de pasos anteriores):
  ocr.confidence:        0.97
  ocr.expiry:            "2028-05-15"
  liveness.alive:        true
  liveness.confidence:   0.95
  face_match.score:      0.92
  sanctions.hit:         false

                    |
                    v

            ┌─────────────┐
            │  DECISION    │
            │  ENGINE      │
            │              │
            │  Apply rules │
            │  in order    │
            └──────┬───────┘
                   |
                   v

OUTPUT:
  verdict: "APPROVED"
  reason:  "All checks passed with high confidence"
```

---

## The Rules / Las reglas

Think of rules as a checklist evaluated top to bottom. First match wins.

Piensa en las reglas como una lista evaluada de arriba a abajo. La primera que coincida gana.

```
RULE 1 (highest priority / maxima prioridad):
  IF sanctions.hit == true
  THEN → REJECTED
  REASON: "Sanctions match found"

RULE 2:
  IF liveness.alive == false
  THEN → REJECTED
  REASON: "Liveness check failed"

RULE 3:
  IF face_match.score < 0.5
  THEN → REJECTED
  REASON: "Face does not match document"

RULE 4:
  IF face_match.score < 0.8
  THEN → MANUAL_REVIEW
  REASON: "Low confidence face match, needs human review"

RULE 5:
  IF ocr.confidence < 0.7
  THEN → MANUAL_REVIEW
  REASON: "Document hard to read, needs human review"

RULE 6:
  IF ocr.expiry < today
  THEN → REJECTED
  REASON: "Document expired"

DEFAULT:
  → APPROVED
  REASON: "All checks passed"
```

---

## Key Design Question: Hardcoded vs Configurable

### Option A: Hardcoded rules in code / Reglas fijas en codigo

```typescript
function decide(outputs: AllStepOutputs): Decision {
  if (outputs.sanctions.hit) return { verdict: "REJECTED", reason: "..." };
  if (!outputs.liveness.alive) return { verdict: "REJECTED", reason: "..." };
  if (outputs.faceMatch.score < 0.5) return { verdict: "REJECTED", reason: "..." };
  // ...
  return { verdict: "APPROVED", reason: "All checks passed" };
}
```

| Pros | Cons |
|---|---|
| Simple, easy to test / Simple, facil de testear | Need code deploy to change rules / Necesitas deploy para cambiar reglas |
| Type-safe / Seguro con tipos | Product team can't change rules themselves / El equipo de producto no puede cambiar reglas |

### Option B: Configurable rules (decision table) / Reglas configurables

```json
{
  "rules": [
    { "condition": "sanctions.hit == true",     "verdict": "REJECTED",       "priority": 1 },
    { "condition": "liveness.alive == false",   "verdict": "REJECTED",       "priority": 2 },
    { "condition": "face_match.score < 0.5",    "verdict": "REJECTED",       "priority": 3 },
    { "condition": "face_match.score < 0.8",    "verdict": "MANUAL_REVIEW",  "priority": 4 },
    { "condition": "ocr.confidence < 0.7",      "verdict": "MANUAL_REVIEW",  "priority": 5 }
  ],
  "default_verdict": "APPROVED"
}
```

| Pros | Cons |
|---|---|
| Change rules without deploying code / Cambiar reglas sin deploy | More complex to implement / Mas complejo de implementar |
| Product/compliance team can adjust thresholds / Equipo de producto puede ajustar umbrales | Need to validate rule syntax / Necesitas validar sintaxis de reglas |
| Different rules per country/customer / Diferentes reglas por pais/cliente | Harder to test all combinations / Mas dificil testear todas las combinaciones |

---

## What to Propose / Que proponer

**"I'd start with hardcoded rules for the first iteration — it's simpler, testable, and we can ship faster. But I'd design the interface so that we can swap in a configurable rules engine later without changing the orchestrator. The orchestrator just calls `decide(allOutputs)` and doesn't care how the decision is made internally."**

**"Empezaria con reglas fijas para la primera iteracion — es mas simple, testeable, y podemos entregar mas rapido. Pero disenaria la interfaz para que podamos cambiar a un motor de reglas configurable despues sin cambiar el orquestador. El orquestador solo llama a `decide(allOutputs)` y no le importa como se toma la decision internamente."**

---

## Important: Not Every Bad Result Is a Failure

**This is a KEY insight / Este es un punto CLAVE:**

```
OCR returns confidence: 0.4    → NOT a step failure
                                  NO es un fallo del paso
                                  It's a low score. Step COMPLETED.
                                  Es un puntaje bajo. Paso COMPLETADO.
                                  The DECISION step handles it.
                                  El paso de DECISION lo maneja.

OCR service returns HTTP 500   → THIS is a step failure
                                  ESTO es un fallo del paso
                                  Retry or fail the workflow.
                                  Reintentar o fallar el workflow.
```

Separate infrastructure failures from bad results. The orchestrator handles infrastructure failures (retries, timeouts). The decision step handles bad results (low scores, borderline cases).

Separa fallos de infraestructura de malos resultados. El orquestador maneja fallos de infraestructura (reintentos, timeouts). El paso de decision maneja malos resultados (puntajes bajos, casos limites).

---

## Interview Question to Expect / Pregunta que esperar

**"How do you handle the business logic for the decision step?"**

**Your answer:** "I'd separate orchestration from decision logic. The orchestrator treats the decision step like any other step — it feeds all previous step outputs as inputs. The decision step itself evaluates rules in priority order. For v1, hardcoded rules. The interface is clean enough that we can swap in a configurable rules engine later — especially important if different customers or countries need different thresholds. The key insight is that a low confidence score from OCR isn't a system failure — the step still completes successfully. It's the decision step's job to interpret what that score means."

"Separaria la orquestacion de la logica de decision. El orquestador trata el paso de decision como cualquier otro paso — le pasa todos los outputs de los pasos anteriores como inputs. El paso de decision evalua reglas en orden de prioridad. Para v1, reglas fijas en codigo. La interfaz es lo suficientemente limpia para que podamos cambiar a un motor de reglas configurable despues — especialmente importante si diferentes clientes o paises necesitan diferentes umbrales. El punto clave es que un puntaje bajo de OCR no es un fallo del sistema — el paso completa exitosamente. Es trabajo del paso de decision interpretar que significa ese puntaje."
