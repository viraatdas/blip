import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ZodError } from "zod";
import { HttpError, isHttpError } from "../../common/errors.js";
import { stringifyError } from "../../common/json.js";

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,x-api-key",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

export function noContentResponse(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,x-api-key",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
    }
  };
}

export function errorResponse(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof ZodError) {
    return jsonResponse(400, {
      error: "validation_error",
      message: "Request validation failed.",
      details: error.flatten()
    });
  }

  if (isHttpError(error)) {
    return jsonResponse(error.statusCode, {
      error: error.code,
      message: error.message,
      details: error.details
    });
  }

  return jsonResponse(500, {
    error: "internal_error",
    message: "Unexpected server error.",
    details: stringifyError(error)
  });
}

export function requireBody(body: string | undefined | null): string {
  if (!body) {
    throw new HttpError(400, "missing_body", "Request body is required.");
  }

  return body;
}
