# Topic 4: Failure & Retry / Fallos y Reintentos

## The Problem / El problema

In the real world, external services fail. Networks time out. APIs return errors.

En el mundo real, los servicios externos fallan. Las redes se agotan. Las APIs devuelven errores.

Your current engine handles failure simply: step fails → downstream steps stay WAITING. That's it. No retries, no recovery.

Tu motor actual maneja fallos de forma simple: paso falla → pasos siguientes quedan en WAITING. Eso es todo. Sin reintentos, sin recuperacion.

---

## Types of Failures / Tipos de fallos

```
TRANSIENT (temporary, might work if you try again)
TRANSITORIOS (temporales, podrian funcionar si intentas de nuevo)
  - Network timeout / Timeout de red
  - Service returns 503 (temporarily unavailable) / Servicio devuelve 503
  - Rate limited (too many requests) / Limite de tasa (demasiadas peticiones)
  → STRATEGY: Retry / ESTRATEGIA: Reintentar

PERMANENT (won't work no matter how many times you try)
PERMANENTES (no funcionara sin importar cuantas veces intentes)
  - Document image is blank / La imagen del documento esta en blanco
  - Invalid document type / Tipo de documento invalido
  - Service returns 400 (bad request) / Servicio devuelve 400
  → STRATEGY: Fail the step / ESTRATEGIA: Fallar el paso

DEGRADED (service is down for a while)
DEGRADADOS (servicio esta caido por un tiempo)
  - Sanctions API is completely down / API de sanciones esta completamente caida
  - Third-party vendor having an outage / Proveedor externo con una interrupcion
  → STRATEGY: Circuit breaker / ESTRATEGIA: Circuit breaker
```

---

## Retry with Exponential Backoff / Reintento con backoff exponencial

Don't retry immediately — wait longer each time. This gives the service time to recover.

No reintentes inmediatamente — espera mas cada vez. Esto le da tiempo al servicio para recuperarse.

```
Attempt 1: Call OCR service → FAILS (timeout)
  Wait 1 second / Esperar 1 segundo

Attempt 2: Call OCR service → FAILS (timeout)
  Wait 2 seconds / Esperar 2 segundos

Attempt 3: Call OCR service → FAILS (timeout)
  Wait 4 seconds / Esperar 4 segundos

Attempt 4: Call OCR service → SUCCESS!

If all retries exhausted → mark step as FAILED
Si se agotan todos los reintentos → marcar paso como FAILED
```

The pattern: `wait = baseDelay * 2^attempt`

```
Config per step / Configuracion por paso:
  ocr:
    maxRetries: 3
    baseDelay: 1000ms
    maxDelay: 10000ms
    retryableErrors: [503, 504, "TIMEOUT"]
```

---

## Circuit Breaker Pattern / Patron Circuit Breaker

If a service keeps failing, stop calling it. Like a fuse in your house — it breaks to protect the system.

Si un servicio sigue fallando, deja de llamarlo. Como un fusible en tu casa — se rompe para proteger el sistema.

```
CLOSED (normal)           OPEN (broken)           HALF-OPEN (testing)
  Calls go through         Calls fail immediately    One test call allowed
  Las llamadas pasan       Llamadas fallan al        Una llamada de prueba
                           instante
       |                        |                         |
  Too many failures ──>    After timeout ──>         If test succeeds ──> CLOSED
  Muchos fallos            Despues de timeout        Si prueba tiene exito
       |                        |                         |
       └── OPEN                 └── HALF-OPEN             └── back to normal
```

**When to mention this:** Only if the interviewer asks about cascading failures or service outages. Don't volunteer it early — it's an advanced topic.

**Cuando mencionarlo:** Solo si el entrevistador pregunta sobre fallos en cascada o interrupciones de servicio. No lo ofrezcas temprano — es un tema avanzado.

---

## Per-Step Failure Strategy / Estrategia de fallos por paso

Not all steps should fail the same way:

No todos los pasos deben fallar de la misma manera:

```
Step: OCR
  On failure: FAIL WORKFLOW
  Why: Without OCR data, nothing else can work
  Por que: Sin datos de OCR, nada mas puede funcionar

Step: Liveness
  On failure: FAIL WORKFLOW
  Why: Core security requirement
  Por que: Requisito de seguridad fundamental

Step: Face Match
  On failure: MANUAL_REVIEW
  Why: A human can compare visually
  Por que: Un humano puede comparar visualmente

Step: Sanctions Check
  On failure: MANUAL_REVIEW (with flag)
  Why: Can't skip compliance, but can do it later
  Por que: No puedes saltarte cumplimiento, pero puedes hacerlo despues

Step: Decision
  On failure: FAIL WORKFLOW (this is a bug, should never fail)
  Why: Business logic errors are bugs
  Por que: Errores de logica de negocio son bugs
```

---

## Idempotency / Idempotencia

**Simple explanation / Explicacion simple:** Calling a step twice with the same inputs should give the same result and not cause problems.

Llamar a un paso dos veces con los mismos inputs debe dar el mismo resultado y no causar problemas.

```
IDEMPOTENT (safe to retry):
  "Analyze this document image" → same result every time
  "Check this name against sanctions list" → same result every time

NOT IDEMPOTENT (dangerous to retry):
  "Charge the customer $10" → retrying charges them $20!
  "Send verification email" → retrying sends 3 emails!
```

For identity verification, most steps ARE naturally idempotent (they're reading/analyzing, not writing/acting). But mention it as a design principle.

Para verificacion de identidad, la mayoria de los pasos SON naturalmente idempotentes (leen/analizan, no escriben/actuan). Pero mencionalo como principio de diseno.

---

## Interview Question to Expect / Pregunta que esperar

**"What if the sanctions check service is down?"**

**Your answer:** "It depends on the business requirement. Option A: retry with exponential backoff, and if all retries fail, fail the workflow — the user tries again later. Option B: mark the step as 'degraded', skip it, and route to manual review with a flag that says 'sanctions check incomplete'. I'd ask the compliance team which is acceptable. For a first iteration, I'd go with Option A — retry and fail. It's safer and simpler. We can add graceful degradation later when we understand the business rules better."

"Depende del requisito de negocio. Opcion A: reintentar con backoff exponencial, y si se agotan los reintentos, fallar el workflow — el usuario intenta de nuevo despues. Opcion B: marcar el paso como 'degradado', saltarlo, y enviar a revision manual con una bandera que dice 'verificacion de sanciones incompleta'. Le preguntaria al equipo de cumplimiento cual es aceptable. Para la primera iteracion, iria con Opcion A — reintentar y fallar. Es mas seguro y simple. Podemos agregar degradacion elegante despues cuando entendamos mejor las reglas de negocio."
