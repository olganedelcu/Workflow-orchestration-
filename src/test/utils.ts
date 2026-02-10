import { type Step, StepStatus, type WorkflowState } from "../types";

// Helper function to verify basic consistency of workflow execution results
export function assertWorkflowConsistency(
  steps: Step[],
  result: WorkflowState,
) {
  // All steps should have a result
  for (const step of steps) {
    expect(result[step.id]).toBeDefined();
  }

  // All completed/failed steps should have valid clock values
  for (const [stepId, state] of Object.entries(result)) {
    if (
      state.status === StepStatus.COMPLETED ||
      state.status === StepStatus.FAILED
    ) {
      expect(state.startClock).toBeGreaterThanOrEqual(0);
      expect(state.finishedClock).toBeGreaterThan(state.startClock);
    } else if (state.status === StepStatus.WAITING) {
      expect(state).not.toHaveProperty("startClock");
      expect(state).not.toHaveProperty("finishedClock");
    }
  }

  // Dependencies should be respected: a step should only complete if all its dependencies completed
  for (const step of steps) {
    const stepState = result[step.id];
    if (stepState?.status === StepStatus.COMPLETED) {
      // Find all steps that this step depends on (steps that list this step in their 'next')
      for (const dependency of steps) {
        if (dependency.next.includes(step.id)) {
          const depState = result[dependency.id];
          expect(depState?.status).toBe(StepStatus.COMPLETED);
          if (depState?.status === StepStatus.COMPLETED) {
            expect(depState.finishedClock).toBeLessThanOrEqual(
              stepState.startClock,
            );
          }
        }
      }
    }
  }
}
