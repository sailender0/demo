import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { CheckCircle2, XCircle, ExternalLink, Trash2, Github, Loader2 } from "lucide-react";
import type { Integration } from "../../types";

const INTEGRATION_INFO: Record<string, { name: string; description: string; icon: string }> = {
  github: { name: "GitHub", description: "Sync PRs, commits, reviews, and issues via GitHub App installation.", icon: "GH" },
  jira: { name: "Jira", description: "Sync issues, sprints, and worklogs via OAuth 2.0 (3LO).", icon: "JR" },
  teams: { name: "Microsoft Teams", description: "Sync meetings, presence, and calendar via Graph API admin consent.", icon: "TM" },
};

function IntegrationCard({ type, integration, onConnect, onDisconnect }: {
  type: string;
  integration?: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const info = INTEGRATION_INFO[type];
  const connected = integration?.status === "connected";

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
              {info.icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{info.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{info.description}</p>
            </div>
          </div>
          <Badge variant={connected ? "green" : "gray"}>{integration?.status || "disconnected"}</Badge>
        </div>

        {connected && integration?.config && (
          <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            {Object.entries(integration.config).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-medium capitalize">{k.replace(/_/g, " ")}:</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {!connected ? (
            <button
              onClick={onConnect}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Connect
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Disconnect
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: adminApi.getIntegrations,
  });

  const disconnect = useMutation({
    mutationFn: (type: string) => adminApi.disconnectIntegration(type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const integrationMap = Object.fromEntries(integrations.map((i) => [i.type, i]));

  const handleConnect = async (type: string) => {
    let urlData: { url: string };
    if (type === "github") urlData = await adminApi.getGithubInstallUrl();
    else if (type === "jira") urlData = await adminApi.getJiraAuthUrl();
    else urlData = await adminApi.getTeamsConsentUrl();
    window.location.href = urlData.url;
  };

  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Connect once as org admin. All employees will be synced automatically via SSO.
        </p>
      </div>

      <div className="grid gap-4">
        {["github", "jira", "teams"].map((type) => (
          <IntegrationCard
            key={type}
            type={type}
            integration={integrationMap[type]}
            onConnect={() => handleConnect(type)}
            onDisconnect={() => disconnect.mutate(type)}
          />
        ))}
      </div>
    </div>
  );
}
