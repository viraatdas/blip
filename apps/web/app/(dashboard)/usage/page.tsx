import * as executionRepo from "@blip/db/repositories/execution-repository";
import { getUser } from "../../../lib/get-user";

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}

export default async function UsagePage() {
  const user = await getUser();

  // Fetch all executions for usage calculations
  const executions = await executionRepo.findAllByUser(user.id, { limit: 1000 });

  // Calculate summary stats
  const totalExecutions = executions.length;
  const totalCost = executions.reduce(
    (sum, e) => sum + (e.cost_usd ?? 0),
    0,
  );
  const totalDuration = executions.reduce(
    (sum, e) => sum + (e.duration_ms ?? 0),
    0,
  );

  // This month's stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthExecutions = executions.filter(
    (e) => new Date(e.created_at) >= startOfMonth,
  );
  const thisMonthCost = thisMonthExecutions.reduce(
    (sum, e) => sum + (e.cost_usd ?? 0),
    0,
  );
  const thisMonthCount = thisMonthExecutions.length;

  // Daily usage for the last 14 days (CSS-based bar chart)
  const dailyUsage: { date: string; cost: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayExecs = executions.filter(
      (e) => e.created_at.slice(0, 10) === dateStr,
    );
    dailyUsage.push({
      date: dateStr,
      cost: dayExecs.reduce((sum, e) => sum + (e.cost_usd ?? 0), 0),
      count: dayExecs.length,
    });
  }

  const maxDailyCost = Math.max(...dailyUsage.map((d) => d.cost), 0.01);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Usage
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Track your execution costs and activity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Executions</p>
          <p className="text-2xl font-bold text-gray-900">{totalExecutions}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">
            {formatCost(totalCost)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">This Month</p>
          <p className="text-2xl font-bold text-gray-900">
            {thisMonthCount}{" "}
            <span className="text-sm font-normal text-gray-500">
              executions
            </span>
          </p>
          <p className="text-sm text-gray-500 font-mono mt-0.5">
            {formatCost(thisMonthCost)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">Total Compute Time</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatDuration(totalDuration)}
          </p>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Daily Cost (Last 14 Days)
        </h3>
        <div className="flex items-end gap-1 h-40">
          {dailyUsage.map((day) => {
            const heightPercent =
              maxDailyCost > 0 ? (day.cost / maxDailyCost) * 100 : 0;
            const barHeight = Math.max(heightPercent, day.count > 0 ? 4 : 0);

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end h-full group"
              >
                {/* Tooltip */}
                <div className="hidden group-hover:block absolute -mt-16 bg-gray-900 text-white rounded-lg px-2 py-1 text-xs z-10 whitespace-nowrap shadow-lg">
                  <p>{formatCost(day.cost)}</p>
                  <p className="text-gray-400">
                    {day.count} exec{day.count !== 1 ? "s" : ""}
                  </p>
                </div>
                {/* Bar */}
                <div
                  className="w-full rounded-t bg-indigo-500 hover:bg-indigo-600 transition-colors min-h-0"
                  style={{ height: `${barHeight}%` }}
                />
                {/* Date label */}
                <p className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-top-left w-0">
                  {day.date.slice(5)}
                </p>
              </div>
            );
          })}
        </div>
        {/* X-axis line */}
        <div className="border-t border-gray-200 mt-6" />
      </div>
    </div>
  );
}
