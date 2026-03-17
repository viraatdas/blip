import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { isHttpError, HttpError } from "@blip/shared";
import { AuthError } from "./api-auth";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: error.message } },
      { status: error.statusCode },
    );
  }

  if (isHttpError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request", details: error.errors } },
      { status: 400 },
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}
