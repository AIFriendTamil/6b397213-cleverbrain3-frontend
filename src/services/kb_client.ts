/**
 * Self-Service Knowledge Base API client service wrapper for frontend components.
 * Provides typed methods for searching resources, fetching category hierarchy trees,
 * retrieving resource details, managing user bookmarks, and tracking tutorial/video progress.
 */

import { apiClient, ApiClient, ApiClientOptions } from '../lib/api_client';

/**
 * Knowledge base content type enum values.
 */
export type KBContentType = 'FAQ' | 'PLAYBOOK' | 'PROCESS_DOC' | 'TUTORIAL' | 'VIDEO' | string;

/**
 * Hierarchical category node schema.
 */
export interface KBCategoryNode {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  display_order: number;
  created_on?: string | null;
  children: KBCategoryNode[];
}

/**
 * Category breadcrumb navigation item schema.
 */
export interface KBBreadcrumb {
  id: string;
  title: string;
  slug: string;
}

/**
 * Tutorial step item schema.
 */
export interface KBTutorialStep {
  id: string;
  resource_id: string;
  step_number: number;
  title: string;
  content?: string | null;
  video_url?: string | null;
}

/**
 * User progress tracking status schema.
 */
export interface KBUserProgress {
  resource_id: string;
  user_id: string;
  is_completed: boolean;
  completed_step_numbers: number[];
  total_steps: number;
  completion_percentage: number;
  last_accessed_on?: string | null;
}

/**
 * Sanitized video embed player configuration schema.
 */
export interface KBVideoEmbed {
  original_input: string;
  provider: string;
  video_id: string;
  embed_url: string;
  has_controls: boolean;
  allow_fullscreen: boolean;
  aspect_ratio: string;
  sanitized_iframe: string;
  title: string;
}

/**
 * Knowledge base resource summary item schema.
 */
export interface KBResourceSummary {
  id: string;
  category_id: string;
  category_title?: string | null;
  title: string;
  slug: string;
  content_type: KBContentType;
  body_text?: string | null;
  media_url?: string | null;
  tags: string[];
  onboarding_phase?: string | null;
  required_role?: string | null;
  min_subscription_tier?: string | null;
  published_on?: string | null;
  highlights: string[];
}

/**
 * Full knowledge base resource detail schema.
 */
export interface KBResourceDetail extends KBResourceSummary {
  breadcrumbs: KBBreadcrumb[];
  tutorial_steps: KBTutorialStep[];
  is_bookmarked: boolean;
  progress?: KBUserProgress | null;
  media_embed?: KBVideoEmbed | null;
}

/**
 * Paginated search results response schema.
 */
export interface PaginatedKBResourcesResponse {
  items: KBResourceSummary[];
  total_count: number;
  page: number;
  limit: number;
}

/**
 * Type alias for PaginatedKBResourcesResponse.
 */
export type PaginatedKBResources = PaginatedKBResourcesResponse;

/**
 * Query filter parameters for searching knowledge base resources.
 */
export interface KBSearchParams {
  query?: string;
  content_type?: KBContentType;
  category_id?: string;
  onboarding_phase?: string;
  user_role?: string;
  subscription_tier?: string;
  x_user_role?: string;
  x_subscription_tier?: string;
  page?: number;
  limit?: number;
}

/**
 * Type alias for KBSearchParams.
 */
export type SearchKBResourcesParams = KBSearchParams;

/**
 * Payload for adding a resource bookmark.
 */
export interface KBBookmarkCreate {
  resource_id: string;
}

/**
 * Created bookmark response schema.
 */
export interface KBBookmark {
  id: string;
  user_id: string;
  resource_id: string;
  created_on?: string | null;
}

/**
 * Payload for tracking user progress.
 */
export interface KBProgressUpdate {
  resource_id: string;
  step_number?: number | null;
  is_completed?: boolean;
}

/**
 * Request options supporting user role and subscription tier overrides.
 */
export interface KBRequestRoleOptions {
  user_role?: string;
  subscription_tier?: string;
  x_user_role?: string;
  x_subscription_tier?: string;
}

/**
 * Service class for interacting with Knowledge Base backend API endpoints.
 */
