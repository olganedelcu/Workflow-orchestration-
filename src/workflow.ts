import { type Step, type WorkflowState, StepStatus } from "./types";


// flips "next" so we know what each step depends on
function buildDependencyMap(steps: Step[]): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  for (const step of steps) {
    if (!deps[step.id]) deps[step.id] = [];
    for (const nextId of step.next) {
      if (!deps[nextId]) deps[nextId] = [];
      deps[nextId]!.push(step.id);
    }
  }
  return deps;
}

// simulates doing a step. if it starts with "fail", it throws
async function simulateStepExecution(stepId: string): Promise<void> {
  if (stepId.startsWith("fail")) throw new Error("Step failed!");
}

export async function executeWorkflow(steps: Step[]): Promise<WorkflowState> {
  
  const state: WorkflowState = {};
  
  for (const step of steps) {
      state[step.id] = {status: StepStatus.WAITING };
  }
  
  const deps = buildDependencyMap(steps);
  let clock = 0;
  
  while (true) {
    // step ready if waiting true and its depencency completed
    const ready = steps.filter((step) => {
      if(state[step.id]?.status !== StepStatus.WAITING) return false;
      const requires = deps[step.id] || [];
      return requires.every((id) => state[id]?.status === StepStatus.COMPLETED);
    });
    
    if (ready.length === 0) break;
    
    // mark as running
    const startClock = clock++;
    for (const step of ready) {
      state[step.id] = { status: StepStatus.RUNNING, startClock};
    }
    
    // ready steps
    const results = await Promise.allSettled(
      ready.map((step) => simulateStepExecution(step.id)),
    );
    
    // record it all info
    const finishedClock = clock++;
    for(let i = 0; i < ready.length; i++){
      const succeeded = results[i]!.status === "fulfilled";
      state[ready[i]!.id] = {
        status: succeeded ? StepStatus.COMPLETED : StepStatus.FAILED,
        startClock,
        finishedClock,
      }
    }
    
  }

  return state;
}
