import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { employeeApi } from "../../api/client";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { GitPullRequest, GitCommit, MessageSquare, Calendar, Activity } from "lucide-react";

const EVENT_ICONS: Record<string, React.ElementType> = {
  PR_OPENED: GitPullRequest,
  PR_MERGED: GitPullRequest,
  PR_REVIEWED: MessageSquare,
  COMMIT_PUSHED: GitCommit,
  MEETING_ATTENDED: Calendar,
  MEETING_STARTED: Calendar,
  ISSUE_CREATED: Activity,
  ISSUE_UPDATED: Activity,
};

const SOURCE_COLORS: Record<string, string> = {
  github: "#1a1a2e",
  jira: "#0052cc",
  teams: "#5558af",
};

export function EmployeeDashboard() {
  const [days, setDays] = useState(30);

  const { data: summary } = useQuery({
    queryKey: ["activity-summary", days],
    queryFn: () => employeeApi.getActivitySummary(days),
  });

  const { data: activity } = useQuery({
    queryKey: ["activity", days],
    queryFn: () => employeeApi.getActivity(days),
  });

  const { data: profile } = useQuery({
    queryKey: ["employee-profile"],
    queryFn: employeeApi.getProfile,
  });

  // Build chart data from summary
  const chartData = summary
    ? Object.entries(summary.summary as Record<string, Record<string, number>>).flatMap(([source, events]) =>
        Object.entries(events).map(([type, count]) => ({ name: type.replace(/_/g, " "), count, source }))
      )
    : [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Activity</h1>
          <p className="text-gray-500 text-sm mt-1">Your work across all connected platforms</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Linked systems */}
      {profile && (
        <div className="flex gap-2 flex-wrap">
          {profile.linked_systems.map((sys: any) => (
            <div key={sys.system} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1">
              <span className="text-xs font-semibold uppercase text-gray-400">{sys.system}</span>
              <span className="text-sm text-gray-700">{sys.external_id}</span>
              <Badge variant={sys.status === "AUTO_LINKED" || sys.status === "MANUALLY_LINKED" ? "green" : "yellow"}>
                {sys.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
          {profile.linked_systems.length === 0 && (
            <p className="text-sm text-gray-400">No accounts linked yet. Ask your admin to configure integrations.</p>
          )}
        </div>
      )}

      {/* Activity chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Activity Breakdown</h2>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={SOURCE_COLORS[entry.source] || "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Recent events */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
        </CardHeader>
        {!activity || activity.events.length === 0 ? (
          <CardBody>
            <p className="text-gray-400 text-sm text-center py-6">No activity found for this period</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-gray-100">
            {activity.events.slice(0, 50).map((event: any) => {
              const Icon = EVENT_ICONS[event.event_type] || Activity;
              return (
                <div key={event.id} className="px-6 py-3 flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${SOURCE_COLORS[event.source]}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: SOURCE_COLORS[event.source] }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      <Badge variant="gray">{event.source}</Badge>
                    </div>
                    {event.data.title && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{event.data.title as string}</p>
                    )}
                    {event.data.repo && (
                      <p className="text-xs text-gray-400">{event.data.repo as string}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(event.occurred_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
