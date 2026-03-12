# IDnow System Design Interview Prep

## What You Built / Lo que construiste

A basic **orchestration engine** in TypeScript that:
- Runs steps in a DAG (directed acyclic graph)
- Resolves dependencies (step B waits for step A)
- Runs independent steps in parallel
- Tracks state with a logical clock
- Handles failures (failed steps block downstream steps)

**En simple:** Un motor que ejecuta pasos en orden, respetando dependencias. Si A debe terminar antes que B, el motor se asegura de eso. Si A y C son independientes, corren al mismo tiempo.

---

## What They Want / Lo que quieren

Take that basic engine and design a **full product** for identity verification.

**En simple:** Tu motor basico sabe ejecutar pasos en orden. Ahora: como lo conviertes en un sistema real que verifica la identidad de una persona (como cuando abres una cuenta en Revolut)?

---

## The Three Actors / Los tres actores

```
SIGNER              CUSTOMER              IDnow
(end user)          (business)            (your system)
Persona que         Empresa que           La plataforma
quiere verificar    necesita verificar    que orquesta
su identidad        al usuario            todo el proceso

Example/Ejemplo:
Una persona          Revolut               IDnow
abriendo una                               coordina OCR,
cuenta bancaria                            face match, etc.
```

**Key insight / Punto clave:** IDnow sits in the MIDDLE. Customers call your API, your orchestrator coordinates external services, and returns results to the customer.

IDnow esta EN EL MEDIO. Los clientes llaman tu API, tu orquestador coordina servicios externos, y devuelve resultados al cliente.

---

## The Verification Flow / El flujo de verificacion

```
Customer (Revolut) calls IDnow API
         |
         v
   [Create Workflow Instance]
   Store user data, select flow based on doc_type + country
         |
         v
   User captures documents + selfie via SDK
         |
         v
   ====== ORCHESTRATION BEGINS ======
         |
    -----+-----
    |         |
    v         v
  [OCR]    [Liveness]        <-- PARALLEL (no dependencies)
    |         |
    |--+------|
    |  |
    v  v
  [Face Match]  [Sanctions]  <-- PARALLEL (both have deps ready)
    |              |
    |------+-------|
           |
           v
      [DECISION]             <-- Aggregates ALL outputs
           |
           v
   Return result to Customer
   ============================
```

**En simple:** El orquestador recibe imagenes del usuario, las manda a servicios externos (OCR, liveness, face match, sanciones) en el orden correcto, recoge los resultados, y toma una decision final.

---

## The DAG Your Engine Runs / El DAG que ejecuta tu motor

```
Clock tick 0:  OCR + Liveness          (parallel, sin dependencias)
Clock tick 1:  Face Match + Sanctions   (parallel, dependencias listas)
Clock tick 2:  Decision                 (espera TODOS los anteriores)
```

This maps directly to your existing engine! The basic `executeWorkflow` already handles this topology. The interview is about everything AROUND this: data flow, persistence, failures, etc.

Esto se mapea directamente a tu motor existente! El basico `executeWorkflow` ya maneja esta topologia. La entrevista es sobre todo lo que RODEA esto.

---

## Topics / Temas

Each topic has its own file with detailed explanation in both languages:

| # | Topic / Tema | File | Priority |
|---|---|---|---|
| 1 | [Data Flow Between Steps / Flujo de datos entre pasos](./topic-1-data-flow.md) | HIGH |
| 2 | [Calling External Services / Llamando servicios externos](./topic-2-external-services.md) | HIGH |
| 3 | [The Decision Step / El paso de decision](./topic-3-decision.md) | HIGH |
| 4 | [Failure & Retry / Fallos y reintentos](./topic-4-failure-retry.md) | MEDIUM |
| 5 | [Persistence & Recovery / Persistencia y recuperacion](./topic-5-persistence.md) | MEDIUM |
| 6 | [Conditional Branching / Ramas condicionales](./topic-6-conditional-branching.md) | MEDIUM |
| 7 | [Proposals to Other Teams / Propuestas a otros equipos](./topic-7-proposals.md) | MEDIUM |
| 8 | [Observability / Observabilidad](./topic-8-observability.md) | LOWER |

---

## Whiteboard Plan / Plan para la pizarra

```
Min  0-5    Ask problem questions
            Hacer preguntas sobre el problema

Min  5-10   Draw the 3 actors + sequence diagram
            Dibujar los 3 actores + diagrama de secuencia

Min 10-15   Zoom into IDnow box -> draw the DAG
            Acercarse a la caja de IDnow -> dibujar el DAG

Min 15-25   Orchestrator internals: context, executor, state store
            Internos del orquestador: contexto, ejecutor, almacen de estado

Min 25-35   Data flow + decision step
            Flujo de datos + paso de decision

Min 35-45   Failures, retries, persistence
            Fallos, reintentos, persistencia

Min 45-55   Proposals to teams, conditional branching, observability
            Propuestas a equipos, ramas condicionales, observabilidad

Min 55-60   Summarize, ask what they'd prioritize
            Resumir, preguntar que priorizarian
```

---

## Questions to Ask First / Preguntas para hacer primero

Before drawing ANYTHING, ask:

1. "Can you walk me through what happens today when a user verifies their identity?"
   *"Pueden explicarme que pasa hoy cuando un usuario verifica su identidad?"*

