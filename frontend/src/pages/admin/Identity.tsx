import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { AlertTriangle, CheckCircle2, Link2Off, Search, ChevronDown } from "lucide-react";
import type { IdentityMapping, User } from "../../types";

function confidenceBadge(score: number, status: string): JSX.Element {
  if (status === "AUTO_LINKED" || status === "MANUALLY_LINKED") return <Badge variant="green">{status.replace("_", " ")}</Badge>;
  if (status === "NEEDS_REVIEW") return <Badge variant="yellow">NEEDS REVIEW ({score}%)</Badge>;
  return <Badge variant="red">UNRESOLVED</Badge>;
}

export function IdentityPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: mappings = [], isLoading } = useQuery<IdentityMapping[]>({
    queryKey: ["identity-mappings", filter],
    queryFn: () => adminApi.listMappings(filter === "all" ? undefined : filter),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
  });

  const resolve = useMutation({
    mutationFn: ({ mappingId, userId }: { mappingId: string; userId: string }) =>
      adminApi.resolveMapping(mappingId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identity-mappings"] });
      setResolveId(null);
      setSelectedUserId("");
    },
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "UNRESOLVED", label: "Unresolved" },
    { value: "NEEDS_REVIEW", label: "Needs Review" },
    { value: "AUTO_LINKED", label: "Auto Linked" },
    { value: "MANUALLY_LINKED", label: "Manually Linked" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Identity Mappings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Link external system accounts (GitHub, Jira, Teams) to internal employees.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <CardBody><p className="text-gray-500 text-sm">Loading mappings...</p></CardBody>
        ) : mappings.length === 0 ? (
          <CardBody>
            <div className="text-center py-8 text-gray-400">
              <Link2Off className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No mappings found</p>
            </div>
          </CardBody>
        ) : (
          <div className="divide-y divide-gray-100">
            {mappings.map((m) => (
              <div key={m.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{m.system}</span>
                      <span className="font-medium text-gray-900">{m.external_id}</span>
                    </div>
                    {m.external_email && (
                      <p className="text-sm text-gray-500">{m.external_email}</p>
                    )}
                    {m.match_reasons?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.match_reasons.map((r) => (
                          <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {confidenceBadge(m.confidence_score, m.status)}
                    {(m.status === "UNRESOLVED" || m.status === "NEEDS_REVIEW") && (
                      <button
                        onClick={() => { setResolveId(m.id); setSelectedUserId(""); }}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline resolve form */}
                {resolveId === m.id && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Link to employee</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      >
                        <option value="">Select employee...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      disabled={!selectedUserId || resolve.isPending}
                      onClick={() => resolve.mutate({ mappingId: m.id, userId: selectedUserId })}
                      className="bg-blue-600 text-white py-1.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {resolve.isPending ? "Saving..." : "Link"}
                    </button>
                    <button onClick={() => setResolveId(null)} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
