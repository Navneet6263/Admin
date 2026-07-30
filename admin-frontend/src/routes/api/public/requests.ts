import { createFileRoute } from "@tanstack/react-router";
import type { z } from "zod";
import { createRequestSchema, toValidationFailure } from "@/lib/requestSchema";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid_json", message: "Body must be valid JSON." }, 400);
        }

        const parsed = createRequestSchema.safeParse(payload);
        if (!parsed.success) {
          const { status, body } = toValidationFailure(parsed.error as z.ZodError);
          return json(body, status);
        }

        return json({ ok: true, acceptedAt: new Date().toISOString(), request: parsed.data }, 201);
      },
    },
  },
});
