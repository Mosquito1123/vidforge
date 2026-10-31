"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive";

export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
};

type Listener = (items: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

export function toast(input: Omit<ToastItem, "id">) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: ToastItem = { id, ...input };
  toasts = [...toasts, item];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
  return id;
}

export function useToasts() {
  const [items, setItems] = React.useState<ToastItem[]>(toasts);
  React.useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return items;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}