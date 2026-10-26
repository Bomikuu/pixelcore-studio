import type {
  WebsiteDocument,
  ResolvedData,
  Binding,
  BrandKit,
  Operation,
  JsonRequest,
  BuilderNode,
  DataSource,
} from '@sitebuilder/core';
export interface WorkspaceContext {
  version: number;
  kind?: 'page' | 'event' | 'layout';
  purpose?: 'storefront' | 'event' | 'landing';
  sourceId: string;
  sourceName: string;
  mediaUpload?: boolean;
  publicUrl?: string;
  rsvpState?: 'invitation-required' | 'disabled' | null;
  recoveryScope?: string;
  layoutSourceId?: string;
  affectedPages?: string[];
  headerVariants?: string[];
  footerVariants?: string[];
  pages: Array<{ sourceId: string; title: string; kind: 'page' | 'event' }>;
}
export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  version?: number;
  archived?: boolean;
  tags?: string[];
  document: WebsiteDocument;
}
export interface RevisionSummary {
  id: string;
  number: number;
  createdAt: string;
  isDraft: boolean;
  isPublished: boolean;
  title: string;
}
export interface GlobalSection {
  id: string;
  name: string;
  version: number;
  draftVersion: number;
  publishedVersion: number | null;
  node: BuilderNode;
  affectedPages: Array<{ id: string; key: string; title: string }>;
}
export interface ReviewLink {
  id: string;
  revision: number;
  canComment: boolean;
  expiresAt: string;
  revoked: boolean;
  active?: boolean;
  openCount?: number;
}
export interface ReviewThread {
  id: string;
  nodeId: string;
  viewport: number;
  resolved: boolean;
  comments: Array<{ id: string; name: string; body: string; createdAt: string }>;
}
export interface ReviewDetail extends ReviewLink {
  threads: ReviewThread[];
}
export interface HostAdapter {
  listDesigns?(
    kind: 'templates' | 'sections',
    params?: { offset?: number; archived?: boolean; q?: string },
  ): Promise<{ designs: Array<Omit<SavedTemplate, 'document'>>; nextOffset: number | null }>;
  listReviews?(offset?: number): Promise<{ reviews: ReviewLink[]; nextOffset: number | null }>;
  readReview?(id: string): Promise<ReviewDetail>;
  updateReview?(
    id: string,
    value: { expectedExpiresAt: string; canComment?: boolean; lifetimeDays?: number },
  ): Promise<ReviewDetail>;
  revokeReview?(id: string): Promise<unknown>;
  resolveReviewThread?(id: string, threadId: string, resolved: boolean): Promise<unknown>;
  uploadMedia?(
    file: File,
    alt?: string,
  ): Promise<{
    id: string;
    url: string;
    alt?: string;
    type?: string;
    renditions?: Array<{ url: string; width: number }>;
  }>;
  readDesign?(
    kind: 'templates' | 'sections',
    id: string,
  ): Promise<
    SavedTemplate & {
      node?: BuilderNode;
      revisions?: Array<{ number: number; name: string; createdAt: string }>;
    }
  >;
  updateDesign?(
    kind: 'templates' | 'sections',
    id: string,
    value: {
      expectedVersion: number;
      name?: string;
      description?: string;
      tags?: string[];
      archived?: boolean;
      document?: WebsiteDocument;
      restoreVersion?: number;
    },
  ): Promise<unknown>;
  deleteDesign?(
    kind: 'templates' | 'sections',
    id: string,
    expectedVersion: number,
  ): Promise<unknown>;
  readTemplateVersion?(
    id: string,
    number: number,
  ): Promise<{ name: string; description: string; document: WebsiteDocument }>;
  recoveryScope?: string;
  dataSources?: DataSource[];
  listRevisions?(): Promise<RevisionSummary[]>;
  readRevision?(id: string): Promise<RevisionSummary & { document: WebsiteDocument }>;
  restoreRevision?(
    id: string,
    expectedVersion: number,
  ): Promise<{ version: number; document: WebsiteDocument; data?: ResolvedData }>;
  listGlobalSections?(): Promise<GlobalSection[]>;
  createGlobalSection?(name: string, node: BuilderNode): Promise<GlobalSection>;
  readGlobalSection?(id: string): Promise<GlobalSection>;
  saveGlobalSection?(
    id: string,
    value: { name?: string; node: BuilderNode; expectedVersion: number },
  ): Promise<GlobalSection>;
  publishGlobalSection?(id: string, expectedVersion: number): Promise<GlobalSection>;
  workspace?: WorkspaceContext;
  exit?(): void;
  openPage?(page: WorkspaceContext['pages'][number]): void;
  openRegion?(kind: string): void;
  changeSource?(): void;
  createPage?(): void;
  listTemplates?(): Promise<SavedTemplate[]>;
  saveTemplate?(
    name: string,
    document: WebsiteDocument,
    description?: string,
  ): Promise<SavedTemplate>;
  listSections?(): Promise<Array<{ id: string; name: string; node: BuilderNode }>>;
  saveSection?(name: string, node: BuilderNode): Promise<unknown>;
  capabilities?: string[];
  sources?: Array<{ value: string; label: string }>;
  loadData?(): Promise<ResolvedData>;
  getBrandKit?(): Promise<BrandKit>;
  saveDraft?(document: WebsiteDocument, expectedVersion: number): Promise<{ version: number }>;
  publish?(expectedVersion: number): Promise<unknown>;
  createReview?(
    document: WebsiteDocument,
    expectedVersion: number,
    options?: { canComment?: boolean; lifetimeDays?: number },
  ): Promise<{ url: string }>;
  openSource?(binding: Binding): void;
}
export interface EditorOptions {
  exitLabel?: string;
  mountHeader?(
    container: HTMLElement,
    context: {
      root: ShadowRoot;
      appearance: { readonly value: string; set(value: 'light' | 'dark'): void };
    },
  ): void | (() => void);
  componentCatalog?: { url: string };
  appearance?: 'light' | 'dark';
  document: WebsiteDocument;
  data?: ResolvedData;
  adapter: HostAdapter;
  version?: number;
  enableFreeform?: boolean;
  showSetup?: boolean;
  baseUrl?: string;
  demo?: boolean;
  saveDelay?: number;
  onChange?(document: WebsiteDocument): void;
  onExport?(data: unknown): void;
}
export interface EditorInstance {
  getDocument(): WebsiteDocument;
  readonly hasUnsavedChanges: boolean;
  readonly version: number;
  save(): Promise<number>;
  update(options: Partial<EditorOptions>): void;
  select(
    id: string,
    options?: { focus?: 'canvas' | 'inspector' | 'none'; reveal?: boolean },
  ): boolean;
  command(operation: Operation): void;
  undo(): void;
  redo(): void;
  destroy(): void;
}
export function mountEditor(element: HTMLElement, options: EditorOptions): EditorInstance;
export function createDjangoAdapter(options: {
  websiteId: string;
  recoveryScope?: string;
  dataSources?: DataSource[];
  workspace?: WorkspaceContext;
  exit?(): void;
  openPage?: HostAdapter['openPage'];
  openRegion?: HostAdapter['openRegion'];
  changeSource?: HostAdapter['changeSource'];
  createPage?: HostAdapter['createPage'];
  capabilities?: string[];
  sources?: Array<{ value: string; label: string }>;
  brandKit?: BrandKit;
  openSource?(binding: Binding): void;
  baseUrl?: string;
  csrfCookieName?: string;
  preserveReviewOrigin?: boolean;
  request?: JsonRequest;
  fetch?: typeof fetch;
}): HostAdapter;
export function createSaveState(
  adapter: HostAdapter,
  options?: {
    version?: number;
    delay?: number;
    onState?: (state: unknown) => void;
    onPending?: (document: WebsiteDocument, version: number) => void;
    onSettled?: () => void;
  },
): {
  readonly dirty: boolean;
  readonly version: number;
  readonly error: Error | null;
  request(document: unknown): void;
  flush(): Promise<void>;
  reset(version?: number): void;
  destroy(): void;
};
