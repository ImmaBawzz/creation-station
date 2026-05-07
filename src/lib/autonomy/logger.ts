export type AutonomyLogEventType =
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "validation_blocked"
  | "stop_engine_intervention_triggered";

export type AutonomyLogEvent = {
  event: AutonomyLogEventType;
  taskId?: string;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
};

export function createAutonomyLogEvent({
  event,
  message,
  metadata = {},
  taskId,
}: {
  event: AutonomyLogEventType;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
  taskId?: string;
}): AutonomyLogEvent {
  return {
    event,
    message,
    metadata,
    taskId,
  };
}
