import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Search } from "lucide-react";
import { useState } from "react";
import type { User } from "../../types";

export function UsersPage() {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleVariant = (role: string): "blue" | "yellow" | "green" | "gray" => {
    if (role === "admin") return "blue";
    if (role === "manager") return "yellow";
    if (role === "hr") return "green";
    return "gray";
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">{users.length} employees in your organization</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 text-gray-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Name", "Department", "Role", "Type", "Source", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.department || "—"}</td>
                    <td className="px-4 py-3"><Badge variant={roleVariant(u.role)}>{u.role}</Badge></td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{u.employee_type}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{u.provisioning_source}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "green" : "gray"}>{u.is_active ? "active" : "inactive"}</Badge>
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
