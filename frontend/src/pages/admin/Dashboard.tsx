import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Users, Link2, AlertTriangle, Activity, CheckCircle2, XCircle } from "lucide-react";
import type { SyncHealth } from "../../types";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function integrationStatusVariant(status: string): "green" | "yellow" | "red" | "gray" {
  if (status === "connected") return "green";
  if (status === "error") return "red";
  return "gray";
}

export function AdminDashboard() {
  const { data: health, isLoading } = useQuery<SyncHealth>({
    queryKey: ["sync-health"],
    queryFn: adminApi.getSyncHealth,
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!health) return null;

  const { identity, integrations } = health;
  const linkRate = identity.total_users > 0
    ? Math.round((identity.linked_users / identity.total_users) * 100)
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time integration health for your tenant</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={identity.total_users} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard label="Identities Linked" value={identity.linked_users} icon={Link2} color="bg-green-50 text-green-600" />
        <StatCard label="Unresolved Mappings" value={identity.unresolved_mappings} icon={AlertTriangle} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Orphaned Events" value={identity.orphaned_events} icon={Activity} color="bg-red-50 text-red-600" />
      </div>

      {/* Identity Link Rate */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Identity Link Rate</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-100 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${linkRate}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-900 w-14 text-right">{linkRate}%</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {identity.linked_users} of {identity.total_users} employees are linked across all integrations
          </p>
        </CardBody>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Integration Status</h2>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {integrations.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400">
              No integrations configured yet.{" "}
              <a href="/admin/integrations" className="text-blue-600 hover:underline">Set them up</a>
            </div>
          )}
          {integrations.map((integration) => (
            <div key={integration.type} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {integration.status === "connected"
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : <XCircle className="w-5 h-5 text-gray-400" />
                }
                <div>
                  <p className="font-medium text-gray-900 capitalize">{integration.type}</p>
                  {integration.last_sync_at && (
                    <p className="text-xs text-gray-500">
                      Last synced {new Date(integration.last_sync_at).toLocaleString()}
                    </p>
                  )}
                  {integration.last_error && (
                    <p className="text-xs text-red-500 mt-0.5">{integration.last_error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration.webhook_active && <Badge variant="blue">Webhooks</Badge>}
                <Badge variant={integrationStatusVariant(integration.status)}>
                  {integration.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
