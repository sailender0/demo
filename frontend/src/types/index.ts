export interface User {
  id: string;
  email: string;
  name: string;
  department: string | null;
  job_title: string | null;
  employee_type: "employee" | "contractor";
  tenant_id: string;
}

export interface Integration {
  type: "github" | "jira" | "teams";
  status: "connected" | "disconnected" | "error";
  config: Record<string, string>;
  last_sync_at: string | null;
  last_error: string | null;
  webhook_active: boolean;
}

export interface IdentityMapping {
  id: string;
  system: "github" | "jira" | "teams";
  external_id: string;
  external_email: string | null;
  external_name: string | null;
  user_id: string | null;
  confidence_score: number;
  status: "AUTO_LINKED" | "NEEDS_REVIEW" | "MANUALLY_LINKED" | "UNRESOLVED";
  match_reasons: string[];
}

export interface NormalizedEvent {
  id: string;
  source: "github" | "jira" | "teams";
  event_type: string;
  category: string;
  data: Record<string, unknown>;
  occurred_at: string;
}

export interface SyncHealth {
  identity: {
    total_users: number;
    linked_users: number;
    unresolved_mappings: number;
    orphaned_events: number;
  };
  integrations: Integration[];
}
