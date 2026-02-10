export type Step = {
  id: string;
  next: string[];
};

export enum StepStatus {
  WAITING = "WAITING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

type StepStateWaiting = {
  status: StepStatus.WAITING;
};

type StepStateRunning = {
  status: StepStatus.RUNNING;
  startClock: number;
};

type StepStateCompleted = {
  status: StepStatus.COMPLETED;
  startClock: number;
  finishedClock: number;
};

type StepStateFailed = {
  status: StepStatus.FAILED;
  startClock: number;
  finishedClock: number;
};

export type StepState =
  | StepStateWaiting
  | StepStateRunning
  | StepStateCompleted
  | StepStateFailed;

export type WorkflowState = Record<string, StepState>;
