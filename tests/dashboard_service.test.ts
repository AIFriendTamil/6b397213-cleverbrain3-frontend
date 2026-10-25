import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DashboardService,
  dashboardService,
  getDashboardMetrics,
  fetchDashboardMetrics,
  triggerDashboardRefresh,
  refreshDashboardMetrics,
  DashboardMetricsResponse,
  DashboardRefreshResponse,
} from '../src/services/dashboard';
import { ApiClient } from '../src/lib/api_client';

describe('DashboardService', () => {
  let mockClient: ApiClient;
  let service: DashboardService;

  beforeEach(() => {
    mockClient = new ApiClient('http://localhost:8000');
    service = new DashboardService(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMetrics / fetchMetrics', () => {
    it('should send GET request to /api/v1/dashboard/metrics with default parameters', async () => {
      const mockResponse: DashboardMetricsResponse = {
        last_updated_at: '2026-10-24T12:00:00Z',
        metrics: [
          {
            domain_name: 'sales',
            display_name: 'Sales Pipeline',
            status: 'active',
            detail_url: '/sales',
            kpis: [
              {
                key: 'pipeline_value',
                label: 'Pipeline Value',
                value: 150000,
                unit: 'currency',
                trend_direction: 'up',
                trend_percentage: 15.5,
              },
            ],
          },
        ],
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.getMetrics();

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/dashboard/metrics',
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include baseline, roles query params and role headers when provided', async () => {
      const mockResponse: DashboardMetricsResponse = {
        last_updated_at: '2026-10-24T12:00:00Z',
        metrics: [],
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.getMetrics({
        baseline: 'prior_quarter',
        roles: 'executive,sales_lead',
        x_user_roles: 'executive,sales_lead',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/dashboard/metrics',
        expect.objectContaining({
          params: {
            baseline: 'prior_quarter',
            roles: 'executive,sales_lead',
          },
          headers: expect.objectContaining({
            'X-User-Roles': 'executive,sales_lead',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should support fetchMetrics alias', async () => {
      const mockResponse: DashboardMetricsResponse = {
        last_updated_at: '2026-10-24T12:00:00Z',
        metrics: [],
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.fetchMetrics({ baseline: 'prior_month' });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/dashboard/metrics',
        expect.objectContaining({
          params: { baseline: 'prior_month' },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('triggerRefresh / refreshMetrics', () => {
    it('should send POST request to /api/v1/dashboard/refresh with optional domains', async () => {
      const mockResponse: DashboardRefreshResponse = {
        status: 'refresh_initiated',
        job_id: 'job-12345',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockResponse);

      const payload = { domains: ['sales', 'leads'] };
      const result = await service.triggerRefresh(payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/dashboard/refresh',
        payload,
        expect.objectContaining({
          params: {},
          headers: {},
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should support refreshMetrics alias and role parameters', async () => {
      const mockResponse: DashboardRefreshResponse = {
        status: 'refresh_initiated',
        job_id: 'job-67890',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockResponse);

      const result = await service.refreshMetrics({}, { roles: 'admin' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/dashboard/refresh',
        {},
        expect.objectContaining({
          params: { roles: 'admin' },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('standalone function exports', () => {
    it('getDashboardMetrics and fetchDashboardMetrics call default singleton instance', async () => {
      const mockResponse: DashboardMetricsResponse = {
        last_updated_at: '2026-10-24T12:00:00Z',
        metrics: [],
      };

      vi.spyOn(dashboardService, 'getMetrics').mockResolvedValueOnce(mockResponse);
      vi.spyOn(dashboardService, 'fetchMetrics').mockResolvedValueOnce(mockResponse);

      const res1 = await getDashboardMetrics({ baseline: 'prior_month' });
      const res2 = await fetchDashboardMetrics({ baseline: 'prior_month' });

      expect(res1).toEqual(mockResponse);
      expect(res2).toEqual(mockResponse);
    });

    it('triggerDashboardRefresh and refreshDashboardMetrics call default singleton instance', async () => {
      const mockResponse: DashboardRefreshResponse = {
        status: 'refresh_initiated',
        job_id: 'job-abc',
      };

      vi.spyOn(dashboardService, 'triggerRefresh').mockResolvedValueOnce(mockResponse);
      vi.spyOn(dashboardService, 'refreshMetrics').mockResolvedValueOnce(mockResponse);

      const res1 = await triggerDashboardRefresh({ domains: ['finance'] });
      const res2 = await refreshDashboardMetrics({ domains: ['finance'] });

      expect(res1).toEqual(mockResponse);
      expect(res2).toEqual(mockResponse);
    });
  });
});
