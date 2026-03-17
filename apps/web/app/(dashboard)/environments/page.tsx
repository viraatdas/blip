import Link from "next/link";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { getUser } from "../../../lib/get-user";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    building: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

export default async function EnvironmentsPage() {
  const user = await getUser();
  const agents = await agentRepo.findAllByUser(user.id);

  // Filter out the hidden default agent
  const environments = agents.filter((a) => a.name !== "__default__");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Environments
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Custom sandbox configurations for advanced use cases
          </p>
        </div>
        <Link
          href="/agents/new"
          className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          New Environment
        </Link>
      </div>

      {environments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 mb-2">No custom environments yet</p>
          <p className="text-xs text-gray-400 mb-6 max-w-sm mx-auto">
            Environments let you customize the sandbox with Dockerfiles, MCP servers, custom instructions, and environment variables. The default environment works out of the box.
          </p>
          <Link
            href="/agents/new"
            className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Create environment
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {environments.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 truncate pr-2">
                  {agent.name}
                </h3>
                <StatusBadge status={agent.template_status} />
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <p>Model: {agent.settings?.model ?? "default"}</p>
                <p>Created: {new Date(agent.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
