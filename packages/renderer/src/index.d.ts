import type { WebsiteDocument, ResolvedData, BuilderNode } from '@sitebuilder/core';
export function renderPage(
  document: WebsiteDocument,
  data?: ResolvedData,
  options?: {
    mode?: 'public' | 'editor' | 'review';
    baseUrl?: string;
    includeFrame?: boolean;
    landmark?: boolean;
    noIndex?: boolean;
  },
): {
  html: string;
  head: import('@sitebuilder/core').PageMetadata;
  assets: unknown[];
  widgets: Array<{ id: string; widgetId: string; props: BuilderNode['props'] }>;
};
export function escapeHtml(value: unknown): string;
export function enhancePage(
  root: HTMLElement,
  options?: { media?: boolean; motion?: boolean },
): () => void;
export const templates: Array<{
  id: string;
  name: string;
  description: string;
  mode: 'fixed' | 'live';
  category: string;
  requires?: string[];
  create: (data?: ResolvedData) => WebsiteDocument;
}>;
export const elements: Array<{
  type: string;
  name: string;
  capability?: string;
  category?: string;
  requires?: string[];
  create: (data?: ResolvedData) => BuilderNode;
}>;
export const sectionPresets: Array<{
  id: string;
  name: string;
  category?: string;
  requires?: string[];
  create: (data?: ResolvedData) => BuilderNode;
}>;
export function applyTemplate(id: string, data?: ResolvedData): WebsiteDocument;

export const fontCss: string;

export function enhanceAnalytics(
  root: HTMLElement,
  value?: import('@sitebuilder/core').AnalyticsConfiguration,
  options?: { consent?: boolean; mode?: string },
): () => void;
