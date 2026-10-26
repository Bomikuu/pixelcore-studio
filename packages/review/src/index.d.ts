import type { JsonRequest } from '@sitebuilder/core';
export function mountReview(
  element: HTMLElement,
  options?: {
    baseUrl?: string;
    request?: JsonRequest;
    fetch?: typeof fetch;
    token?: string;
    reviewId?: string;
    onReady?(snapshot: unknown): void;
  },
): { reload(): Promise<void>; destroy(): void };
