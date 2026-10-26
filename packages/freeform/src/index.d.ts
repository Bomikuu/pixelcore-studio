import type { Operation } from '@sitebuilder/core';
export function enableSection(id: string): Operation;
export function snap(value: number, grid?: number): number;
export function bounds(
  value: { x: number; y: number; width?: number; height?: number; z?: number },
  container?: { width: number; height: number },
): { x: number; y: number; width: number; height: number; z: number };
export function attachFreeform(
  element: HTMLElement,
  options: {
    initial: ReturnType<typeof bounds>;
    container: { width: number; height: number };
    commit: (value: ReturnType<typeof bounds>) => void;
    zoom?: number;
  },
): () => void;
