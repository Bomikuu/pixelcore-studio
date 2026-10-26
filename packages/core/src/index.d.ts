export type Binding = { source: string; path: string; format?: 'text' | 'currency' | 'date' };
export type TextValue = string | Binding;
export type Breakpoint = 'desktop' | 'tablet' | 'phone';
export type NodeType =
  | 'component'
  | 'accordion'
  | 'tabs'
  | 'video'
  | 'repeater'
  | 'global-section'
  | 'header'
  | 'footer'
  | 'widget'
  | 'spacer'
  | 'page'
  | 'section'
  | 'container'
  | 'columns'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'gallery'
  | 'products'
  | 'services'
  | 'event-schedule';
export type ColorRole =
  'background' | 'surface' | 'text' | 'muted' | 'primary' | 'onPrimary' | 'accent' | 'border';
export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'video';
  color?: string;
  from?: string;
  to?: string;
  angle?: number;
  assetId?: string;
  posterId?: string;
  overlay?: string;
  opacity?: number;
  fit?: 'cover' | 'contain';
  focal?: string;
}
export interface NodeStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number;
  minWidth?: number;
  flexDirection?: 'row' | 'column';
  flexWrap?: 'wrap' | 'nowrap';
  justifyContent?: 'start' | 'center' | 'end' | 'space-between';
  gap?: number;
  maxWidth?: number;
  minHeight?: number;
  height?: number;
  opacity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'none';
  borderColor?: string;
  boxShadow?: 'none' | 'soft' | 'lifted';
  overflow?: 'visible' | 'hidden';
  display?: 'block' | 'grid' | 'flex' | 'none';
  gridColumns?: number;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  background?: Background;
  motion?: {
    preset: 'none' | 'fade' | 'rise' | 'slide' | 'scale';
    duration: number;
    delay: number;
    easing?: 'ease-out' | 'ease-in-out' | 'linear' | 'cubic-bezier(0.16,1,0.3,1)';
    trigger?: 'entrance' | 'hover' | 'section';
  };
  freeform?: { x: number; y: number; width: number; height: number; z: number };
}
export interface BuilderNode {
  id: string;
  type: NodeType;
  props: {
    componentId?: string;
    componentVersion?: number;
    componentSettings?: string;
    fallbackText?: string;
    items?: Array<{ title: string; body: string }>;
    aspect?: 'auto' | '1/1' | '4/3' | '3/4' | '16/9' | '4/5' | '3/2';
    focalX?: number;
    focalY?: number;
    decorative?: 0 | 1;
    posterId?: string;
    sectionId?: string;
    offset?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    filterField?: string;
    filterValue?: string;
    emptyText?: string;
    name?: string;
    variant?: string;
    widgetId?: string;
    text?: TextValue;
    level?: number;
    href?: TextValue;
    assetId?: TextValue;
    assetIds?: string[];
    alt?: TextValue;
    caption?: string;
    source?: string;
    limit?: number;
    action?: string;
    collection?: string;
    fit?: string;
  };
  children: BuilderNode[];
  style: NodeStyle;
  responsive: Partial<Record<'tablet' | 'phone', NodeStyle>>;
}
export interface Theme {
  name?: string;
  colors: Record<ColorRole, string>;
  headingFont: string;
  bodyFont: string;
  baseSize: number;
  scale: number;
  radius: number;
}
export interface WebsiteDocument extends BuilderNode {
  analytics?: AnalyticsConfiguration;
  type: 'page';
  schemaVersion: 1;
  title: string;
  mode: 'fixed' | 'live';
  theme: Theme;
  seo?: PageSettings;
  motionDisabled?: boolean;
  context?: {
    version: 1;
    purpose: 'storefront' | 'event' | 'landing';
    sourceId: string;
    setupComplete: 1;
  };
}
export interface ResolvedData {
  assets?: Record<
    string,
    {
      url: string;
      alt?: string;
      width?: number;
      height?: number;
      type?: string;
      renditions?: Array<{ url: string; width: number }>;
    }
  >;
  locale?: string;
  currency?: string;
  [source: string]: unknown;
}
export type Operation =
  | { type: 'restore'; document: WebsiteDocument }
  | { type: 'theme'; value: Partial<Omit<Theme, 'colors'>> & { colors?: Partial<Theme['colors']> } }
  | {
      type: 'document';
      value: Partial<
        Pick<WebsiteDocument, 'title' | 'mode' | 'motionDisabled' | 'context' | 'seo'>
      >;
    }
  | { type: 'text'; id: string; value: string; detach?: boolean }
  | { type: 'props'; id: string; value: BuilderNode['props']; detach?: boolean }
  | { type: 'style'; id: string; value: NodeStyle; breakpoint?: Breakpoint }
  | { type: 'style-preset'; id: string; preset: string; breakpoint?: Breakpoint }
  | { type: 'reset-style'; id: string; breakpoint?: Breakpoint; property?: keyof NodeStyle }
  | { type: 'insert'; id: string; node: BuilderNode; index?: number }
  | { type: 'duplicate' | 'remove'; id: string }
  | { type: 'move'; id: string; parentId: string; beforeId?: string };
