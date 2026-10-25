import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KBService,
  kbService,
  getCategoryTree,
  getKBCategoryTree,
  searchResources,
  searchKBResources,
  getResourceDetail,
  getKBResourceDetail,
  getResource,
  createBookmark,
  addBookmark,
  createKBBookmark,
  deleteBookmark,
  removeBookmark,
  deleteKBBookmark,
  trackProgress,
  updateProgress,
  trackKBUserProgress,
  KBCategoryNode,
  KBResourceDetail,
  PaginatedKBResourcesResponse,
  KBBookmark,
  KBUserProgress,
} from '../src/services/kb_client';
import { ApiClient } from '../src/lib/api_client';

describe('KBService', () => {
  let mockClient: ApiClient;
  let service: KBService;

  beforeEach(() => {
    mockClient = new ApiClient('http://localhost:8000');
    service = new KBService(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCategoryTree', () => {
    it('should GET category hierarchy tree from /api/v1/kb/categories', async () => {
      const mockCategories: KBCategoryNode[] = [
        {
          id: 'cat-1',
          title: 'Getting Started',
          slug: 'getting-started',
          description: 'Basic guides',
          parent_id: null,
          display_order: 1,
          created_on: '2026-03-30T10:00:00Z',
          children: [],
        },
      ];

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockCategories);

      const result = await service.getCategoryTree();

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/kb/categories', undefined);
      expect(result).toEqual(mockCategories);
    });
  });

  describe('searchResources', () => {
    it('should GET paginated resources with search query and filters', async () => {
      const mockPaginated: PaginatedKBResourcesResponse = {
        items: [
          {
            id: 'res-1',
            category_id: 'cat-1',
            category_title: 'Getting Started',
            title: 'Welcome Guide',
            slug: 'welcome-guide',
            content_type: 'PLAYBOOK',
            body_text: 'Welcome text',
            media_url: null,
            tags: ['onboarding'],
            onboarding_phase: 'phase_1',
            required_role: null,
            min_subscription_tier: null,
            published_on: '2026-03-30T10:00:00Z',
            highlights: ['Welcome'],
          },
        ],
        total_count: 1,
        page: 1,
        limit: 10,
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockPaginated);

      const result = await service.searchResources({
        query: 'Welcome',
        content_type: 'PLAYBOOK',
        category_id: 'cat-1',
        onboarding_phase: 'phase_1',
        user_role: 'admin',
        subscription_tier: 'enterprise',
        page: 1,
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/kb/resources',
        expect.objectContaining({
          params: expect.objectContaining({
            query: 'Welcome',
            content_type: 'PLAYBOOK',
            category_id: 'cat-1',
            onboarding_phase: 'phase_1',
            user_role: 'admin',
            subscription_tier: 'enterprise',
            page: 1,
            limit: 10,
          }),
          headers: expect.objectContaining({
            'X-User-Role': 'admin',
            'X-Subscription-Tier': 'enterprise',
          }),
        })
      );
      expect(result).toEqual(mockPaginated);
    });
  });

  describe('getResourceDetail', () => {
    it('should GET resource detail by ID', async () => {
      const mockDetail: KBResourceDetail = {
        id: 'res-1',
        category_id: 'cat-1',
        category_title: 'Getting Started',
        title: 'Welcome Guide',
        slug: 'welcome-guide',
        content_type: 'PLAYBOOK',
        body_text: 'Full content',
        media_url: null,
        tags: [],
        highlights: [],
        breadcrumbs: [{ id: 'cat-1', title: 'Getting Started', slug: 'getting-started' }],
        tutorial_steps: [],
        is_bookmarked: false,
        progress: null,
        media_embed: null,
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockDetail);

      const result = await service.getResourceDetail('res-1', {
        user_role: 'editor',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/kb/resources/res-1',
        expect.objectContaining({
          params: expect.objectContaining({
            user_role: 'editor',
          }),
          headers: expect.objectContaining({
            'X-User-Role': 'editor',
          }),
        })
      );
      expect(result).toEqual(mockDetail);
    });
  });

  describe('createBookmark', () => {
    it('should POST bookmark request payload when object passed', async () => {
      const mockBookmark: KBBookmark = {
        id: 'bm-1',
        user_id: 'usr-1',
        resource_id: 'res-1',
        created_on: '2026-03-30T10:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockBookmark);

      const result = await service.createBookmark({ resource_id: 'res-1' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/kb/bookmarks',
        { resource_id: 'res-1' },
        expect.anything()
      );
      expect(result).toEqual(mockBookmark);
    });

    it('should POST bookmark request payload when string resourceId passed', async () => {
      const mockBookmark: KBBookmark = {
        id: 'bm-2',
        user_id: 'usr-1',
        resource_id: 'res-2',
        created_on: '2026-03-30T10:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockBookmark);

      const result = await service.createBookmark('res-2');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/kb/bookmarks',
        { resource_id: 'res-2' },
        expect.anything()
      );
      expect(result).toEqual(mockBookmark);
    });
  });

  describe('deleteBookmark', () => {
    it('should DELETE bookmark by resource ID', async () => {
      vi.spyOn(mockClient, 'delete').mockResolvedValueOnce(undefined as any);

      await service.deleteBookmark('res-1');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/kb/bookmarks/res-1', undefined);
    });
  });

  describe('trackProgress', () => {
    it('should POST user progress update payload', async () => {
      const mockProgress: KBUserProgress = {
        resource_id: 'res-1',
        user_id: 'usr-1',
        is_completed: true,
        completed_step_numbers: [1],
        total_steps: 1,
        completion_percentage: 100.0,
        last_accessed_on: '2026-03-30T10:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockProgress);

      const result = await service.trackProgress({
        resource_id: 'res-1',
        step_number: 1,
        is_completed: true,
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/kb/progress',
        { resource_id: 'res-1', step_number: 1, is_completed: true },
        expect.anything()
      );
      expect(result).toEqual(mockProgress);
    });
  });

  describe('standalone exported functions', () => {
    it('should delegate standalone functions to default kbService instance', async () => {
      vi.spyOn(kbService, 'getCategoryTree').mockResolvedValueOnce([]);
      vi.spyOn(kbService, 'searchResources').mockResolvedValueOnce({
        items: [],
        total_count: 0,
        page: 1,
        limit: 10,
      });
      vi.spyOn(kbService, 'getResourceDetail').mockResolvedValueOnce({ id: 'res-1' } as any);
      vi.spyOn(kbService, 'createBookmark').mockResolvedValueOnce({ id: 'bm-1' } as any);
      vi.spyOn(kbService, 'deleteBookmark').mockResolvedValueOnce(undefined as any);
      vi.spyOn(kbService, 'trackProgress').mockResolvedValueOnce({ resource_id: 'res-1' } as any);

      await getCategoryTree();
      await getKBCategoryTree();
      await searchResources();
      await searchKBResources();
      await getResourceDetail('res-1');
      await getKBResourceDetail('res-1');
      await getResource('res-1');
      await createBookmark('res-1');
      await addBookmark('res-1');
      await createKBBookmark('res-1');
      await deleteBookmark('res-1');
      await removeBookmark('res-1');
      await deleteKBBookmark('res-1');
      await trackProgress({ resource_id: 'res-1' });
      await updateProgress({ resource_id: 'res-1' });
      await trackKBUserProgress({ resource_id: 'res-1' });

      expect(kbService.getCategoryTree).toHaveBeenCalledTimes(2);
      expect(kbService.searchResources).toHaveBeenCalledTimes(2);
      expect(kbService.getResourceDetail).toHaveBeenCalledTimes(3);
      expect(kbService.createBookmark).toHaveBeenCalledTimes(3);
      expect(kbService.deleteBookmark).toHaveBeenCalledTimes(3);
      expect(kbService.trackProgress).toHaveBeenCalledTimes(3);
    });
  });
});
