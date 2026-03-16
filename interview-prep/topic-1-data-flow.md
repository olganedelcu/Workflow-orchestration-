# Topic 1: Data Flow Between Steps / Flujo de Datos entre Pasos

## The Problem / El problema

Your current engine runs steps but passes NOTHING between them. In reality:

- OCR extracts a face crop from the document
- Face Match needs that face crop + the selfie from Liveness
- Sanctions Check needs the name + DOB from OCR
- Decision needs ALL outputs from ALL steps

Tu motor actual ejecuta pasos pero NO PASA NADA entre ellos. En realidad cada paso necesita datos de los pasos anteriores.

---

## The Solution: Workflow Context / La solucion: Contexto del Workflow

Think of it as a shared bag/bolsa where each step puts its results, and the next step can reach in and grab what it needs.

Piensalo como una bolsa compartida donde cada paso deja sus resultados, y el siguiente paso puede buscar lo que necesita.

```
WorkflowContext = {
  workflowId: "abc-123",

  // Initial inputs (what the customer sent)
  // Inputs iniciales (lo que mando el cliente)
  inputs: {
    doc_front_uri: "s3://bucket/doc-front.jpg",
    doc_back_uri:  "s3://bucket/doc-back.jpg",
    selfie_uri:    "s3://bucket/selfie.jpg",
    country:       "DE",
    doc_type:      "passport"
  },

  // Each step writes its results here
  // Cada paso escribe sus resultados aqui
  stepOutputs: {
    "ocr": {
      name: "Jane Doe",
      date_of_birth: "1990-01-01",
      document_number: "X1234567",
      expiry: "2028-05-15",
      face_crop_uri: "s3://bucket/face-crop.jpg",
      confidence: 0.97
    },
    "liveness": {
      alive: true,
      selfie_frame_uri: "s3://bucket/selfie-frame.jpg",
      confidence: 0.95
    },
    "face_match": {
      match_score: 0.92,
      confidence: 0.88
    },
    "sanctions": {
      hit: false,
      details: null
    }
  }
}
```

---

## How Steps Get Their Inputs / Como los pasos obtienen sus inputs

Each step declares what it needs. The orchestrator resolves it from the context BEFORE calling the service.

Cada paso declara lo que necesita. El orquestador lo resuelve del contexto ANTES de llamar al servicio.

```
Step definition:
  id: "face_match"
  depends_on: ["ocr", "liveness"]
  input_mapping:
    face_image:   "stepOutputs.ocr.face_crop_uri"
    selfie_image: "stepOutputs.liveness.selfie_frame_uri"
```

What the orchestrator does / Lo que hace el orquestador:

```
1. Face Match is ready (OCR and Liveness both COMPLETED)
   Face Match esta listo (OCR y Liveness ambos COMPLETADOS)

2. Orchestrator reads the input_mapping
   El orquestador lee el input_mapping

3. Resolves values from context:
   Resuelve valores del contexto:
     face_image   = context.stepOutputs["ocr"].face_crop_uri
     selfie_image = context.stepOutputs["liveness"].selfie_frame_uri

4. Calls the Face Match service with those inputs
   Llama al servicio de Face Match con esos inputs

5. Stores the response in context.stepOutputs["face_match"]
   Guarda la respuesta en context.stepOutputs["face_match"]
```

---

## Where Does the Data Live? / Donde viven los datos?

Two types of data / Dos tipos de datos:

| Type / Tipo | Example / Ejemplo | Where / Donde | Why / Por que |
|---|---|---|---|
| **Large files** / Archivos grandes | Images, videos | Object Storage (S3) | Too big for DB, services need direct access / Muy grandes para BD |
| **Small data** / Datos pequenos | Scores, names, flags | Workflow Context (DB) | Fast to read, needs persistence / Rapido de leer, necesita persistencia |

Steps always pass **references** (URIs) for large data, never the data itself.

Los pasos siempre pasan **referencias** (URIs) para datos grandes, nunca los datos en si.

```
GOOD:  { face_crop_uri: "s3://bucket/face-crop.jpg" }    <-- reference/referencia
BAD:   { face_crop: "<10MB of binary image data>" }       <-- actual data/datos reales
```

---

## Trade-off: Where to Store Context / Donde guardar el contexto

| Option | Pros | Cons |
|---|---|---|
| **In-memory only** / Solo en memoria | Fast / Rapido | Lost on crash / Se pierde si se cae |
| **Database after each step** / BD despues de cada paso | Durable, resumable / Durable, reanudable | Adds ~5ms per step / Agrega ~5ms por paso |
| **Database at end only** / BD solo al final | Simple | Can't resume mid-workflow / No puede reanudar a mitad |

**What to propose / Que proponer:** Database after each step. The 5ms overhead is negligible compared to OCR taking seconds. And you get crash recovery for free.

Base de datos despues de cada paso. Los 5ms son insignificantes comparados con el OCR que toma segundos. Y obtienes recuperacion de fallos gratis.

---

## Interview Question to Expect / Pregunta que esperar

**"How does the face match step get the data it needs from both OCR and liveness?"**

**Your answer:** "Each step writes its outputs to the workflow context. When face match is ready to run, the orchestrator resolves its input mapping — it looks up `ocr.face_crop_uri` and `liveness.selfie_frame_uri` from the context and passes them as inputs to the face match service. For large data like images, steps write to object storage and the context only stores URIs."

"Cada paso escribe sus outputs en el contexto del workflow. Cuando face match esta listo para ejecutarse, el orquestador resuelve su mapeo de inputs — busca `ocr.face_crop_uri` y `liveness.selfie_frame_uri` del contexto y los pasa como inputs al servicio de face match. Para datos grandes como imagenes, los pasos escriben en object storage y el contexto solo guarda URIs."