export interface BrandKit {
  version: 1;
  colors: Partial<Record<ColorRole, string>>;
  headingFont?: string;
  bodyFont?: string;
  baseSize?: number;
  logoAssetId?: string;
}
export function createDocument(options?: {
  title?: string;
  mode?: 'fixed' | 'live';
}): WebsiteDocument;
export function validateDocument(value: unknown): WebsiteDocument;
export function normalizeGlobalFonts(value: unknown): WebsiteDocument;
export function findNode(root: BuilderNode, id: string): BuilderNode | null;
export function findParent(root: BuilderNode, id: string): BuilderNode | null;
export function node(
  type: NodeType,
  props?: BuilderNode['props'],
  children?: BuilderNode[],
): BuilderNode;
export function cloneNode<T extends BuilderNode>(node: T): T;
export function walk(
  root: BuilderNode,
  visitor: (node: BuilderNode, parent: BuilderNode | null) => void,
  parent?: BuilderNode | null,
): void;
export function id(): string;
export function safeUrl(value: unknown, options?: { asset?: boolean }): string;
export function resolveValue(value: unknown, data: ResolvedData): string | number | undefined;
export function applyOperation(
  document: WebsiteDocument,
  operation: Operation,
): { document: WebsiteDocument; inverse: Operation };
export function createHistory(
  document: WebsiteDocument,
  onChange?: (document: WebsiteDocument) => void,
  prepare?: (document: WebsiteDocument, operation: Operation) => WebsiteDocument,
): {
  readonly document: WebsiteDocument;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  apply(operation: Operation): WebsiteDocument;
  undo(): void;
  redo(): void;
  replace(document: WebsiteDocument): void;
};
export function checkContrast(options: {
  foreground: string;
  background: unknown;
  fontSize?: number;
  fontWeight?: number;
  role?: 'text' | 'control';
}): { ratio: number | null; required: number; status: 'pass' | 'fail' | 'needs-review' };
export function validateBrandKit(value: unknown): BrandKit;
export function defaultTheme(): Theme;
export const schemes: Array<{ id: string; name: string; colors: Theme['colors'] }>;
export const fonts: string[];
export const colorRoles: ColorRole[];
export const nodeTypes: NodeType[];
export const containers: NodeType[];
export type JsonRequest = (
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<any>;
export function createJsonClient(options?: {
  baseUrl?: string;
  csrfCookieName?: string;
  request?: JsonRequest;
  fetch?: typeof fetch;
}): { send: JsonRequest };

export function contrastFindings(
  document: WebsiteDocument,
  options?: { breakpoint?: Breakpoint },
): Array<{
  nodeId: string;
  type: NodeType;
  ratio: number | null;
  required: number;
  status: 'pass' | 'fail' | 'needs-review';
}>;

export interface WebsiteTemplate {
  version: 1;
  name: string;
  description: string;
  document: WebsiteDocument;
}
export function templateDocument(value: unknown): WebsiteDocument;
export function createTemplate(value: {
  name: string;
  description?: string;
  document: WebsiteDocument;
}): WebsiteTemplate;
export function parseTemplateJSON(text: string): WebsiteTemplate;

export interface DataSource {
  id: string;
  label: string;
  kind: 'record' | 'collection';
  fields: Array<{
    path: string;
    label: string;
    type: 'text' | 'currency' | 'date' | 'url' | 'asset';
  }>;
}
export const breakpoints: Breakpoint[];
export function effectiveStyle(node: BuilderNode, breakpoint?: Breakpoint): NodeStyle;
export function styleOrigin(
  node: BuilderNode,
  property: keyof NodeStyle,
  breakpoint?: Breakpoint,
): Breakpoint | 'default';
export function headingSize(theme: Theme, level?: number): number;
export function collectionRows(
  data: ResolvedData,
  props: BuilderNode['props'] & { source: string },
): {
  rows: Array<Record<string, unknown>>;
  status: 'ready' | 'error' | 'loading' | 'unavailable';
  total: number;
};
export function formatValue(binding: unknown, data: ResolvedData): string | number | undefined;

export const recoveryPrefix: string;
export function clearRecoveryCopies(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'>,
): boolean;

export interface PageSettings {
  title?: string;
  description?: string;
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: string;
  canonical?: string;
  noIndex?: boolean;
}
export interface PageMetadata {
  title: string;
  description: string;
  robots: string;
  canonical: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
}
export interface PageMetadataOptions {
  mode?: 'public' | 'editor' | 'review';
  noIndex?: boolean;
  description?: string;
  canonical?: string;
}
export function validatePageSettings(settings: unknown): void;
export function pageMetadata(
  document: WebsiteDocument,
  data?: ResolvedData,
  options?: PageMetadataOptions,
): PageMetadata;
export function pageHead(
  document: WebsiteDocument,
  data?: ResolvedData,
  options?: PageMetadataOptions,
): {
  title: string;
  meta: Array<{ name?: string; property?: string; content: string }>;
  link: Array<{ rel: string; href: string }>;
};
export function pageFindings(
  document: WebsiteDocument,
  data?: ResolvedData,
): Array<{ id: string; message: string }>;
export function assetReferences(
  document: WebsiteDocument,
): Array<{ id: string; nodeId: string; field: string }>;
export function missingAssets(document: WebsiteDocument, data?: ResolvedData): string[];
export function emptyMediaSlots(
  document: WebsiteDocument,
  data?: ResolvedData,
): Array<{ nodeId: string; field: string; type: string }>;
export function liveContentNodes(document: WebsiteDocument, data?: ResolvedData): string[];
export function prepareContentMode(
  document: WebsiteDocument,
  operation?: Operation,
  data?: ResolvedData,
): WebsiteDocument;
export function templateBranding(
  template: WebsiteDocument,
  current: WebsiteDocument,
  options?: { choice?: 'keep' | 'template' | 'import'; brandKit?: unknown },
): WebsiteDocument;
export function remapAsset(document: WebsiteDocument, from: string, to: string): WebsiteDocument;

export interface ElementStylePreset {
  id: string;
  label: string;
  description: string;
  style: NodeStyle;
}
export const shadowValues: Readonly<Record<'none' | 'soft' | 'lifted', string>>;
export function stylePresets(type: NodeType, theme?: Theme): ElementStylePreset[];
export function presetStyleKeys(type: NodeType): (keyof NodeStyle)[];
export function matchingStylePreset(
  node: BuilderNode,
  theme: Theme,
  breakpoint?: Breakpoint,
): string | null;

export interface AnalyticsConfiguration {
  provider: 'none' | 'google' | 'plausible';
  domain?: string;
  measurementId?: string;
  scriptUrl?: string;
}
export function validateAnalytics(value?: AnalyticsConfiguration): AnalyticsConfiguration;

export const fontRegistry: Array<{
  family: string;
  kind: 'bundled' | 'system' | 'unavailable';
  file?: string;
}>;
export function fontOptions(
  current?: string,
): Array<{ value: string; label: string; disabled: boolean }>;

export interface PublicationFinding {
  id: string;
  level: 'blocker' | 'warning';
  kind: string;
  message: string;
}
export function publicationFindings(
  document: WebsiteDocument,
  data?: ResolvedData,
  capabilities?: string[],
): PublicationFinding[];
export function revisionSummary(current: WebsiteDocument, live?: WebsiteDocument): string;

export function consentKey(scope: string): string;
export function createConsentStore(options: {
  scope: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  eventTarget?: Window;
  now?: () => number;
}): {
  readonly value: string;
  subscribe(listener: (value: string) => void): () => void;
  set(value: 'allowed' | 'denied'): void;
  destroy(): void;
};
