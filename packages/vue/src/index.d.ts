import type { DefineComponent } from 'vue';
import type { WebsiteDocument, ResolvedData } from '@sitebuilder/core';
import type { HostAdapter } from '@sitebuilder/editor';
export const WebsitePage: DefineComponent<{
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
}>;
export const WebsiteEditor: DefineComponent<{
  document: WebsiteDocument;
  data?: ResolvedData;
  adapter: HostAdapter;
  version?: number;
  appearance?: 'light' | 'dark';
  componentCatalog?: { url: string };
  enableFreeform?: boolean;
  showSetup?: boolean;
}>;
