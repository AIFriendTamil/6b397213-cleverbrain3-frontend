/**
 * Dashboard API service client wrapper for fetching aggregated operational metrics,
 * calculating baseline trends, and triggering background cache refreshes.
 */

import { apiClient, ApiClient, ApiClientOptions } from '../lib/api_client';

export interface KPIData {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend_direction: 'up' | 'down' | 'flat' | string;
  trend_percentage: number;
}

export interface DomainMetrics {
  domain_name: string;
  display_name: string;
  status: 'active' | 'no_data' | 'error' | 'unconfigured' | string;
  detail_url: string;
  kpis: KPIData[];
}

export interface DashboardMetricsResponse {
  last_updated_at: string;
  metrics: DomainMetrics[];
}

export interface GetMetricsOptions {
  baseline?: string;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

export interface RefreshDashboardRequest {
  domains?: string[];
}

export interface DashboardRefreshResponse {
  status: string;
  job_id: string;
}

export interface RefreshMetricsOptions {
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

export class DashboardService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Retrieve aggregated executive dashboard metrics with optional baseline filtering and role overrides.
   */
  public async getMetrics(
    params?: GetMetricsOptions,
    options?: ApiClientOptions
  ): Promise<DashboardMetricsResponse> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.baseline !== undefined) {
      queryParams.baseline = params.baseline;
    }
    if (params?.roles !== undefined) {
      queryParams.roles = params.roles;
    }

    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (params?.x_user_roles) {
      customHeaders['X-User-Roles'] = params.x_user_roles;
    }
    if (params?.x_user_role) {
      customHeaders['X-User-Role'] = params.x_user_role;
    }

    return this.client.get<DashboardMetricsResponse>('/api/v1/dashboard/metrics', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers: customHeaders,
    });
  }

  /**
   * Alias for getMetrics to fetch dashboard metrics.
   */
  public async fetchMetrics(
    params?: GetMetricsOptions,
    options?: ApiClientOptions
  ): Promise<DashboardMetricsResponse> {
    return this.getMetrics(params, options);
  }

  /**
   * Trigger an immediate background metric cache recalculation task.
   */
  public async triggerRefresh(
    data?: RefreshDashboardRequest,
    params?: RefreshMetricsOptions,
    options?: ApiClientOptions
  ): Promise<DashboardRefreshResponse> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.roles !== undefined) {
      queryParams.roles = params.roles;
    }

    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (params?.x_user_roles) {
      customHeaders['X-User-Roles'] = params.x_user_roles;
    }
    if (params?.x_user_role) {
      customHeaders['X-User-Role'] = params.x_user_role;
    }

    return this.client.post<DashboardRefreshResponse>(
      '/api/v1/dashboard/refresh',
      data || {},
      {
        ...options,
        params: {
          ...queryParams,
          ...(options?.params || {}),
        },
        headers: customHeaders,
      }
    );
  }

  /**
   * Alias for triggerRefresh to refresh dashboard metrics cache.
   */
  public async refreshMetrics(
    data?: RefreshDashboardRequest,
    params?: RefreshMetricsOptions,
    options?: ApiClientOptions
  ): Promise<DashboardRefreshResponse> {
    return this.triggerRefresh(data, params, options);
  }
}

// Default singleton instance
export const dashboardService = new DashboardService();

// Standalone function exports for modular usage
export const getDashboardMetrics = (
  params?: GetMetricsOptions,
  options?: ApiClientOptions
): Promise<DashboardMetricsResponse> => dashboardService.getMetrics(params, options);

export const fetchDashboardMetrics = (
  params?: GetMetricsOptions,
  options?: ApiClientOptions
): Promise<DashboardMetricsResponse> => dashboardService.fetchMetrics(params, options);

export const triggerDashboardRefresh = (
  data?: RefreshDashboardRequest,
  params?: RefreshMetricsOptions,
  options?: ApiClientOptions
): Promise<DashboardRefreshResponse> => dashboardService.triggerRefresh(data, params, options);

export const refreshDashboardMetrics = (
  data?: RefreshDashboardRequest,
  params?: RefreshMetricsOptions,
  options?: ApiClientOptions
): Promise<DashboardRefreshResponse> => dashboardService.refreshMetrics(data, params, options);
