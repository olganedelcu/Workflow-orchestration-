# Topic 7: Proposals to Other Teams / Propuestas a Otros Equipos

## Why This Matters / Por que importa

They told you: "it also involves making proposals to other teams in their existing solution."

Te dijeron: "tambien implica hacer propuestas a otros equipos en su solucion existente."

You're not just designing the orchestrator in isolation. You need to define HOW other teams' services integrate with it. This is about **contracts and interfaces**.

No solo estas disenando el orquestador en aislamiento. Necesitas definir COMO los servicios de otros equipos se integran con el. Esto es sobre **contratos e interfaces**.

---

## The Standard Step Interface / La interfaz estandar de pasos

Every external service (OCR, liveness, face match, sanctions) should follow the SAME interface. This makes the orchestrator simple — it doesn't need special code for each service.

Cada servicio externo (OCR, liveness, face match, sanciones) debe seguir la MISMA interfaz. Esto hace al orquestador simple — no necesita codigo especial para cada servicio.

```
REQUEST (what the orchestrator sends):
PETICION (lo que el orquestador envia):

POST /execute
{
  "workflow_id": "abc-123",       // for correlation / para correlacion
  "step_id": "ocr",              // which step / cual paso
  "attempt": 1,                  // retry number / numero de reintento
  "inputs": {                    // resolved from workflow context
    "document_image": "s3://bucket/doc.jpg",
    "country": "DE",
    "document_type": "passport"
  }
}


RESPONSE (what the service returns):
RESPUESTA (lo que el servicio devuelve):

{
  "status": "completed",          // or "failed" / o "failed"
  "outputs": {                    // goes into workflow context
    "name": "Jane Doe",
    "date_of_birth": "1990-01-01",
    "confidence": 0.97,
    "face_crop_uri": "s3://bucket/face.jpg"
  },
  "error": null                   // or error details if failed
}
```

---

## What to Propose to Each Team / Que proponer a cada equipo

### To the OCR Team / Al equipo de OCR

```
"We need your service to:
 1. Accept a document image URI and return extracted fields
 2. Include a confidence score (0-1) for each extracted field
 3. Extract and store the face crop separately (we need it for face matching)
 4. Return structured errors distinguishing retryable vs permanent failures
 5. Be idempotent — same image in = same result out"

"Necesitamos que su servicio:
 1. Acepte una URI de imagen de documento y devuelva campos extraidos
 2. Incluya un puntaje de confianza (0-1) para cada campo extraido
 3. Extraiga y almacene el recorte facial por separado (lo necesitamos para face matching)
 4. Devuelva errores estructurados distinguiendo fallos reintentables vs permanentes
 5. Sea idempotente — misma imagen entrada = mismo resultado salida"
```

### To the Biometrics Team (Liveness + Face Match) / Al equipo de biometria

```
"We need two separate endpoints:
 1. Liveness: accepts selfie/video, returns alive=bool + confidence + best frame URI
 2. Face Match: accepts two face images, returns match_score (0-1)

 Why separate? The orchestrator runs liveness in parallel with OCR.
 Face match runs AFTER both, because it needs outputs from both.
 If they're one service, we lose that parallelism."

"Necesitamos dos endpoints separados:
 1. Liveness: acepta selfie/video, devuelve alive=bool + confianza + URI de mejor frame
 2. Face Match: acepta dos imagenes de rostro, devuelve match_score (0-1)

 Por que separados? El orquestador ejecuta liveness en paralelo con OCR.
 Face match se ejecuta DESPUES de ambos, porque necesita outputs de ambos.
 Si son un servicio, perdemos ese paralelismo."
```

### To the Compliance Team (Sanctions) / Al equipo de cumplimiento

```
"We need your service to:
 1. Accept name + date of birth + nationality
 2. Return hit=bool + match details (which list, what entry)
 3. Support async: if the check takes >5s, return 202 and callback
 4. Include a 'requires_manual_review' flag for fuzzy matches"

"Necesitamos que su servicio:
 1. Acepte nombre + fecha de nacimiento + nacionalidad
 2. Devuelva hit=bool + detalles del match (cual lista, cual entrada)
 3. Soporte asincrono: si la verificacion toma >5s, devolver 202 y callback
 4. Incluya una bandera 'requires_manual_review' para matches difusos"
```

