"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional id of the panel this tab controls (for aria-controls). */
  panelId?: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tablist, e.g. "登录方式". */
  ariaLabel: string;
  className?: string;
  idBase?: string;
};

/**
 * Accessible segmented control used to switch between mutually exclusive views
 * (email / phone sign-in, billing periods, ...).
 *
 * - Renders as a real `tablist` with `tab` children and `aria-selected`.
 * - Arrow keys / Home / End move focus between tabs (WAI-ARIA tabs pattern).
 * - 44px minimum target height keeps it touch friendly; focus ring is visible.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  idBase,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const next = (index + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid w-full gap-1 rounded-lg bg-muted p-1",
        options.length === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const tabId = idBase ? `${idBase}-tab-${option.value}` : undefined;

        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={selected}
            aria-controls={option.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium",
              "transition-[background-color,color,box-shadow] duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
