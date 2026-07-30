import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createRequestSchema, toValidationFailure } from "./requestSchema";

/**
 * Validates + accepts a new workspace request.
 * Retired categories (asset / assist) are rejected with a 4xx Response.
 */
export const submitRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const parsed = createRequestSchema.safeParse(input);
    if (!parsed.success) {
      const { status, body } = toValidationFailure(parsed.error as z.ZodError);
      throw new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    return {
      ok: true as const,
      acceptedAt: new Date().toISOString(),
      request: data,
    };
  });
