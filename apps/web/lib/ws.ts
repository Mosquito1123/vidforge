export type TaskProgressMessage = {
  type: "task:progress";
  taskId: string;
  userId?: string;
  status: string;
  progress: number;
  stage?: string | null;
  message?: string | null;
  output?: unknown;
  error?: string | null;
  timestamp?: string;
};

export function taskSocketUrl(userId: string): string {
  const base =
    (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : process.env.API_URL) ||
    "http://localhost:4000";
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/ws?userId=${encodeURIComponent(userId)}`;
}

export class TaskProgressSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<(msg: TaskProgressMessage) => void>();

  connect(userId: string) {
    if (typeof window === "undefined") return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(taskSocketUrl(userId));
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TaskProgressMessage;
        if (msg?.type === "task:progress") {
          this.listeners.forEach((cb) => cb(msg));
        }
      } catch {
        // ignore
      }
    };
    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ type: "join", userId }));
    };
  }

  subscribe(cb: (msg: TaskProgressMessage) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const taskProgressSocket = new TaskProgressSocket();