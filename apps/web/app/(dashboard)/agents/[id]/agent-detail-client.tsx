"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AgentData = {
  id: string;
  user_id: string;
  name: string;
  dockerfile: string | null;
  claude_md: string | null;
  mcp_config: Record<string, unknown> | null;
  settings: { model?: string; max_turns?: number; max_budget_usd?: number };
  env_vars: Record<string, string> | null;
  has_anthropic_key: boolean;
  e2b_template_id: string | null;
  template_status: string;
  created_at: string;
  updated_at: string;
};

type EnvVar = { key: string; value: string };

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    building: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

export default function AgentDetailClient({ agent }: { agent: AgentData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-poll when building
  const pollBuildStatus = useCallback(() => {
    if (agent.template_status !== "building") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/agents/${agent.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.template_status !== "building") {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [agent.id, agent.template_status, router]);

  useEffect(() => {
    return pollBuildStatus();
  }, [pollBuildStatus]);

  const [name, setName] = useState(agent.name);
  const [dockerfile, setDockerfile] = useState(agent.dockerfile ?? "");
  const [claudeMd, setClaudeMd] = useState(agent.claude_md ?? "");
  const [mcpConfig, setMcpConfig] = useState(
    agent.mcp_config ? JSON.stringify(agent.mcp_config, null, 2) : "",
  );
  const [model, setModel] = useState(
    agent.settings?.model ?? "claude-sonnet-4-20250514",
  );
  const [maxTurns, setMaxTurns] = useState<number | "">(
    agent.settings?.max_turns ?? 10,
  );
  const [maxBudget, setMaxBudget] = useState<number | "">(
    agent.settings?.max_budget_usd ?? 1,
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [envVars, setEnvVars] = useState<EnvVar[]>(() => {
    if (agent.env_vars && Object.keys(agent.env_vars).length > 0) {
      return Object.entries(agent.env_vars).map(([key, value]) => ({
        key,
        value,
      }));
    }
    return [{ key: "", value: "" }];
  });

  function addEnvVar() {
    setEnvVars([...envVars, { key: "", value: "" }]);
  }

  function removeEnvVar(index: number) {
    setEnvVars(envVars.filter((_, i) => i !== index));
  }

  function updateEnvVar(index: number, field: "key" | "value", val: string) {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: val };
    setEnvVars(updated);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const envVarsObj: Record<string, string> = {};
      for (const ev of envVars) {
        if (ev.key.trim()) {
          envVarsObj[ev.key.trim()] = ev.value;
        }
      }

      let parsedMcpConfig: Record<string, unknown> | null = null;
      if (mcpConfig.trim()) {
        try {
          parsedMcpConfig = JSON.parse(mcpConfig);
        } catch {
          setError("MCP Config must be valid JSON");
          setLoading(false);
          return;
        }
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        dockerfile: dockerfile.trim() || null,
        claude_md: claudeMd.trim() || null,
        mcp_config: parsedMcpConfig,
        settings: {
          model,
          ...(maxTurns !== "" ? { max_turns: maxTurns } : {}),
          ...(maxBudget !== "" ? { max_budget_usd: maxBudget } : {}),
        },
        env_vars: Object.keys(envVarsObj).length > 0 ? envVarsObj : null,
      };

      if (anthropicApiKey.trim()) {
        body.anthropic_api_key = anthropicApiKey;
      }

      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to update agent");
      }

      setSuccess("Agent updated successfully");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuild() {
    setBuildLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/build`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to start build");
      }

      setSuccess("Template build started");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBuildLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/agents/${agent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to delete agent");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const textareaClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition-colors";

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              {agent.name}
            </h2>
            <StatusBadge status={agent.template_status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(agent.created_at).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono select-all">
            ID: {agent.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBuild}
            disabled={buildLoading || agent.template_status === "building"}
            className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {buildLoading ? "Building..." : "Build Template"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Dockerfile */}
          <div>
            <label htmlFor="dockerfile" className={labelClass}>
              Dockerfile
            </label>
            <textarea
              id="dockerfile"
              value={dockerfile}
              onChange={(e) => setDockerfile(e.target.value)}
              placeholder="# Custom Dockerfile instructions"
              rows={4}
              className={textareaClass}
            />
          </div>

          {/* CLAUDE.md */}
          <div>
            <label htmlFor="claude-md" className={labelClass}>
              CLAUDE.md
            </label>
            <textarea
              id="claude-md"
              value={claudeMd}
              onChange={(e) => setClaudeMd(e.target.value)}
              placeholder="# Agent Instructions"
              rows={6}
              className={textareaClass}
            />
          </div>

          {/* MCP Config */}
          <div>
            <label htmlFor="mcp-config" className={labelClass}>
              MCP Config
            </label>
            <textarea
              id="mcp-config"
              value={mcpConfig}
              onChange={(e) => setMcpConfig(e.target.value)}
              placeholder='{"mcpServers": {}}'
              rows={4}
              className={textareaClass}
            />
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Settings</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="model" className={labelClass}>
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClass}
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
              </select>
            </div>
            <div>
              <label htmlFor="max-turns" className={labelClass}>
                Max Turns
              </label>
              <input
                id="max-turns"
                type="number"
                min={1}
                value={maxTurns}
                onChange={(e) =>
                  setMaxTurns(
                    e.target.value ? parseInt(e.target.value, 10) : "",
                  )
                }
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="max-budget" className={labelClass}>
                Max Budget (USD)
              </label>
              <input
                id="max-budget"
                type="number"
                min={0.01}
                step={0.01}
                value={maxBudget}
                onChange={(e) =>
                  setMaxBudget(
                    e.target.value ? parseFloat(e.target.value) : "",
                  )
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Anthropic API Key */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <label htmlFor="api-key" className={labelClass}>
            Anthropic API Key
            {agent.has_anthropic_key && (
              <span className="ml-2 text-xs text-gray-500 font-normal">
                (key is set -- leave blank to keep current)
              </span>
            )}
          </label>
          <input
            id="api-key"
            type="password"
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
            placeholder={
              agent.has_anthropic_key ? "Leave blank to keep current key" : "sk-ant-..."
            }
            className={inputClass}
          />
        </div>

        {/* Environment Variables */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">
              Environment Variables
            </h3>
            <button
              type="button"
              onClick={addEnvVar}
              className="text-xs text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
            >
              + Add variable
            </button>
          </div>
          <div className="space-y-2">
            {envVars.map((ev, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={ev.key}
                  onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                  placeholder="KEY"
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  value={ev.value}
                  onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                  placeholder="value"
                  className={`${inputClass} flex-1`}
                />
                {envVars.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEnvVar(i)}
                    className="px-2 text-gray-400 hover:text-red-600 transition-colors text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Delete */}
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Are you sure?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Delete Agent
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
