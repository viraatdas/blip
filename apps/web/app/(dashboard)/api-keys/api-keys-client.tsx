"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiKey = {
  id: string;
  user_id: string;
  key_id: string;
  key_prefix: string;
  name: string | null;
  secret_salt: string;
  secret_hash: string;
  created_at: string;
  revoked_at: string | null;
};

export default function ApiKeysClient({
  initialKeys,
}: {
  initialKeys: ApiKey[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create API key");
      }

      const data = await res.json();
      setNewKey(data.key);
      setKeyName("");
      setShowCreate(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    setError(null);

    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to revoke key");
      }

      setRevokeConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRevoking(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copySnippet(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  }

  function SnippetBlock({
    label,
    id,
    copyText,
    children,
    last,
  }: {
    label: string;
    id: string;
    copyText: string;
    children: React.ReactNode;
    last?: boolean;
  }) {
    return (
      <div className={last ? "" : "border-b border-gray-100"}>
        <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <button
            onClick={() => copySnippet(id, copyText)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            {copiedSnippet === id ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <div className="mx-3 mb-3 rounded-lg bg-[#0d1117] overflow-x-auto ring-1 ring-white/[0.06]">
          <pre className="px-4 py-3.5 text-[13px] leading-[1.6] font-mono text-gray-300">
            {children}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            API Keys
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setNewKey(null);
          }}
          className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Create API Key
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* New key + quick start - shown once after creation */}
      {newKey && (
        <div className="mb-6 space-y-4">
          {/* Key display */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200">
                <svg className="h-3 w-3 text-emerald-700" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm text-emerald-800 font-medium">
                API key created! Copy it now &mdash; it won&apos;t be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white border border-emerald-200 px-3 py-2.5 text-sm text-gray-900 font-mono break-all select-all">
                {newKey}
              </code>
              <button
                onClick={() => copyToClipboard(newKey)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  {copied ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  )}
                </svg>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Quick start */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Quick start
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Use your API key to run agents programmatically.
              </p>
            </div>

            <div className="border-t border-gray-100 bg-[#0d1117] rounded-b-xl">
              {/* 1. Run an execution */}
              <SnippetBlock
                label="1. Run an execution"
                id="curl-exec"
                copyText={`curl -X POST https://blip.exla.ai/api/v1/executions \\\n  -H "Authorization: Bearer ${newKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"prompt": "Go to github.com/openclaw/openclaw, pick up the latest issue, and open a PR with the fix"}'`}
              >
                <span className="text-[#7ee787]">curl</span>{" "}<span className="text-[#79c0ff]">-X POST</span>{" "}<span className="text-[#a5d6ff]">https://blip.exla.ai/api/v1/executions</span>{" \\\n  "}<span className="text-[#79c0ff]">-H</span>{" "}<span className="text-[#a5d6ff]">&quot;Authorization: Bearer <span className="text-[#ffa657]">{newKey}</span>&quot;</span>{" \\\n  "}<span className="text-[#79c0ff]">-H</span>{" "}<span className="text-[#a5d6ff]">&quot;Content-Type: application/json&quot;</span>{" \\\n  "}<span className="text-[#79c0ff]">-d</span>{" "}<span className="text-[#a5d6ff]">&apos;{"{\n    "}<span className="text-[#79c0ff]">&quot;prompt&quot;</span>: <span className="text-[#a5d6ff]">&quot;Go to github.com/openclaw/openclaw,{"\n               "}pick up the latest issue, and open a PR with the fix&quot;</span>{"\n  }"}&apos;</span>
              </SnippetBlock>

              {/* 2. Check execution status */}
              <SnippetBlock
                label="2. Check execution status"
                id="curl-status"
                copyText={`curl https://blip.exla.ai/api/v1/executions/EXECUTION_ID \\\n  -H "Authorization: Bearer ${newKey}"`}
                last
              >
                <span className="text-[#7ee787]">curl</span>{" "}<span className="text-[#a5d6ff]">https://blip.exla.ai/api/v1/executions/<span className="text-[#8b949e] italic">EXECUTION_ID</span></span>{" \\\n  "}<span className="text-[#79c0ff]">-H</span>{" "}<span className="text-[#a5d6ff]">&quot;Authorization: Bearer <span className="text-[#ffa657]">{newKey}</span>&quot;</span>
              </SnippetBlock>
            </div>
          </div>

          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">
                Create API Key
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-5">
                <label
                  htmlFor="key-name"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="key-name"
                  type="text"
                  autoFocus
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setShowCreate(false);
                    }
                  }}
                  placeholder="e.g., Production, CI/CD"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  A label to help you identify this key later.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="inline-flex items-center rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Creating..." : "Create Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keys list — always visible below quick start */}
      {initialKeys.length === 0 && !newKey ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No API keys yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Create your first API key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {initialKeys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-900">
                    {key.name ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {key.key_prefix}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {revokeConfirm === key.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-xs text-red-600">Revoke?</span>
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revoking === key.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                        >
                          {revoking === key.id ? "Revoking..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setRevokeConfirm(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setRevokeConfirm(key.id)}
                        className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
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
