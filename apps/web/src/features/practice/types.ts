import type { TaskType } from '@knj/task-engine';

/** Prompt prepared on the server for rendering: all HTML comes from our sanitizing renderers. */
export interface RenderedPrompt {
  instanceId: string;
  type: TaskType;
  statementHtml: string;
  options?: { id: string; html: string }[];
  left?: { id: string; html: string }[];
  right?: { id: string; html: string; text: string }[];
  unit?: string;
  variables?: string[];
  hintsHtml: string[];
}
