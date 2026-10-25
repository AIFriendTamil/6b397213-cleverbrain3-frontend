/**
 * OpenAPI TypeScript client and service bindings for Portal Platform APIs.
 * Includes bindings for Interactive Deal Pipeline Tracking, Lead Acquisition Analytics,
 * Conversion Funnel Metrics, Territory Reporting, Sales Meeting Management, and Campaign Comparison.
 */

import { apiClient, ApiClient, ApiClientOptions } from '../lib/api_client';

// ==========================================
// 1. Feature 004: Deals & Pipeline Tracking
// ==========================================

export interface PipelineFilterParams {
  start_date?: string;
  end_date?: string;
  min_value?: number;
  max_value?: number;
  stage_id?: string;
  team_member_id?: string;
}

export interface StageFunnelMetrics {
  stage_id: string;
  stage_name: string;
  display_order: number;
  deal_count: number;
  total_monetary_value: number;
  average_monetary_value: number;
  average_win_probability: number;
  weighted_monetary_value: number;
  average_deal_age_days: number;
  conversion_rate_from_previous: number;
}

export interface PipelineFunnelSummary {
  total_deals: number;
  total_pipeline_value: number;
  total_weighted_value: number;
  overall_average_win_probability: number;
  overall_average_deal_age_days: number;
  stages: StageFunnelMetrics[];
}

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';

export interface CriticalTaskCreate {
  title: string;
  due_date: string;
  is_critical?: boolean;
}

