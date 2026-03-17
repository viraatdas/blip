import Link from "next/link";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import { getUser } from "../../lib/get-user";

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

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default async function DashboardPage() {
  const user = await getUser();
  const executions = await executionRepo.findAllByUser(user.id, { limit: 10 });

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Run Claude Code via API
        </p>
      </div>

      {executions.length === 0 ? (
        /* Empty state — get started */
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Welcome to Blip</h3>
            <p className="text-sm text-gray-500 mb-2 max-w-md mx-auto">
              Run Claude Code in secure sandboxes via a simple API. Get started in two steps:
            </p>
            <div className="flex items-center justify-center gap-8 mt-6 mb-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-medium">1</span>
                <Link href="/api-keys" className="hover:text-indigo-600 transition-colors">Create an API key</Link>
              </div>
              <div className="text-gray-300">&rarr;</div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-medium">2</span>
                <span>Send a prompt</span>
              </div>
            </div>
            <Link
              href="/api-keys"
              className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Create API Key
            </Link>
          </div>

          {/* Quick start snippet */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 pt-4 pb-3 bg-white">
              <h3 className="text-sm font-semibold text-gray-900">Quick start</h3>
              <p className="text-xs text-gray-500 mt-0.5">Create an API key, then run this:</p>
            </div>
            <div className="bg-[#0d1117] overflow-x-auto">
              <pre className="px-5 py-4 text-[13px] leading-[1.6] font-mono text-gray-300">
<span className="text-[#7ee787]">curl</span>{" "}<span className="text-[#79c0ff]">-X POST</span>{" "}<span className="text-[#a5d6ff]">https://blip.exla.ai/api/v1/executions</span>{" \\\n  "}<span className="text-[#79c0ff]">-H</span>{" "}<span className="text-[#a5d6ff]">&quot;Authorization: Bearer <span className="text-[#ffa657]">YOUR_API_KEY</span>&quot;</span>{" \\\n  "}<span className="text-[#79c0ff]">-H</span>{" "}<span className="text-[#a5d6ff]">&quot;Content-Type: application/json&quot;</span>{" \\\n  "}<span className="text-[#79c0ff]">-d</span>{" "}<span className="text-[#a5d6ff]">&apos;{"{\n    "}<span className="text-[#79c0ff]">&quot;prompt&quot;</span>: <span className="text-[#a5d6ff]">&quot;Go to github.com/openclaw/openclaw,{"\n               "}pick up the latest issue, and open a PR with the fix&quot;</span>{"\n  }"}&apos;</span>
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* Has executions — show recent list */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Recent executions</h3>
            <Link
              href="/executions"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              View all
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prompt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                    <td className="px-4 py-3 max-w-sm">
                      <Link
                        href={`/executions/${exec.id}`}
                        className="text-gray-900 hover:text-indigo-600 font-medium"
                      >
                        {truncate(exec.prompt, 80)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={exec.status} />
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
        </div>
      )}
    </div>
  );
}