---

## Error Contract / Contrato de errores

This is often forgotten but CRITICAL. Every service should return errors in the same format.

Esto se olvida frecuentemente pero es CRITICO. Cada servicio debe devolver errores en el mismo formato.

```json
{
  "status": "failed",
  "error": {
    "code": "DOCUMENT_UNREADABLE",
    "message": "Could not extract text from document image",
    "retryable": false,
    "category": "permanent"
  }
}
```

```
Error categories / Categorias de error:

  "transient"   → orchestrator should retry
                  el orquestador debe reintentar
                  Examples: timeout, 503, rate limited

  "permanent"   → don't retry, step has failed
                  no reintentar, el paso ha fallado
                  Examples: bad image, invalid document type

  "degraded"    → service partially worked, results may be incomplete
                  el servicio funciono parcialmente, resultados incompletos
                  Examples: OCR extracted name but not DOB
```

**Why this matters / Por que importa:** Without a standard error contract, the orchestrator needs custom error handling for each service. With it, the retry logic is generic.

Sin un contrato estandar de errores, el orquestador necesita manejo de errores personalizado para cada servicio. Con el, la logica de reintento es generica.

---

## Service Registry / Registro de servicios

The orchestrator needs to know WHERE each service lives and HOW to call it.

El orquestador necesita saber DONDE vive cada servicio y COMO llamarlo.

```yaml
services:
  ocr:
    url: "https://ocr-service.internal/execute"
    timeout: 15s
    retries: 3
    auth: "service-account-ocr"

  liveness:
    url: "https://biometric-service.internal/liveness"
    timeout: 10s
    retries: 2
    auth: "service-account-bio"

  face_match:
    url: "https://biometric-service.internal/face-match"
    timeout: 20s
    retries: 2
    auth: "service-account-bio"

  sanctions:
    url: "https://compliance-service.internal/check"
    timeout: 30s
    retries: 5
    auth: "service-account-compliance"
```

---

## Monorepo Angle / Angulo del monorepo

They mentioned a monorepo. Propose a package structure:

Mencionaron un monorepo. Propone una estructura de paquetes:

```
packages/
  workflow-engine/          ← the core DAG executor (what you built)
                              el ejecutor DAG basico (lo que construiste)

  workflow-api/             ← REST API for customers to create/query workflows
                              API REST para que clientes creen/consulten workflows

  workflow-persistence/     ← database layer (save/load workflow state)
                              capa de base de datos (guardar/cargar estado)

  workflow-dashboard/       ← ops UI for monitoring
                              UI de operaciones para monitoreo

  step-contracts/           ← shared TypeScript types for the step interface
                              tipos TypeScript compartidos para la interfaz de pasos
                              (OTHER teams import this package)
                              (OTROS equipos importan este paquete)

  decision-engine/          ← the business logic for decisions
                              la logica de negocio para decisiones
```

**Key insight / Punto clave:** The `step-contracts` package is shared with other teams. It defines the request/response types. When you change the contract, everyone updates together because it's a monorepo — no version mismatch issues.

El paquete `step-contracts` se comparte con otros equipos. Define los tipos de peticion/respuesta. Cuando cambias el contrato, todos actualizan juntos porque es un monorepo — sin problemas de versiones.

---

## Interview Question to Expect / Pregunta que esperar

**"How would you ensure other teams' services integrate cleanly with the orchestrator?"**

**Your answer:** "I'd define a standard step interface — a shared contract that every service must follow. Request: workflow ID, step ID, inputs. Response: status, outputs, structured error. The contract lives in a shared package in the monorepo. This means the orchestrator doesn't need service-specific code. The retry logic, timeout handling, and data passing are all generic. If a new service doesn't follow the contract, it's a conversation, not a code change in the orchestrator."

**Tu respuesta:** "Definiria una interfaz estandar de pasos — un contrato compartido que todo servicio debe seguir. Peticion: workflow ID, step ID, inputs. Respuesta: status, outputs, error estructurado. El contrato vive en un paquete compartido en el monorepo. Esto significa que el orquestador no necesita codigo especifico por servicio. La logica de reintento, manejo de timeouts, y paso de datos son todos genericos. Si un nuevo servicio no sigue el contrato, es una conversacion, no un cambio de codigo en el orquestador."
