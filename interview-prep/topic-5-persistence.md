# Topic 5: Persistence & Recovery / Persistencia y Recuperacion

## The Problem / El problema

Your current engine keeps everything in memory. If the process crashes, all running workflows are lost.

Tu motor actual mantiene todo en memoria. Si el proceso se cae, todos los workflows en ejecucion se pierden.

```
Workflow running in memory:
  Step 1: COMPLETED
  Step 2: COMPLETED
  Step 3: RUNNING...
                        CRASH

After restart:
  ??? Everything is gone / Todo se perdio
```

---

## The Solution: Persist After Each Step / La solucion: Persistir despues de cada paso

```
Workflow running:
  Step 1: COMPLETED  → save to DB / guardar en BD
  Step 2: COMPLETED  → save to DB / guardar en BD
  Step 3: RUNNING...
                        CRASH

After restart / Despues de reiniciar:
  Load from DB / Cargar desde BD:
    Step 1: COMPLETED (with outputs / con outputs)
    Step 2: COMPLETED (with outputs / con outputs)
    Step 3: WAITING   (re-run this one / re-ejecutar este)

  Resume from Step 3!
  Retomar desde el Paso 3!
```

---

## Database Schema / Esquema de base de datos

Two main tables / Dos tablas principales:

```sql
-- The workflow instance (one per verification)
-- La instancia del workflow (una por verificacion)
workflow_instances:
  id              UUID        -- "abc-123"
  definition_id   TEXT        -- "identity_verification_v2"
  status          TEXT        -- "RUNNING", "COMPLETED", "FAILED"
  context_data    JSONB       -- the WorkflowContext (inputs, step outputs)
  created_at      TIMESTAMP
  updated_at      TIMESTAMP

-- Each step execution (one per step per workflow)
-- Cada ejecucion de paso (una por paso por workflow)
step_executions:
  id              UUID
  workflow_id     UUID        -- FK to workflow_instances
  step_id         TEXT        -- "ocr", "face_match", etc.
  status          TEXT        -- "WAITING", "RUNNING", "COMPLETED", "FAILED"
  inputs          JSONB       -- what was sent to the service
  outputs         JSONB       -- what the service returned
  error           TEXT        -- error message if failed
  attempt_number  INT         -- which retry attempt (1, 2, 3...)
  start_clock     INT         -- from your logical clock
  finished_clock  INT
  started_at      TIMESTAMP
  finished_at     TIMESTAMP
```

---

## Why PostgreSQL / Por que PostgreSQL

| Reason / Razon | Explanation / Explicacion |
|---|---|
| ACID transactions | Each step completion is atomic — never a half-written state / Cada paso es atomico — nunca un estado a medias |
| JSONB columns | Flexible step inputs/outputs without rigid schemas / Inputs/outputs flexibles sin esquemas rigidos |
| Mature & reliable | Battle-tested, huge community / Probado en batalla, gran comunidad |
| Good enough for scale | Identity verification is not millions/second / Verificacion de identidad no es millones por segundo |
| Greenfield project | No existing DB to integrate with / No hay BD existente con la que integrar |

**Don't propose exotic databases unless they ask.** PostgreSQL is the safe, correct answer for this use case.

**No propongas bases de datos exoticas a menos que pregunten.** PostgreSQL es la respuesta correcta para este caso.

---

## Event Sourcing / Event Sourcing

Instead of updating rows, append events. Each state change is a new row.

En vez de actualizar filas, agregar eventos. Cada cambio de estado es una nueva fila.

```sql
workflow_events:
  id              UUID
  workflow_id     UUID
  event_type      TEXT        -- "STEP_STARTED", "STEP_COMPLETED", "STEP_FAILED"
  step_id         TEXT
  payload         JSONB       -- outputs, error, etc.
  clock           INT
  created_at      TIMESTAMP

-- Example events for one workflow:
-- Eventos ejemplo para un workflow:
INSERT: { event: "WORKFLOW_CREATED", workflow_id: "abc" }
INSERT: { event: "STEP_STARTED",    step: "ocr",        clock: 0 }
INSERT: { event: "STEP_STARTED",    step: "liveness",   clock: 0 }
INSERT: { event: "STEP_COMPLETED",  step: "ocr",        clock: 1, outputs: {...} }
INSERT: { event: "STEP_COMPLETED",  step: "liveness",   clock: 1, outputs: {...} }
INSERT: { event: "STEP_STARTED",    step: "face_match", clock: 2 }
...
```

**Why this matters for IDnow / Por que importa para IDnow:**

1. **Audit trail for free** — regulators can see exactly what happened, when, and why. You never delete or modify history.
   **Pista de auditoria gratis** — los reguladores pueden ver exactamente que paso, cuando, y por que. Nunca borras ni modificas historial.

2. **Debugging** — when a verification goes wrong, replay the events to understand what happened.
   **Depuracion** — cuando una verificacion sale mal, reproduce los eventos para entender que paso.

3. **Recovery** — rebuild workflow state by replaying events.
   **Recuperacion** — reconstruir el estado reproduciendo eventos.

---

## Simple vs Event Sourced — What to Propose / Que proponer

**"For v1, I'd use simple CRUD — update the step_executions table after each step completes. It's simpler to implement and query. But I'd also insert into an events table for audit. This gives us the audit trail immediately without the full complexity of event sourcing."**

**"Para v1, usaria CRUD simple — actualizar la tabla step_executions despues de cada paso. Es mas simple de implementar y consultar. Pero tambien insertaria en una tabla de eventos para auditoria. Esto nos da la pista de auditoria inmediatamente sin la complejidad completa de event sourcing."**

---

## Interview Question to Expect / Pregunta que esperar

**"If the system crashes mid-verification, what happens?"**

**Your answer:** "After each step completes, we persist the result and outputs to the database in a transaction. On crash recovery, we load incomplete workflows, check which steps have completed, and resume from where we left off. Since steps are idempotent, re-running a step that might have partially executed is safe. The logical clock values help us maintain ordering guarantees across the recovery."

"Despues de que cada paso completa, persistimos el resultado y outputs a la base de datos en una transaccion. Al recuperarnos de un fallo, cargamos workflows incompletos, verificamos que pasos se completaron, y retomamos desde donde quedamos. Como los pasos son idempotentes, re-ejecutar un paso que podria haberse ejecutado parcialmente es seguro. Los valores del reloj logico nos ayudan a mantener garantias de ordenamiento durante la recuperacion."
