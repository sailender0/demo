import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface LogEntry {
  source: string;
  delivery_id: string;
  event_name: string;
  status: string;
  received_at: string;
  error: string | null;
}

function statusBadge(s: string) {
  if (s === "processed") return <Badge variant="green">processed</Badge>;
  if (s === "failed") return <Badge variant="red">failed</Badge>;
  if (s === "duplicate") return <Badge variant="gray">duplicate</Badge>;
  return <Badge variant="blue">received</Badge>;
}

export function SyncHealthPage() {
  const { data: health } = useQuery({
    queryKey: ["sync-health"],
    queryFn: adminApi.getSyncHealth,
    refetchInterval: 15_000,
  });

  const { data: logs = [] } = useQuery<LogEntry[]>({
    queryKey: ["sync-logs"],
    queryFn: adminApi.getSyncLogs,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sync Health</h1>
        <p className="text-gray-500 text-sm mt-1">Live view of integration sync status and webhook delivery</p>
      </div>

      {/* Integration status cards */}
      {health && (
        <div className="grid gap-4 md:grid-cols-3">
          {health.integrations.map((integration: any) => (
            <Card key={integration.type}>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900 capitalize">{integration.type}</span>
                  {integration.status === "connected"
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <XCircle className="w-5 h-5 text-gray-400" />
                  }
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <Badge variant={integration.status === "connected" ? "green" : "gray"}>{integration.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Webhooks</span>
                    <Badge variant={integration.webhook_active ? "blue" : "gray"}>
                      {integration.webhook_active ? "active" : "inactive"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Last sync</span>
                    <span className="text-gray-700 text-xs">
                      {integration.last_sync_at
                        ? new Date(integration.last_sync_at).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                </div>
                {integration.last_error && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    {integration.last_error}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Webhook delivery log */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Webhook Delivery Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">Last 100 deliveries</p>
        </CardHeader>
        {logs.length === 0 ? (
          <CardBody>
            <p className="text-gray-400 text-sm text-center py-6">No webhook deliveries yet</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Source", "Event", "Status", "Received"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.delivery_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="font-medium capitalize text-gray-900">{log.source}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{log.event_name}</td>
                    <td className="px-4 py-2.5">{statusBadge(log.status)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {new Date(log.received_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
