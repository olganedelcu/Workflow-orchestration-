# Topic 8: Observability / Observabilidad

## Why It Matters / Por que importa

When a verification fails or is slow, someone needs to figure out WHY. Without observability, you're guessing.

Cuando una verificacion falla o es lenta, alguien necesita averiguar POR QUE. Sin observabilidad, estas adivinando.

This is a LOWER priority topic for the interview — only bring it up if you have time or they ask. But it shows maturity.

Este es un tema de MENOR prioridad para la entrevista — solo mencionalo si tienes tiempo o preguntan. Pero muestra madurez.

---

## Three Pillars / Tres pilares

```
LOGS            METRICS           TRACES
What happened   How much/fast     The journey of
Que paso        Cuanto/que tan    one request
                rapido            El viaje de
                                  una peticion
```

---

## 1. Logs / Registros

Every state transition gets logged with a correlation ID.

Cada transicion de estado se registra con un ID de correlacion.

```json
{ "workflow_id": "abc-123", "step": "ocr",        "event": "STEP_STARTED",   "clock": 0, "timestamp": "..." }
{ "workflow_id": "abc-123", "step": "liveness",    "event": "STEP_STARTED",   "clock": 0, "timestamp": "..." }
{ "workflow_id": "abc-123", "step": "ocr",        "event": "STEP_COMPLETED", "clock": 1, "duration_ms": 2340 }
{ "workflow_id": "abc-123", "step": "liveness",    "event": "STEP_COMPLETED", "clock": 1, "duration_ms": 890 }
{ "workflow_id": "abc-123", "step": "face_match",  "event": "STEP_STARTED",   "clock": 2 }
{ "workflow_id": "abc-123", "step": "face_match",  "event": "STEP_COMPLETED", "clock": 3, "duration_ms": 1200 }
{ "workflow_id": "abc-123", "step": "sanctions",   "event": "STEP_FAILED",    "clock": 3, "error": "timeout", "attempt": 1 }
{ "workflow_id": "abc-123", "step": "sanctions",   "event": "STEP_STARTED",   "clock": 3, "attempt": 2 }
```

**Key: the workflow_id travels with every log line.** You can filter all logs for one verification.

**Clave: el workflow_id viaja con cada linea de log.** Puedes filtrar todos los logs para una verificacion.

---

## 2. Metrics / Metricas

Numbers you track over time / Numeros que rastreas en el tiempo:

```
WORKFLOW LEVEL:
  - workflows_started_total          (counter)
  - workflows_completed_total        (counter, by verdict: approved/rejected/review)
  - workflows_failed_total           (counter)
  - workflow_duration_seconds        (histogram, p50/p95/p99)
  - workflows_active                 (gauge, currently running)

STEP LEVEL:
  - step_duration_seconds            (histogram, by step_type)
  - step_failures_total              (counter, by step_type and error_code)
  - step_retries_total               (counter, by step_type)

BUSINESS LEVEL:
  - verification_approved_total      (counter)
  - verification_rejected_total      (counter, by reason)
  - verification_manual_review_total (counter)
```

**What this tells you / Que te dice esto:**
- "OCR p95 latency jumped from 2s to 8s" → OCR service is degrading
- "sanctions failures up 300%" → vendor might be down
- "manual review rate up 50%" → maybe thresholds need adjusting

---

## 3. Traces / Trazas

A trace shows the full journey of ONE verification:

Una traza muestra el viaje completo de UNA verificacion:

```
Workflow abc-123 [total: 4.2s]
├── ocr          [0ms - 2340ms]    ████████░░░░░░░  completed
├── liveness     [0ms - 890ms]     ███░░░░░░░░░░░░  completed
├── face_match   [2340ms - 3540ms] ░░░░░░░░████░░░  completed (waited for ocr+liveness)
├── sanctions    [2340ms - 3100ms] ░░░░░░░░███░░░░  completed
└── decision     [3540ms - 3620ms] ░░░░░░░░░░░░██░  completed → APPROVED
```

This immediately shows: OCR is the bottleneck (2.3s out of 4.2s total).

Esto muestra inmediatamente: OCR es el cuello de botella (2.3s de 4.2s totales).

---

## Alerting / Alertas

When things go wrong, don't wait for someone to check a dashboard:

Cuando las cosas salen mal, no esperes a que alguien revise un dashboard:

```
ALERT: workflow_duration_p95 > 30s for 5 minutes
  → SLA breach risk / Riesgo de incumplimiento de SLA

ALERT: step_failures_total{step="sanctions"} > 10 in 1 minute
  → Sanctions service might be down / Servicio de sanciones podria estar caido

ALERT: verification_manual_review_rate > 40%
  → Something is off, too many borderline cases / Algo anda mal, demasiados casos limites
```

---

## What to Propose / Que proponer

**"Every workflow gets a correlation ID that propagates to all service calls. We log every state transition with structured JSON. For metrics, I'd start with workflow duration and step failure rate — those are the two most actionable signals. Traces come naturally from the logical clock: we already know when each step started and finished. For a v1, structured logs plus a simple dashboard showing active workflows and failure rates is enough."**

**"Cada workflow recibe un ID de correlacion que se propaga a todas las llamadas de servicio. Registramos cada transicion de estado con JSON estructurado. Para metricas, empezaria con duracion de workflow y tasa de fallos por paso — esas son las dos senales mas accionables. Las trazas vienen naturalmente del reloj logico: ya sabemos cuando empezo y termino cada paso. Para un v1, logs estructurados mas un dashboard simple mostrando workflows activos y tasas de fallo es suficiente."**

---

## Interview Question to Expect / Pregunta que esperar

**"How would you debug a verification that's stuck or slow?"**

**Your answer:** "Every workflow has a correlation ID. I'd look up the workflow state in the database — which steps completed, which is currently running, which are still waiting. The step execution records show duration and attempt count. If a step is slow, I check the logs for that step with the correlation ID to see what the external service returned. The logical clock gives me the exact execution timeline. For systematic issues, I'd look at step-level metrics — if OCR p95 jumped, it's likely a service degradation, not a single-workflow problem."

"Cada workflow tiene un ID de correlacion. Buscaria el estado del workflow en la base de datos — que pasos completaron, cual esta ejecutandose, cuales siguen esperando. Los registros de ejecucion de pasos muestran duracion y numero de intentos. Si un paso es lento, reviso los logs de ese paso con el ID de correlacion para ver que devolvio el servicio externo. El reloj logico me da la linea de tiempo exacta de ejecucion. Para problemas sistematicos, miraria metricas a nivel de paso — si el p95 de OCR subio, probablemente es una degradacion del servicio, no un problema de un solo workflow."