2. "What's broken or missing that made you decide to build this?"
   *"Que esta roto o falta que los llevo a decidir construir esto?"*

3. "Who triggers a verification — the end user, a backend service, or an ops person?"
   *"Quien inicia una verificacion — el usuario, un servicio backend, o alguien de operaciones?"*

4. "Do any steps require human involvement, like manual review?"
   *"Alguno de los pasos requiere intervencion humana, como revision manual?"*

5. "If the system crashes mid-verification, do we need to resume from the last step?"
   *"Si el sistema se cae a mitad de verificacion, necesitamos retomar desde el ultimo paso?"*

---

## The Diamond Pattern (they mentioned this!) / El patron diamante (ellos lo mencionaron!)

The interviewer specifically said there's a diamond workflow. This is already in your engine's tests. Here's why it matters for identity verification:

El entrevistador especificamente dijo que hay un workflow diamante. Esto ya esta en los tests de tu motor. Aqui esta por que importa para verificacion de identidad:

```
        [OCR]─────────────────[Sanctions]
        /    \                     |
       /      \                    |
 [Start]      [Face Match]────[Decision]
       \      /                    |
        \    /                     |
       [Liveness]─────────────────/

Diamond 1: OCR + Liveness → Face Match
  Face Match NEEDS outputs from BOTH OCR (face crop) and Liveness (selfie frame)
  Face Match NECESITA outputs de AMBOS OCR (recorte facial) y Liveness (frame del selfie)

Diamond 2: Face Match + Sanctions → Decision
  Decision NEEDS outputs from ALL previous steps
  Decision NECESITA outputs de TODOS los pasos anteriores
```

**This is a DOUBLE diamond** — two fan-out/fan-in patterns chained together. Your engine already handles this topology. The challenge is passing data correctly through the diamonds.

**Es un DOBLE diamante** — dos patrones fan-out/fan-in encadenados. Tu motor ya maneja esta topologia. El reto es pasar datos correctamente a traves de los diamantes.

**What makes diamonds tricky / Que hace los diamantes complicados:**
1. The join point (Face Match) must wait for ALL branches, not just the first one
   El punto de union (Face Match) debe esperar TODAS las ramas, no solo la primera
2. With conditional branching, the join point must know which branches were SKIPPED vs still RUNNING
   Con ramas condicionales, el punto de union debe saber cuales ramas fueron SALTADAS vs aun CORRIENDO
3. Data from BOTH branches feeds into the join point
   Datos de AMBAS ramas alimentan el punto de union

---

## What IDnow Does (context for your interview) / Que hace IDnow (contexto para tu entrevista)

IDnow is an identity verification platform based in Munich, Germany. They provide:

IDnow es una plataforma de verificacion de identidad con base en Munich, Alemania. Proveen:

- **AutoIdent** — fully automated identity verification (no humans)
  Verificacion de identidad completamente automatizada (sin humanos)

- **VideoIdent** — video call with a trained agent who verifies your ID live
  Videollamada con un agente entrenado que verifica tu ID en vivo

- **eSign / InstantSign** — electronic document signing with identity check
  Firma electronica de documentos con verificacion de identidad

- **eID** — verification using the chip in European ID cards
  Verificacion usando el chip en tarjetas de identidad europeas

**Their customers:** Banks (Revolut, N26), insurance companies, telecoms, crypto exchanges — anyone who needs to verify a user's identity remotely (KYC - Know Your Customer).

**Sus clientes:** Bancos (Revolut, N26), companias de seguros, telecomunicaciones, exchanges de crypto — cualquiera que necesite verificar la identidad de un usuario remotamente (KYC - Conoce a Tu Cliente).

**Regulatory context:** European Anti-Money Laundering (AML) directives require identity verification. This means AUDIT TRAILS are not optional — they're legally required.

**Contexto regulatorio:** Las directivas europeas contra el lavado de dinero (AML) requieren verificacion de identidad. Esto significa que las PISTAS DE AUDITORIA no son opcionales — son legalmente requeridas.

---

## Senior Engineer Expectations / Expectativas para ingeniero senior

As a senior, they expect you to:

Como senior, esperan que:

1. **Lead the conversation** — don't wait for them to tell you what to design next
   **Lideres la conversacion** — no esperes a que te digan que disenar

2. **Make trade-offs explicit** — "We could do X or Y. X is simpler but doesn't scale. Y handles more cases but adds complexity. For v1, I'd pick X because..."
   **Hagas los trade-offs explicitos** — "Podriamos hacer X o Y. X es mas simple pero no escala. Y maneja mas casos pero agrega complejidad. Para v1, elegiria X porque..."

3. **Think about other teams** — you're not coding alone, you're designing a system that multiple teams interact with
   **Pienses en otros equipos** — no estas programando solo, estas disenando un sistema con el que multiples equipos interactuan

4. **Ask the right questions** — don't assume requirements, clarify them
   **Hagas las preguntas correctas** — no asumas requisitos, clarifica

5. **Know when to stop** — don't over-engineer. "For v1, we don't need this. Here's when we would."
   **Sepas cuando parar** — no sobre-ingenieries. "Para v1, no necesitamos esto. Aqui es cuando lo necesitariamos."
