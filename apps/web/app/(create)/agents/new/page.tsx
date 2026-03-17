"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type EnvVar = { key: string; value: string };

const TOTAL_STEPS = 4;

export default function CreateAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  // Step 2
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  // Step 3
  const [claudeMd, setClaudeMd] = useState("");
  // Step 4 (advanced)
  const [dockerfile, setDockerfile] = useState("");
  const [mcpConfig, setMcpConfig] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [maxTurns, setMaxTurns] = useState<number | "">(10);
  const [maxBudget, setMaxBudget] = useState<number | "">(1);
  const [envVars, setEnvVars] = useState<EnvVar[]>([{ key: "", value: "" }]);

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

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      const envVarsObj: Record<string, string> = {};
      for (const ev of envVars) {
        if (ev.key.trim()) {
          envVarsObj[ev.key.trim()] = ev.value;
        }
      }

      let parsedMcpConfig: Record<string, unknown> | undefined;
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
        settings: {
          model,
          ...(maxTurns !== "" ? { max_turns: maxTurns } : {}),
          ...(maxBudget !== "" ? { max_budget_usd: maxBudget } : {}),
        },
      };

      if (dockerfile.trim()) body.dockerfile = dockerfile;
      if (claudeMd.trim()) body.claude_md = claudeMd;
      if (parsedMcpConfig) body.mcp_config = parsedMcpConfig;
      if (anthropicApiKey.trim()) body.anthropic_api_key = anthropicApiKey;
      if (Object.keys(envVarsObj).length > 0) body.env_vars = envVarsObj;

      const res = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create agent");
      }

      const created = await res.json();
      const agentId = created.id;

      // Auto-trigger build
      await fetch(`/api/v1/agents/${agentId}/build`, { method: "POST" });

      router.push(`/agents/${agentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const textareaClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition-colors";

  const stepLabels = ["Name", "API Key", "Instructions", "Advanced"];

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-gray-900 hover:text-gray-700 transition-colors"
        >
          blip
        </Link>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <div key={label} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    isActive
                      ? "bg-gray-900"
                      : isComplete
                        ? "bg-emerald-500"
                        : "bg-gray-200"
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400">
          Step {step} of {TOTAL_STEPS} &mdash; {stepLabels[step - 1]}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Name */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Name your agent
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Pick a name you&apos;ll recognize later.
          </p>
          <div>
            <label htmlFor="name" className={labelClass}>
              Agent name
            </label>
            <input
              id="name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  e.preventDefault();
                  setStep(2);
                }
              }}
              placeholder="my-agent"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end mt-10">
            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: API Key */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Add your API key
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Your key is encrypted at rest.{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Get one at console.anthropic.com
            </a>
          </p>
          <div>
            <label htmlFor="api-key" className={labelClass}>
              Anthropic API Key
            </label>
            <input
              id="api-key"
              type="password"
              autoFocus
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setStep(3);
                }
              }}
              placeholder="sk-ant-..."
              className={inputClass}
            />
          </div>
          <div className="flex justify-between mt-10">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Instructions */}
      {step === 3 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Give it instructions
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Tell your agent what it should do. This becomes its CLAUDE.md file.
          </p>
          <div>
            <label htmlFor="claude-md" className={labelClass}>
              Instructions
            </label>
            <textarea
              id="claude-md"
              autoFocus
              value={claudeMd}
              onChange={(e) => setClaudeMd(e.target.value)}
              placeholder="You are a helpful coding assistant. You help users write clean, well-tested code..."
              rows={8}
              className={textareaClass}
            />
          </div>
          <div className="flex justify-between mt-10">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Advanced
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Advanced */}
      {step === 4 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Advanced settings
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Optional configuration for power users. You can always change these later.
          </p>

          <div className="space-y-6">
            {/* Dockerfile */}
            <div>
              <label htmlFor="dockerfile" className={labelClass}>
                Dockerfile
              </label>
              <textarea
                id="dockerfile"
                value={dockerfile}
                onChange={(e) => setDockerfile(e.target.value)}
                placeholder="# Custom Dockerfile instructions&#10;RUN apt-get update && apt-get install -y ..."
                rows={4}
                className={textareaClass}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Custom Dockerfile for the sandbox environment.
              </p>
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
              <p className="mt-1.5 text-xs text-gray-500">
                JSON configuration for MCP servers.
              </p>
            </div>

            {/* Settings grid */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Model & Limits
              </h3>
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
                    <option value="claude-sonnet-4-20250514">
                      Claude Sonnet 4
                    </option>
                    <option value="claude-opus-4-20250514">
                      Claude Opus 4
                    </option>
                    <option value="claude-haiku-3-5-20241022">
                      Claude Haiku 3.5
                    </option>
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
                    placeholder="10"
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
                    placeholder="1.00"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Env vars */}
            <div>
              <div className="flex items-center justify-between mb-3">
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
          </div>

          <div className="flex justify-between mt-10">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Create Agent"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
