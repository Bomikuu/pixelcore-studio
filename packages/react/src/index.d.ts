import type { ReactElement } from 'react';
import type { WebsiteDocument, ResolvedData } from '@sitebuilder/core';
import type { EditorOptions, EditorInstance } from '@sitebuilder/editor';
export function WebsitePage(props: {
  document: WebsiteDocument;
  data?: ResolvedData;
  mode?: 'public' | 'editor' | 'review';
  baseUrl?: string;
  landmark?: boolean;
  componentCatalog?: { url: string };
  componentData?: Record<string, unknown>;
  analyticsConsent?: boolean;
  widgets?: Record<
    string,
    (element: HTMLElement, context: { nodeId: string }) => (() => void) | void
  >;
}): ReactElement;
export function WebsiteEditor(
  props: EditorOptions & { onReady?(editor: EditorInstance): void; onError?(error: Error): void },
): ReactElement;
