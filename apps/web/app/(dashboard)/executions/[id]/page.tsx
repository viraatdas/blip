import { notFound } from "next/navigation";
import Link from "next/link";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import * as executionEventRepo from "@blip/db/repositories/execution-event-repository";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { getUser } from "../../../../lib/get-user";

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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    result: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-red-50 text-red-700 border-red-200",
    assistant_text: "bg-indigo-50 text-indigo-700 border-indigo-200",
    tool_start: "bg-gray-50 text-gray-600 border-gray-200",
    tool_end: "bg-gray-50 text-gray-600 border-gray-200",
    status: "bg-amber-50 text-amber-700 border-amber-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono border ${colors[type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {type}
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

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ExecutionDetailPage({ params }: Props) {
  const user = await getUser();

  const { id } = await params;
  const execution = await executionRepo.findById(id);

  if (!execution || execution.user_id !== user.id) notFound();

  const [events, agent] = await Promise.all([
    executionEventRepo.findByExecutionId(id),
    execution.agent_id ? agentRepo.findById(execution.agent_id, user.id) : Promise.resolve(null),
  ]);

  // Pull result from events if not on the execution record (async timing issue)
  const resultEvent = events.find((e) => e.event_type === "result");
  const resultText = execution.result_text || (resultEvent?.payload?.result_text as string) || null;
  const costUsd = execution.cost_usd ?? (resultEvent?.payload?.cost_usd as number) ?? null;
  const turns = execution.turns ?? (resultEvent?.payload?.turns as number) ?? null;
  const durationMs = execution.duration_ms ?? (resultEvent?.payload?.duration_ms as number) ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2 inline-block"
        >
          &larr; Back
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Execution
          </h2>
          <StatusBadge status={execution.status} />
        </div>
        <p className="text-xs text-gray-400 mt-1 font-mono select-all">
          {execution.id}
        </p>
      </div>

      {/* Prompt */}
      <div className="mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Prompt</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
            {execution.prompt}
          </p>
        </div>
      </div>

      {/* Result */}
      {resultText && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Result</h3>
          <div className="bg-[#0d1117] rounded-xl p-5">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
              {resultText}
            </pre>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Environment</p>
          <p className="text-sm text-gray-900 font-medium">
            {agent ? (agent.name === "__default__" ? "Default" : agent.name) : "--"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Cost</p>
          <p className="text-sm text-gray-900 font-mono">
            {formatCost(costUsd)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Turns</p>
          <p className="text-sm text-gray-900">
            {turns ?? "--"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Duration</p>
          <p className="text-sm text-gray-900">
            {formatDuration(durationMs)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Created</p>
          <p className="text-sm text-gray-900">
            {new Date(execution.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Event Log */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Event Log ({events.length} events)
        </h3>
        {events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No events recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-400 font-mono w-6 text-right shrink-0">
                      {event.seq}
                    </span>
                    <EventTypeBadge type={event.event_type} />
                    <span className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.payload &&
                    Object.keys(event.payload).length > 0 && (
                      <div className="ml-9 mt-1">
                        <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-all bg-gray-50 rounded-lg p-2 border border-gray-200">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
