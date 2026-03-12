import { describe, expect, test } from "vitest";
import { createSessionRequestSchema } from "../src/common/contracts.js";

describe("createSessionRequestSchema", () => {
  test("rejects raw thinking config in public agent options", () => {
    expect(() =>
      createSessionRequestSchema.parse({
        model: "claude-sonnet-4-6",
        effort: "medium",
        agent_options: {
          thinking: {
            type: "enabled",
            budgetTokens: 4096
          }
        }
      })
    ).toThrow(/agent_options.thinking/u);
  });

  test("requires bypass flag when permissionMode bypassPermissions is set", () => {
    expect(() =>
      createSessionRequestSchema.parse({
        model: "claude-sonnet-4-6",
        effort: "high",
        agent_options: {
          permissionMode: "bypassPermissions"
        }
      })
    ).toThrow(/allowDangerouslySkipPermissions/u);
  });
});