export interface CriticalTask {
  id: string;
  milestone_id: string;
  title: string;
  due_date: string;
  is_critical: boolean;
  is_overdue: boolean;
  escalated_to_supervisor: boolean;
  escalated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MilestoneCreate {
  title: string;
  target_date: string;
  status?: MilestoneStatus;
}

export interface MilestoneUpdate {
  title?: string;
  target_date?: string;
  completed_date?: string | null;
  status?: MilestoneStatus;
}

export interface Milestone {
  id: string;
  deal_id: string;
  title: string;
  target_date: string;
  completed_date?: string | null;
  status: MilestoneStatus;
  color_code?: string | null;
  critical_tasks: CriticalTask[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StakeholderCreate {
  name: string;
  org_role: string;
  contact_email: string;
  parent_stakeholder_id?: string | null;
}

export interface StakeholderNode {
  id: string;
  name: string;
  org_role: string;
  contact_email: string;
  email?: string | null;
  deal_id: string;
  parent_stakeholder_id?: string | null;
  subordinate_ids: string[];
}

export interface StakeholderEdge {
  source_id: string;
  target_id: string;
  relationship_type: string;
  is_cycle_edge: boolean;
}

export interface StakeholderGraphResponse {
  deal_id: string;
  nodes: StakeholderNode[];
  edges: StakeholderEdge[];
  dag_edges: StakeholderEdge[];
  has_cycles: boolean;
  detected_cycles: string[][];
  root_stakeholder_ids: string[];
}

export interface ForecastRequestPayload {
  deal_id?: string;
  include_milestones?: boolean;
}

export interface MilestoneForecastEstimate {
  milestone_id: string;
  milestone_title?: string | null;
  estimated_completion_date: string;
  confidence_score: number;
}

export interface DealForecastResponse {
  deal_id: string;
  predicted_close_date: string;
  confidence_score: number;
  milestone_estimates: MilestoneForecastEstimate[];
  is_fallback: boolean;
  model_version?: string | null;
  details?: Record<string, unknown>;
}

export interface DealCreate {
  title: string;
  monetary_value?: number;
  stage_id: string;
  assigned_team_member_id?: string | null;
  win_probability?: number;
}

export interface DealUpdate {
  title?: string;
  monetary_value?: number;
  stage_id?: string;
  assigned_team_member_id?: string | null;
  win_probability?: number;
}

export interface Deal {
  id: string;
  title: string;
  monetary_value: number;
  stage_id: string;
  assigned_team_member_id?: string | null;
  win_probability: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export class DealsApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getFunnel(
    params?: PipelineFilterParams,
    options?: ApiClientOptions
  ): Promise<PipelineFunnelSummary> {
    return this.client.get<PipelineFunnelSummary>('/api/v1/deals/funnel', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async getDeals(
    params?: PipelineFilterParams,
    options?: ApiClientOptions
  ): Promise<Deal[]> {
    return this.client.get<Deal[]>('/api/v1/deals', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async createDeal(
    payload: DealCreate,
    options?: ApiClientOptions
  ): Promise<Deal> {
    return this.client.post<Deal>('/api/v1/deals', payload, options);
  }

  public async getDeal(
    dealId: string,
    options?: ApiClientOptions
  ): Promise<Deal> {
    return this.client.get<Deal>(`/api/v1/deals/${encodeURIComponent(dealId)}`, options);
  }

  public async updateDeal(
    dealId: string,
    payload: DealUpdate,
    options?: ApiClientOptions
  ): Promise<Deal> {
    return this.client.put<Deal>(`/api/v1/deals/${encodeURIComponent(dealId)}`, payload, options);
  }

  public async deleteDeal(
    dealId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    await this.client.delete<void>(`/api/v1/deals/${encodeURIComponent(dealId)}`, options);
  }

  public async transitionStage(
    dealId: string,
    targetStageId: string,
    options?: ApiClientOptions
  ): Promise<Deal> {
    return this.client.post<Deal>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/stage`,
      { target_stage_id: targetStageId },
      options
    );
  }

  public async getMilestones(
    dealId: string,
    options?: ApiClientOptions
  ): Promise<Milestone[]> {
    return this.client.get<Milestone[]>(`/api/v1/deals/${encodeURIComponent(dealId)}/milestones`, options);
  }

  public async createMilestone(
    dealId: string,
    payload: MilestoneCreate,
    options?: ApiClientOptions
  ): Promise<Milestone> {
    return this.client.post<Milestone>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/milestones`,
      payload,
      options
    );
  }

  public async updateMilestone(
    dealId: string,
    milestoneId: string,
    payload: MilestoneUpdate,
    options?: ApiClientOptions
  ): Promise<Milestone> {
    return this.client.put<Milestone>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/milestones/${encodeURIComponent(milestoneId)}`,
      payload,
      options
    );
  }

  public async createCriticalTask(
    dealId: string,
    milestoneId: string,
    payload: CriticalTaskCreate,
    options?: ApiClientOptions
  ): Promise<CriticalTask> {
    return this.client.post<CriticalTask>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/milestones/${encodeURIComponent(milestoneId)}/critical-tasks`,
      payload,
      options
    );
  }

  public async getStakeholders(
    dealId: string,
    options?: ApiClientOptions
  ): Promise<StakeholderGraphResponse> {
    return this.client.get<StakeholderGraphResponse>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/stakeholders`,
      options
    );
  }

  public async createStakeholder(
    dealId: string,
    payload: StakeholderCreate,
    options?: ApiClientOptions
  ): Promise<StakeholderNode> {
    return this.client.post<StakeholderNode>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/stakeholders`,
      payload,
      options
    );
  }

  public async getForecast(
    dealId: string,
    payload?: ForecastRequestPayload,
    options?: ApiClientOptions
  ): Promise<DealForecastResponse> {
    return this.client.post<DealForecastResponse>(
      `/api/v1/deals/${encodeURIComponent(dealId)}/forecast`,
      payload || { deal_id: dealId, include_milestones: true },
      options
    );
  }
}

export const dealsApiService = new DealsApiService();

export const getPipelineFunnel = (
  params?: PipelineFilterParams,
  options?: ApiClientOptions
): Promise<PipelineFunnelSummary> => dealsApiService.getFunnel(params, options);

export const getDeals = (
  params?: PipelineFilterParams,
  options?: ApiClientOptions
): Promise<Deal[]> => dealsApiService.getDeals(params, options);

export const createDeal = (
  payload: DealCreate,
  options?: ApiClientOptions
): Promise<Deal> => dealsApiService.createDeal(payload, options);

export const getDeal = (
  dealId: string,
  options?: ApiClientOptions
): Promise<Deal> => dealsApiService.getDeal(dealId, options);

export const updateDeal = (
  dealId: string,
  payload: DealUpdate,
  options?: ApiClientOptions
): Promise<Deal> => dealsApiService.updateDeal(dealId, payload, options);

export const deleteDeal = (
  dealId: string,
  options?: ApiClientOptions
): Promise<void> => dealsApiService.deleteDeal(dealId, options);

export const transitionDealStage = (
  dealId: string,
  targetStageId: string,
  options?: ApiClientOptions
): Promise<Deal> => dealsApiService.transitionStage(dealId, targetStageId, options);

export const getDealMilestones = (
  dealId: string,
  options?: ApiClientOptions
): Promise<Milestone[]> => dealsApiService.getMilestones(dealId, options);

export const createMilestone = (
  dealId: string,
  payload: MilestoneCreate,
  options?: ApiClientOptions
): Promise<Milestone> => dealsApiService.createMilestone(dealId, payload, options);

export const updateMilestone = (
  dealId: string,
  milestoneId: string,
  payload: MilestoneUpdate,
  options?: ApiClientOptions
): Promise<Milestone> => dealsApiService.updateMilestone(dealId, milestoneId, payload, options);

export const createCriticalTask = (
  dealId: string,
  milestoneId: string,
  payload: CriticalTaskCreate,
  options?: ApiClientOptions
): Promise<CriticalTask> => dealsApiService.createCriticalTask(dealId, milestoneId, payload, options);

export const getStakeholders = (
  dealId: string,
  options?: ApiClientOptions
): Promise<StakeholderGraphResponse> => dealsApiService.getStakeholders(dealId, options);

export const createStakeholder = (
  dealId: string,
  payload: StakeholderCreate,
  options?: ApiClientOptions
): Promise<StakeholderNode> => dealsApiService.createStakeholder(dealId, payload, options);

export const getForecast = (
  dealId: string,
  payload?: ForecastRequestPayload,
  options?: ApiClientOptions
): Promise<DealForecastResponse> => dealsApiService.getForecast(dealId, payload, options);

// =========================================================================
// 2. Feature 005: Lead Acquisition, Funnel Analytics & Campaign Comparison
// =========================================================================

// --- Acquisition Types ---

export interface AcquisitionFilterParams {
  start_timestamp?: string;
  end_timestamp?: string;
  source_id?: string;
  region_name?: string;
  campaign_id?: string;
}

export interface SourceROIMetrics {
  source_id: string;
  source_name: string;
  total_leads: number;
  average_quality_score: number;
  total_spend: number;
  attributed_revenue: number;
  calculated_roi_percentage: number;
}

export interface AcquisitionSummary {
  total_sources: number;
  total_leads: number;
  overall_average_quality_score: number;
  total_spend: number;
  total_attributed_revenue: number;
  overall_roi_percentage: number;
  sources: SourceROIMetrics[];
}

// --- Funnel Types ---

export interface FunnelFilterParams {
  start_timestamp?: string;
  end_timestamp?: string;
  source_id?: string;
}

export interface FunnelStageMetrics {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  lead_count: number;
  conversion_rate_percentage: number;
  target_conversion_rate: number;
  is_bottleneck: boolean;
}

export interface StageLeadFilterParams {
  page?: number;
  limit?: number;
}

export interface StageLeadDetail {
  lead_id: string;
  source_id: string;
  campaign_id?: string | null;
  quality_score: number;
  status_stage: string;
  region_name: string;
  state_code?: string | null;
  postal_code?: string | null;
  deal_value: number;
  created_timestamp: string;
  time_in_stage_days: number;
}

export interface StageLeadDrillDownResponse {
  stage_id: string;
  stage_name: string;
  total_leads: number;
  page: number;
  limit: number;
  leads: StageLeadDetail[];
}

// --- Territory Types ---

export interface TerritoryFilterParams {
  region_name?: string;
  min_deal_size?: number;
  min_quality_score?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  source_id?: string;
  campaign_id?: string;
}

export interface TerritoryDensityMetrics {
  region_name: string;
  opportunity_count: number;
  total_deal_value: number;
  average_quality_score: number;
  density_score: number;
  latitude: number;
  longitude: number;
}

// --- Meetings Types ---

export interface MeetingFilterParams {
  start_timestamp?: string;
  end_timestamp?: string;
  lead_id?: string;
}

export interface MeetingEvent {
  event_id: string;
  meeting_id?: string | null;
  lead_id?: string | null;
  title: string;
  start_timestamp: string;
  end_timestamp: string;
  description?: string | null;
  location?: string | null;
  status: string;
  is_external: boolean;
  is_fallback: boolean;
  details?: Record<string, unknown> | null;
}

export interface MeetingCreate {
  title: string;
  start_timestamp: string;
  end_timestamp: string;
  lead_id?: string | null;
  description?: string | null;
  location?: string | null;
}

export interface MeetingBrief {
  brief_id: string;
  meeting_id: string;
  lead_id: string;
  quality_score: number;
  interaction_history_summary: string;
  key_discussion_notes: string;
  brief_summary_text: string;
  created_timestamp: string;
}

// --- Campaign Types ---

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  budget_amount: number;
  spent_amount: number;
  start_timestamp?: string | null;
  end_timestamp?: string | null;
  created_timestamp: string;
}

export interface CampaignCompareParams {
  campaign_ids?: string[] | string;
  start_timestamp?: string;
  end_timestamp?: string;
}

export interface CampaignComparisonItem {
  campaign_id: string;
  campaign_name: string;
  budget_amount: number;
  spent_amount: number;
  leads_generated: number;
  average_quality_score: number;
  converted_leads: number;
  overall_conversion_rate: number;
  attributed_revenue: number;
  total_roi_percentage: number;
  cost_per_lead: number;
  cost_per_conversion: number;
  start_timestamp?: string | null;
  end_timestamp?: string | null;
}

export interface CampaignComparisonSummary {
  total_campaigns_compared: number;
  best_roi_campaign_id?: string | null;
  best_roi_campaign_name?: string | null;
  best_conversion_campaign_id?: string | null;
  best_conversion_campaign_name?: string | null;
  highest_lead_volume_campaign_id?: string | null;
  highest_lead_volume_campaign_name?: string | null;
  total_spend_across_campaigns: number;
  total_revenue_across_campaigns: number;
  total_leads_across_campaigns: number;
  average_roi_percentage: number;
}

export interface CampaignComparisonMatrix {
  campaigns: CampaignComparisonItem[];
  summary: CampaignComparisonSummary;
}

// --- Service Classes ---

export class AcquisitionApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getSources(
    params?: AcquisitionFilterParams,
    options?: ApiClientOptions
  ): Promise<SourceROIMetrics[]> {
    return this.client.get<SourceROIMetrics[]>('/api/v1/acquisition/sources', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async getSummary(
    options?: ApiClientOptions
  ): Promise<AcquisitionSummary> {
    return this.client.get<AcquisitionSummary>('/api/v1/acquisition/summary', options);
  }

  public async getSourceById(
    sourceId: string,
    options?: ApiClientOptions
  ): Promise<SourceROIMetrics> {
    return this.client.get<SourceROIMetrics>(
      `/api/v1/acquisition/sources/${encodeURIComponent(sourceId)}`,
      options
    );
  }
}

export class FunnelApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getStages(
    params?: FunnelFilterParams,
    options?: ApiClientOptions
  ): Promise<FunnelStageMetrics[]> {
    return this.client.get<FunnelStageMetrics[]>('/api/v1/funnel/stages', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async getBottlenecks(
    options?: ApiClientOptions
  ): Promise<FunnelStageMetrics[]> {
    return this.client.get<FunnelStageMetrics[]>('/api/v1/funnel/bottlenecks', options);
  }

  public async getStageById(
    stageId: string,
    options?: ApiClientOptions
  ): Promise<FunnelStageMetrics> {
    return this.client.get<FunnelStageMetrics>(
      `/api/v1/funnel/stages/${encodeURIComponent(stageId)}`,
      options
    );
  }

  public async getStageLeads(
    stageId: string,
    params?: StageLeadFilterParams,
    options?: ApiClientOptions
  ): Promise<StageLeadDrillDownResponse> {
    return this.client.get<StageLeadDrillDownResponse>(
      `/api/v1/funnel/stages/${encodeURIComponent(stageId)}/leads`,
      {
        ...options,
        params: {
          ...(params as Record<string, string | number | boolean | undefined | null>),
          ...(options?.params || {}),
        },
      }
    );
  }
}

export class TerritoryApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getHeatmap(
    params?: TerritoryFilterParams,
    options?: ApiClientOptions
  ): Promise<TerritoryDensityMetrics[]> {
    return this.client.get<TerritoryDensityMetrics[]>('/api/v1/territory/heatmap', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async getUnmapped(
    options?: ApiClientOptions
  ): Promise<TerritoryDensityMetrics> {
    return this.client.get<TerritoryDensityMetrics>('/api/v1/territory/unmapped', options);
  }
}

export class MeetingsApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getMeetings(
    params?: MeetingFilterParams,
    options?: ApiClientOptions
  ): Promise<MeetingEvent[]> {
    return this.client.get<MeetingEvent[]>('/api/v1/meetings', {
      ...options,
      params: {
        ...(params as Record<string, string | number | boolean | undefined | null>),
        ...(options?.params || {}),
      },
    });
  }

  public async createMeeting(
    payload: MeetingCreate,
    options?: ApiClientOptions
  ): Promise<MeetingEvent> {
    return this.client.post<MeetingEvent>('/api/v1/meetings', payload, options);
  }

  public async getMeetingById(
    meetingId: string,
    options?: ApiClientOptions
  ): Promise<MeetingEvent> {
    return this.client.get<MeetingEvent>(
      `/api/v1/meetings/${encodeURIComponent(meetingId)}`,
      options
    );
  }

  public async getMeetingBrief(
    meetingId: string,
    options?: ApiClientOptions
  ): Promise<MeetingBrief> {
    return this.client.get<MeetingBrief>(
      `/api/v1/meetings/${encodeURIComponent(meetingId)}/brief`,
      options
    );
  }
}

export class CampaignsApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  public async getCampaigns(
    options?: ApiClientOptions
  ): Promise<Campaign[]> {
    return this.client.get<Campaign[]>('/api/v1/campaigns', options);
  }

  public async compareCampaigns(
    params?: CampaignCompareParams,
    options?: ApiClientOptions
  ): Promise<CampaignComparisonMatrix> {
    let queryParams: Record<string, string | number | boolean | undefined | null> | undefined;
    if (params) {
      const { campaign_ids, start_timestamp, end_timestamp } = params;
      let idsVal: string | undefined;
      if (Array.isArray(campaign_ids)) {
        idsVal = campaign_ids.join(',');
      } else if (typeof campaign_ids === 'string') {
        idsVal = campaign_ids;
      }
      queryParams = {
        ...(idsVal ? { campaign_ids: idsVal } : {}),
        ...(start_timestamp ? { start_timestamp } : {}),
        ...(end_timestamp ? { end_timestamp } : {}),
      };
    }

    return this.client.get<CampaignComparisonMatrix>('/api/v1/campaigns/compare', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
    });
  }

  public async getCampaignById(
    campaignId: string,
    options?: ApiClientOptions
  ): Promise<Campaign> {
    return this.client.get<Campaign>(
      `/api/v1/campaigns/${encodeURIComponent(campaignId)}`,
      options
    );
  }
}

// Singleton instances
export const acquisitionApiService = new AcquisitionApiService();
export const funnelApiService = new FunnelApiService();
export const territoryApiService = new TerritoryApiService();
export const meetingsApiService = new MeetingsApiService();
export const campaignsApiService = new CampaignsApiService();

// Standalone function exports
export const getAcquisitionSources = (
  params?: AcquisitionFilterParams,
  options?: ApiClientOptions
): Promise<SourceROIMetrics[]> => acquisitionApiService.getSources(params, options);

export const getAcquisitionSummary = (
  options?: ApiClientOptions
): Promise<AcquisitionSummary> => acquisitionApiService.getSummary(options);

export const getAcquisitionSourceById = (
  sourceId: string,
  options?: ApiClientOptions
): Promise<SourceROIMetrics> => acquisitionApiService.getSourceById(sourceId, options);

export const getFunnelStages = (
  params?: FunnelFilterParams,
  options?: ApiClientOptions
): Promise<FunnelStageMetrics[]> => funnelApiService.getStages(params, options);

export const getFunnelBottlenecks = (
  options?: ApiClientOptions
): Promise<FunnelStageMetrics[]> => funnelApiService.getBottlenecks(options);

export const getFunnelStageById = (
  stageId: string,
  options?: ApiClientOptions
): Promise<FunnelStageMetrics> => funnelApiService.getStageById(stageId, options);

export const getFunnelStageLeads = (
  stageId: string,
  params?: StageLeadFilterParams,
  options?: ApiClientOptions
): Promise<StageLeadDrillDownResponse> => funnelApiService.getStageLeads(stageId, params, options);

export const getTerritoryHeatmap = (
  params?: TerritoryFilterParams,
  options?: ApiClientOptions
): Promise<TerritoryDensityMetrics[]> => territoryApiService.getHeatmap(params, options);

export const getUnmappedTerritory = (
  options?: ApiClientOptions
): Promise<TerritoryDensityMetrics> => territoryApiService.getUnmapped(options);

export const getScheduledMeetings = (
  params?: MeetingFilterParams,
  options?: ApiClientOptions
): Promise<MeetingEvent[]> => meetingsApiService.getMeetings(params, options);

export const createScheduledMeeting = (
  payload: MeetingCreate,
  options?: ApiClientOptions
): Promise<MeetingEvent> => meetingsApiService.createMeeting(payload, options);

export const getScheduledMeetingById = (
  meetingId: string,
  options?: ApiClientOptions
): Promise<MeetingEvent> => meetingsApiService.getMeetingById(meetingId, options);

export const getMeetingBrief = (
  meetingId: string,
  options?: ApiClientOptions
): Promise<MeetingBrief> => meetingsApiService.getMeetingBrief(meetingId, options);

export const getCampaigns = (
  options?: ApiClientOptions
): Promise<Campaign[]> => campaignsApiService.getCampaigns(options);

export const compareCampaigns = (
  params?: CampaignCompareParams,
  options?: ApiClientOptions
): Promise<CampaignComparisonMatrix> => campaignsApiService.compareCampaigns(params, options);

export const getCampaignById = (
  campaignId: string,
  options?: ApiClientOptions
): Promise<Campaign> => campaignsApiService.getCampaignById(campaignId, options);
