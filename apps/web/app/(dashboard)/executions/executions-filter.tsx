"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Agent = { id: string; name: string };

export default function ExecutionsFilter({
  agents,
  currentAgentId,
}: {
  agents: Agent[];
  currentAgentId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(agentId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (agentId) {
      params.set("agent_id", agentId);
    } else {
      params.delete("agent_id");
    }
    router.push(`/executions?${params.toString()}`);
  }

  return (
    <div className="mb-6">
      <select
        value={currentAgentId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      >
        <option value="">All Agents</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
}
