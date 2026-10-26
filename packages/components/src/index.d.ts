export interface ComponentField {
  key: string;
  label: string;
  type: 'text' | 'color' | 'number' | 'select' | 'image';
  default: string | number;
  min?: number;
  max?: number;
  options?: string[];
}
export interface CatalogComponent {
  id: string;
  version: number;
  name: string;
  entryUrl: string;
  posterUrl?: string;
  native?: unknown;
  approved?: boolean;
  manifest: {
    name: string;
    kind: string;
    fields: ComponentField[];
    dataKeys: string[];
    height: number;
    description?: string;
    fallbackText?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export function componentSettings(
  fields?: ComponentField[],
  values?: Record<string, unknown>,
): Record<string, string | number>;
export function publicComponentData(
  keys?: string[],
  data?: Record<string, unknown>,
): Record<string, string | number | boolean>;
export function createCatalogClient(
  baseUrl: string,
  fetcher?: typeof fetch,
): {
  list(): Promise<CatalogComponent[]>;
  get(id: string, version: number): Promise<CatalogComponent>;
};
export function mountComponent(
  container: HTMLElement,
  descriptor: CatalogComponent,
  options?: {
    settings?: Record<string, unknown>;
    publicData?: Record<string, unknown>;
    theme?: { colors?: Record<string, string> };
    motion?: boolean;
    onStatus?(state: 'loading' | 'ready' | 'error', message?: string): void;
  },
): {
  frame: HTMLIFrameElement;
  update(options: {
    settings?: Record<string, unknown>;
    publicData?: Record<string, unknown>;
    theme?: { colors?: Record<string, string> };
  }): void;
  pause(value?: boolean): void;
  destroy(): void;
};
export function enhanceComponents(
  root: HTMLElement,
  options: {
    catalogUrl: string;
    signal?: AbortSignal;
    publicData?: Record<string, unknown>;
    theme?: { colors?: Record<string, string> };
    onError?(message: string): void;
  },
): Promise<() => void>;
