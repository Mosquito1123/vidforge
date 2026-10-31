export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  POST_PROCESSING = 'post_processing',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const TASK_STATUSES = Object.values(TaskStatus);

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.QUEUED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED, TaskStatus.FAILED],
  [TaskStatus.RUNNING]: [TaskStatus.POST_PROCESSING, TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.CANCELLED],
  [TaskStatus.POST_PROCESSING]: [TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.CANCELLED],
  [TaskStatus.DONE]: [],
  [TaskStatus.FAILED]: [TaskStatus.QUEUED],
  [TaskStatus.CANCELLED]: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}