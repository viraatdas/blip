import Link from "next/link";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { getUser } from "../../../lib/get-user";
import ExecutionsFilter from "./executions-filter";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-gray-100 text-gray-600",
    running: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCost(cost: number | null): string {
  if (cost === null) return "--";
  return `$${cost.toFixed(4)}`;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

type Props = {
  searchParams: Promise<{ agent_id?: string }>;
};

export default async function ExecutionsPage({ searchParams }: Props) {
  const user = await getUser();

  const params = await searchParams;
  const agentId = params.agent_id;

  const [executions, agents] = await Promise.all([
    executionRepo.findAllByUser(user.id, {
      agent_id: agentId,
      limit: 50,
    }),
    agentRepo.findAllByUser(user.id),
  ]);

  // Build a map of agent ID -> name for display
  const agentNames = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Executions
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            View your agent execution history
          </p>
        </div>
      </div>

      {/* Filter */}
      <ExecutionsFilter
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        currentAgentId={agentId}
      />

      {executions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No executions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prompt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/executions/${exec.id}`}
                      className="text-gray-900 hover:text-indigo-600 font-medium"
                    >
                      {exec.agent_id ? (agentNames.get(exec.agent_id) ?? "Unknown") : "Default"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs">
                    <Link href={`/executions/${exec.id}`}>
                      {truncate(exec.prompt, 60)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={exec.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {formatCost(exec.cost_usd)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDuration(exec.duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(exec.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
