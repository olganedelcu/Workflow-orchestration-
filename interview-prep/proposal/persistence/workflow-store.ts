// Reads/writes to PostgreSQL — three tables:
// workflow_instances: one row per verification (status, verdict, callback_url)
// workflow_context: one row per verification (inputs, stepOutputs as JSONB)
// workflow_events: many rows per verification (append-only audit trail, clock ticks)
// Persists after every step for crash recovery
