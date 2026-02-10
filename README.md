# Workflow Execution Engine Challenge

A TypeScript coding challenge to build a dependency-aware workflow execution engine. The engine processes a directed acyclic graph (DAG) of steps, respecting dependency ordering, handling parallel branches, and managing failures gracefully.

## Project Structure

```
workflow_engine/
  src/
    types.ts            # Type definitions (Step, StepStatus, StepState, WorkflowState)
    workflow.ts         # Core engine - YOUR IMPLEMENTATION GOES HERE
    workflow.test.ts    # Jest test suite
    test/
      utils.ts          # Test helper (assertWorkflowConsistency)
  tsconfig.json         # TypeScript configuration
  jest.config.js        # Jest configuration (ts-jest preset)
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
npm install
```

### Running Tests

```bash
npx jest
```

All tests in `src/workflow.test.ts` are currently failing. Your goal is to make them pass by implementing the `executeWorkflow` function in `src/workflow.ts`.

## The Challenge

### Objective

Implement the `executeWorkflow` function in `src/workflow.ts`. This function takes an array of `Step` definitions and executes them in dependency order, returning the final `WorkflowState`.

### Types

Defined in `src/types.ts`:

```typescript
// A workflow step with an id and a list of step ids it feeds into
type Step = {
  id: string;
  next: string[];  // steps that depend on THIS step completing
};

// Possible step statuses
enum StepStatus {
  WAITING   = "WAITING",
  RUNNING   = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED    = "FAILED",
}

// Step state varies by status (discriminated union)
// WAITING:   { status }
// RUNNING:   { status, startClock }
// COMPLETED: { status, startClock, finishedClock }
// FAILED:    { status, startClock, finishedClock }

type WorkflowState = Record<string, StepState>;
```

### How Dependencies Work

The `next` field defines forward edges. A step's **dependencies** are all steps that list it in their `next` array.

Example:
```
Step A: { id: "A", next: ["B", "C"] }
Step B: { id: "B", next: ["D"] }
Step C: { id: "C", next: ["D"] }
Step D: { id: "D", next: [] }
```
- A has no dependencies (root step)
- B and C each depend on A
- D depends on both B and C (diamond pattern)

A step can only begin execution once **all** of its dependencies have completed.

### Requirements

1. **Initialize** all steps in `WAITING` state.

2. **Clock-tick execution loop** - Use a logical clock (integer counter) to coordinate execution:
   - Each iteration of the loop is a "tick"
   - Steps record `startClock` when they begin and `finishedClock` when they finish
   - A dependency's `finishedClock` must be `<=` the dependent step's `startClock`
   - `finishedClock` must be strictly greater than `startClock`

3. **Dependency resolution** - On each tick, identify steps that are `WAITING` and whose dependencies are all `COMPLETED`, then transition them to `RUNNING`.

4. **Step execution** - Use the provided `simulateStepExecution(stepId)` function:
   - It is async and must be awaited
   - Steps with ids starting with `"fail"` will throw an error
   - On success: transition to `COMPLETED`
   - On error: transition to `FAILED`

5. **Failure propagation** - If a step fails, any downstream steps that depend on it (directly or transitively) must remain in `WAITING` state. They should never execute.

6. **Termination** - The loop ends when no more progress can be made (no steps are `RUNNING` and no new steps can be started).

### Step Simulation

The `simulateStepExecution` function is already provided in `workflow.ts`:

```typescript
async function simulateStepExecution(stepId: string): Promise<void> {
  if (stepId.startsWith("fail")) throw new Error("Step failed!");
  return;
}
```

Use this function to simulate the work each step performs. Do not replace it.

### Workflow Patterns to Support

| Pattern | Description | Example |
|---------|-------------|---------|
| **Linear** | A -> B -> C | Sequential chain |
| **Branching** | A -> [B, C] -> D | Fork and join |
| **Diamond** | A -> [B, C] -> D -> E | Fork, join, then continue |
| **Independent chains** | A->B and C->D->E | No shared dependencies |
| **Single step** | A | Standalone step |
| **Empty** | (none) | No steps at all |

### Test Suite

The test suite (`src/workflow.test.ts`) validates:

**Linear Workflows**
- Simple A -> B -> C chain
- Single step workflow
- Workflow with a failing step (downstream stays `WAITING`)

**Intermediate Complexity**
- Branching: A -> [B, C] -> D
- Diamond: A -> [B, C] -> D -> E
- Multiple independent chains
- Partial failure in branches (one branch fails, convergence point stays `WAITING`)

**Edge Cases**
- Empty workflow (no steps)
- Orphaned steps (no dependencies between them; all should complete)

### Consistency Checks

The `assertWorkflowConsistency` helper in `src/test/utils.ts` verifies:

- Every step has a result entry
- `COMPLETED`/`FAILED` steps have valid `startClock >= 0` and `finishedClock > startClock`
- `WAITING` steps have no `startClock` or `finishedClock` properties
- A completed step's dependencies all completed, and their `finishedClock <= step.startClock`

### Hints

- Build a reverse dependency map (step id -> list of prerequisite step ids) at the start
- A step with no prerequisites is immediately eligible to run
- Use `Promise.all` or `Promise.allSettled` to run independent steps concurrently within a tick
- Increment the clock at well-defined points to ensure the timing constraints hold
- Handle errors with try/catch around `simulateStepExecution` calls

## Constraints

- No external libraries beyond what's already configured (TypeScript, Jest, ts-jest)
- Focus your implementation in `src/workflow.ts`
- Do not modify the type definitions in `src/types.ts`
- Do not modify the test utility in `src/test/utils.ts`
- You may add additional tests to `src/workflow.test.ts`
