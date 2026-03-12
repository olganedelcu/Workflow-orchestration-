# Topic 2: Calling External Services / Llamando Servicios Externos

## The Problem / El problema

Your current engine calls `simulateStepExecution()` — a fake function that does nothing. In reality, each step is calling a real external service over the network.

Tu motor actual llama a `simulateStepExecution()` — una funcion falsa que no hace nada. En realidad, cada paso llama a un servicio externo real por la red.

The network is unreliable. Services are slow. Things break.

La red no es confiable. Los servicios son lentos. Las cosas se rompen.

---

## Three Patterns / Tres patrones

### Pattern 1: Synchronous HTTP (Simple)

```
Orchestrator                    OCR Service
     |                              |
     |---- POST /analyze ---------->|
     |         (waits...)           |
     |         (waits...)           |
     |<--- 200 OK + results --------|
     |                              |
     |  Now orchestrator continues
```

**How it works / Como funciona:** The orchestrator sends a request and WAITS for the response. Like calling someone on the phone and staying on the line.

El orquestador envia una peticion y ESPERA la respuesta. Como llamar a alguien por telefono y quedarse en la linea.

| Pros | Cons |
|---|---|
| Simple to implement / Simple de implementar | Orchestrator is blocked waiting / El orquestador esta bloqueado esperando |
| Easy to debug / Facil de depurar | If service takes 30s, you wait 30s / Si el servicio tarda 30s, esperas 30s |
| No extra infrastructure / Sin infraestructura extra | Can't handle many concurrent workflows / No maneja muchos workflows concurrentes |

---

### Pattern 2: Async with Callback (Medium complexity)

```
Orchestrator                    OCR Service
     |                              |
     |---- POST /analyze ---------->|
     |<--- 202 Accepted ------------|  (immediate response, just "got it")
     |                              |  (respuesta inmediata, solo "recibido")
     |  (orchestrator is FREE       |
     |   to do other work)          |
     |                              |  (service processes...)
     |                              |
     |<--- POST /callback ---------|  (service calls back when done)
     |     {results}                |  (servicio avisa cuando termina)
```

**How it works / Como funciona:** The orchestrator sends a request and gets an immediate "received" response. The service calls back later. Like sending a text message — you don't wait for a reply.

El orquestador envia una peticion y recibe un "recibido" inmediato. El servicio avisa despues. Como enviar un mensaje de texto — no esperas la respuesta.

| Pros | Cons |
|---|---|
| Orchestrator not blocked / Orquestador no bloqueado | Need to handle "what if callback never comes?" / Que pasa si el callback nunca llega? |
| Handles slow services well / Maneja bien servicios lentos | More complex / Mas complejo |
| Scalable | Need to match callback to workflow / Necesitas emparejar callback con workflow |

---

### Pattern 3: Message Queue (Most decoupled)

```
Orchestrator         Queue              OCR Worker
     |                 |                    |
     |-- publish ----->|                    |
     |  {analyze this} |                    |
     |                 |--- deliver ------->|
     |                 |                    | (processes...)
     |                 |<-- publish result --|
     |<-- consume -----|                    |
     |  {results}      |                    |
```

**How it works / Como funciona:** The orchestrator puts a message on a queue. A worker picks it up, processes it, puts the result on another queue. Like leaving a letter in a mailbox.

El orquestador pone un mensaje en una cola. Un worker lo toma, lo procesa, pone el resultado en otra cola. Como dejar una carta en un buzon.

| Pros | Cons |
|---|---|
| Fully decoupled / Totalmente desacoplado | More infrastructure (need a queue) / Mas infraestructura |
| Built-in retry / Reintento incluido | Harder to debug / Mas dificil de depurar |
| Handles backpressure / Maneja contrapresion | Added latency / Latencia adicional |
| If worker crashes, message stays in queue / Si el worker se cae, el mensaje queda en la cola | |

---

## What to Propose / Que proponer

**For the interview, say this:**

"I'd start with synchronous HTTP with timeouts. It's the simplest approach and good enough for a greenfield project. Each step call looks like: send request, wait up to N seconds, handle response or timeout. If a specific service proves to be slow or unreliable, we can migrate that ONE integration to async without changing the whole system."

**Para la entrevista, di esto:**

"Empezaria con HTTP sincrono con timeouts. Es el enfoque mas simple y suficiente para un proyecto greenfield. Cada llamada a un paso: enviar peticion, esperar hasta N segundos, manejar respuesta o timeout. Si un servicio especifico resulta ser lento o poco confiable, podemos migrar ESA integracion a asincrono sin cambiar todo el sistema."

**Why this is a good answer / Por que es buena respuesta:** It shows you don't over-engineer. You pick the simplest thing that works and evolve when needed. Interviewers love this.

Muestra que no sobre-ingenierias. Eliges lo mas simple que funciona y evolucionas cuando es necesario. A los entrevistadores les encanta esto.

---

## The Step Executor / El ejecutor de pasos

Replace the fake `simulateStepExecution` with a real executor:

```
// What it looks like conceptually
// Como se ve conceptualmente

async function executeStep(
  stepId: string,
  stepType: string,          // "ocr", "liveness", "face_match", etc.
  inputs: Record<string, any>,
  config: StepConfig          // timeout, retries, service URL
): Promise<StepResult> {

  const response = await httpCall(config.serviceUrl, {
    method: "POST",
    body: inputs,
    timeout: config.timeout    // e.g. 10 seconds / ej. 10 segundos
  });

  return {
    status: "completed",
    outputs: response.data      // goes into WorkflowContext.stepOutputs
                                // va al WorkflowContext.stepOutputs
  };
}
```

---

## Timeout Handling / Manejo de timeouts

```
What happens when a service is slow:
Que pasa cuando un servicio es lento:

  Request sent ──────── 10s timeout ──────── ?
                            |
                    ┌───────┴────────┐
                    |                |
              Response arrives    No response
              before timeout      TIMEOUT
                    |                |
                    v                v
               Continue          Retry? Fail?
               Continuar         Reintentar? Fallar?
```

Use `Promise.race` / Usa `Promise.race`:

```
const result = await Promise.race([
  httpCall(serviceUrl, inputs),           // the actual call / la llamada real
  timeout(10000)                          // 10 second bomb / bomba de 10 segundos
]);
// Whichever finishes first wins
// El que termine primero gana
```

---

## Interview Question to Expect / Pregunta que esperar

**"What if the OCR service takes 10 seconds sometimes and 100ms other times?"**

**Your answer:** "I'd use sync HTTP with a generous timeout — say 15 seconds for OCR. The orchestrator already runs independent steps in parallel, so while OCR is slow, Liveness runs at the same time. If OCR consistently exceeds the timeout, I'd add retry logic for that specific step. If the problem persists, that's when I'd consider moving OCR to async with a callback, but only for that one service."

**Tu respuesta:** "Usaria HTTP sincrono con un timeout generoso — digamos 15 segundos para OCR. El orquestador ya ejecuta pasos independientes en paralelo, entonces mientras OCR es lento, Liveness corre al mismo tiempo. Si OCR consistentemente excede el timeout, agregaria logica de reintento para ese paso especifico. Si el problema persiste, ahi consideraria mover OCR a asincrono con callback, pero solo para ese servicio."
