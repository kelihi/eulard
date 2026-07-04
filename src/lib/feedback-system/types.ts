/**
 * TypeScript types matching feedback_system's client API responses.
 * These mirror the Pydantic schemas in feedback_system/backend/app/routers/clients.py
 */

export interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
}

export interface ToolSummary {
  id: number;
  name: string;
  category: string | null;
}

export interface DomainSummary {
  id: number;
  name: string;
}

export interface SourceSystemSummary {
  id: number;
  name: string;
  description: string | null;
}

export interface ClientResponse {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  engagement_type: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  start_date: string | null;
  clickup_folder_id: string | null;
  internal_slack_channel_id: string | null;
  external_slack_channel_id: string | null;
  notion_page_url: string | null;
  account_owner: PersonSummary | null;
  tools: ToolSummary[];
  domains: DomainSummary[];
  source_systems: SourceSystemSummary[];
  team_members: PersonSummary[];
  created_at: string;
  updated_at: string | null;
}

export interface ClientListResponse {
  items: ClientResponse[];
  total: number;
  offset: number;
  limit: number;
}
