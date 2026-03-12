// The same DAG engine (while loop, buildDependencyMap, Promise.allSettled, clock ticks)
// Only change: instead of simulateStepExecution(stepId), calls executeStep(step, context)
// which resolves input_mapping, calls the real service, and writes output to context
