import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../../lib/api-auth";
import { jsonResponse, errorResponse } from "../../../../../lib/api-helpers";
import { HttpError } from "@blip/shared";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import * as executionEventRepo from "@blip/db/repositories/execution-event-repository";

type Params = { params: Promise<{ id: string }> };

// GET /v1/executions/:id - Get execution + events
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;

    const execution = await executionRepo.findById(id);
    if (!execution || execution.user_id !== userId) {
      throw new HttpError(404, "not_found", "Execution not found");
    }

    const events = await executionEventRepo.findByExecutionId(id);

    // Backfill from result event if top-level fields are null (async timing)
    const resultEvent = events.find((e) => e.event_type === "result");
    const enriched = {
      ...execution,
      result_text: execution.result_text || (resultEvent?.payload?.result_text as string) || null,
      cost_usd: execution.cost_usd ?? (resultEvent?.payload?.cost_usd as number) ?? null,
      turns: execution.turns ?? (resultEvent?.payload?.turns as number) ?? null,
      duration_ms: execution.duration_ms ?? (resultEvent?.payload?.duration_ms as number) ?? null,
      events,
    };

    return jsonResponse(enriched);
  } catch (error) {
    return errorResponse(error);
  }
}