export class KBService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Helper to construct request headers containing RBAC role or tier overrides.
   */
  private buildHeaders(
    params?: KBRequestRoleOptions,
    options?: ApiClientOptions
  ): Record<string, string> {
    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    const roleVal = params?.x_user_role || params?.user_role;
    if (roleVal && !customHeaders['X-User-Role']) {
      customHeaders['X-User-Role'] = roleVal;
    }
    const tierVal = params?.x_subscription_tier || params?.subscription_tier;
    if (tierVal && !customHeaders['X-Subscription-Tier']) {
      customHeaders['X-Subscription-Tier'] = tierVal;
    }
    return customHeaders;
  }

  /**
   * Retrieve the complete hierarchical category tree.
   * [FR-001]
   */
  public async getCategoryTree(
    options?: ApiClientOptions
  ): Promise<KBCategoryNode[]> {
    return this.client.get<KBCategoryNode[]>('/api/v1/kb/categories', options);
  }

  /**
   * Search and filter knowledge base resources with RBAC scope checks.
   * [FR-001]
   */
  public async searchResources(
    params?: KBSearchParams,
    options?: ApiClientOptions
  ): Promise<PaginatedKBResourcesResponse> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.query !== undefined) queryParams.query = params.query;
    if (params?.content_type !== undefined) queryParams.content_type = params.content_type;
    if (params?.category_id !== undefined) queryParams.category_id = params.category_id;
    if (params?.onboarding_phase !== undefined) queryParams.onboarding_phase = params.onboarding_phase;
    if (params?.user_role !== undefined) queryParams.user_role = params.user_role;
    if (params?.subscription_tier !== undefined) queryParams.subscription_tier = params.subscription_tier;
    if (params?.page !== undefined) queryParams.page = params.page;
    if (params?.limit !== undefined) queryParams.limit = params.limit;

    const headers = this.buildHeaders(params, options);

    return this.client.get<PaginatedKBResourcesResponse>('/api/v1/kb/resources', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Retrieve single knowledge base resource details including breadcrumbs, tutorial steps, and media embed.
   * [FR-001]
   */
  public async getResourceDetail(
    id: string,
    params?: KBRequestRoleOptions,
    options?: ApiClientOptions
  ): Promise<KBResourceDetail> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.user_role !== undefined) queryParams.user_role = params.user_role;
    if (params?.subscription_tier !== undefined) queryParams.subscription_tier = params.subscription_tier;

    const headers = this.buildHeaders(params, options);

    return this.client.get<KBResourceDetail>(`/api/v1/kb/resources/${encodeURIComponent(id)}`, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Add a resource bookmark for the authenticated user.
   * [FR-001]
   */
  public async createBookmark(
    payload: KBBookmarkCreate | string,
    params?: KBRequestRoleOptions,
    options?: ApiClientOptions
  ): Promise<KBBookmark> {
    const requestBody: KBBookmarkCreate =
      typeof payload === 'string' ? { resource_id: payload } : payload;

    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.user_role !== undefined) queryParams.user_role = params.user_role;
    if (params?.subscription_tier !== undefined) queryParams.subscription_tier = params.subscription_tier;

    const headers = this.buildHeaders(params, options);

    return this.client.post<KBBookmark>('/api/v1/kb/bookmarks', requestBody, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Remove a resource bookmark for the authenticated user.
   * [FR-001]
   */
  public async deleteBookmark(
    resourceId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    await this.client.delete<void>(`/api/v1/kb/bookmarks/${encodeURIComponent(resourceId)}`, options);
  }

  /**
   * Track or update user progress for a tutorial step or video module.
   * [FR-001]
   */
  public async trackProgress(
    payload: KBProgressUpdate,
    params?: KBRequestRoleOptions,
    options?: ApiClientOptions
  ): Promise<KBUserProgress> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.user_role !== undefined) queryParams.user_role = params.user_role;
    if (params?.subscription_tier !== undefined) queryParams.subscription_tier = params.subscription_tier;

    const headers = this.buildHeaders(params, options);

    return this.client.post<KBUserProgress>('/api/v1/kb/progress', payload, {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }
}

// Class aliases
export { KBService as KnowledgeBaseService, KBService as KBClient, KBService as KnowledgeBaseClient };

// Singleton instances
export const kbService = new KBService();
export const knowledgeBaseService = kbService;
export const kbClient = kbService;
export const knowledgeBaseClient = kbService;

// Standalone exported functions
export const getCategoryTree = (
  options?: ApiClientOptions
): Promise<KBCategoryNode[]> => kbService.getCategoryTree(options);

export const getKBCategoryTree = (
  options?: ApiClientOptions
): Promise<KBCategoryNode[]> => kbService.getCategoryTree(options);

export const searchResources = (
  params?: KBSearchParams,
  options?: ApiClientOptions
): Promise<PaginatedKBResourcesResponse> => kbService.searchResources(params, options);

export const searchKBResources = (
  params?: KBSearchParams,
  options?: ApiClientOptions
): Promise<PaginatedKBResourcesResponse> => kbService.searchResources(params, options);

export const getResourceDetail = (
  id: string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBResourceDetail> => kbService.getResourceDetail(id, params, options);

export const getKBResourceDetail = (
  id: string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBResourceDetail> => kbService.getResourceDetail(id, params, options);

export const getResource = (
  id: string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBResourceDetail> => kbService.getResourceDetail(id, params, options);

export const createBookmark = (
  payload: KBBookmarkCreate | string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBBookmark> => kbService.createBookmark(payload, params, options);

export const addBookmark = (
  payload: KBBookmarkCreate | string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBBookmark> => kbService.createBookmark(payload, params, options);

export const createKBBookmark = (
  payload: KBBookmarkCreate | string,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBBookmark> => kbService.createBookmark(payload, params, options);

export const deleteBookmark = (
  resourceId: string,
  options?: ApiClientOptions
): Promise<void> => kbService.deleteBookmark(resourceId, options);

export const removeBookmark = (
  resourceId: string,
  options?: ApiClientOptions
): Promise<void> => kbService.deleteBookmark(resourceId, options);

export const deleteKBBookmark = (
  resourceId: string,
  options?: ApiClientOptions
): Promise<void> => kbService.deleteBookmark(resourceId, options);

export const trackProgress = (
  payload: KBProgressUpdate,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBUserProgress> => kbService.trackProgress(payload, params, options);

export const updateProgress = (
  payload: KBProgressUpdate,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBUserProgress> => kbService.trackProgress(payload, params, options);

export const trackKBUserProgress = (
  payload: KBProgressUpdate,
  params?: KBRequestRoleOptions,
  options?: ApiClientOptions
): Promise<KBUserProgress> => kbService.trackProgress(payload, params, options);
