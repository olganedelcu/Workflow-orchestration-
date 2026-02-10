import { type Step, StepStatus } from "./types";
import { executeWorkflow } from "./workflow";
import { assertWorkflowConsistency } from "./test/utils";

describe("Workflow Execution Engine", () => {
  describe("Linear Workflows", () => {
    test("should execute simple linear workflow: A → B → C", async () => {
      const steps: Step[] = [
        { id: "start", next: ["middle"] },
        { id: "middle", next: ["end"] },
        { id: "end", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["middle"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["end"]?.status).toBe(StepStatus.COMPLETED);
    });

    test("should handle single step workflow", async () => {
      const steps: Step[] = [{ id: "only", next: [] }];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["only"]?.status).toBe(StepStatus.COMPLETED);
    });

    test("should handle workflow with failure", async () => {
      const steps: Step[] = [
        { id: "start", next: ["fail-step"] },
        { id: "fail-step", next: ["after-fail"] },
        { id: "after-fail", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["fail-step"]?.status).toBe(StepStatus.FAILED);
      expect(result?.["after-fail"]?.status).toBe(StepStatus.WAITING);
    });
  });

  describe("Intermediate Complexity Workflows", () => {
    test("should execute branching workflow: A → [B, C] → D", async () => {
      const steps: Step[] = [
        { id: "start", next: ["branch1", "branch2"] },
        { id: "branch1", next: ["converge"] },
        { id: "branch2", next: ["converge"] },
        { id: "converge", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["branch1"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["branch2"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["converge"]?.status).toBe(StepStatus.COMPLETED);
    });

    test("should execute diamond pattern: A → [B, C] → D → E", async () => {
      const steps: Step[] = [
        { id: "A", next: ["B", "C"] },
        { id: "B", next: ["D"] },
        { id: "C", next: ["D"] },
        { id: "D", next: ["E"] },
        { id: "E", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["A"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["B"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["C"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["D"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["E"]?.status).toBe(StepStatus.COMPLETED);
    });

    test("should handle multiple independent chains", async () => {
      const steps: Step[] = [
        { id: "chain1-start", next: ["chain1-end"] },
        { id: "chain1-end", next: [] },
        { id: "chain2-start", next: ["chain2-middle"] },
        { id: "chain2-middle", next: ["chain2-end"] },
        { id: "chain2-end", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["chain1-start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["chain2-start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["chain1-end"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["chain2-middle"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["chain2-end"]?.status).toBe(StepStatus.COMPLETED);
    });

    test("should handle partial failure in branching workflow", async () => {
      const steps: Step[] = [
        { id: "start", next: ["good-branch", "fail-branch"] },
        { id: "good-branch", next: ["final"] },
        { id: "fail-branch", next: ["final"] },
        { id: "final", next: [] },
      ];

      const result = await executeWorkflow(steps);

      expect(result?.["start"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["good-branch"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["fail-branch"]?.status).toBe(StepStatus.FAILED);
      expect(result?.["final"]?.status).toBe(StepStatus.WAITING);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty workflow", async () => {
      const steps: Step[] = [];
      const result = await executeWorkflow(steps);
      expect(Object.keys(result)).toHaveLength(0);
    });

    test("should handle steps with no dependencies (orphaned steps)", async () => {
      const steps: Step[] = [
        { id: "orphan1", next: [] },
        { id: "orphan2", next: [] },
      ];

      const result = await executeWorkflow(steps);

      assertWorkflowConsistency(steps, result);
      expect(result?.["orphan1"]?.status).toBe(StepStatus.COMPLETED);
      expect(result?.["orphan2"]?.status).toBe(StepStatus.COMPLETED);
    });
  });
});