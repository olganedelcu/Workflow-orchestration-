// The only internal step — no external service call
// Reads ALL stepOutputs from WorkflowContext
// Evaluates decision_rules from YAML in priority order (first match wins)
// Returns verdict: APPROVED | REJECTED | MANUAL_REVIEW
// v1: hardcoded rules. v2: configurable rules from YAML/DB per customer
