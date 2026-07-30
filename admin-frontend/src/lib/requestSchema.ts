import { z } from "zod";

/** Request categories the workspace still accepts. */
export const ALLOWED_REQUEST_TYPES = [
  "id_card",
  "visiting_card",
  "stationery",
  "travel",
  "courier",
  "meeting_room",
  "fooding",
] as const;

/** Retired categories — any payload using these must be rejected with 4xx. */
export const RETIRED_REQUEST_TYPES = ["asset", "assist", "assist_request", "asset_request"] as const;

export type AllowedRequestType = (typeof ALLOWED_REQUEST_TYPES)[number];

const retiredSet = new Set<string>(RETIRED_REQUEST_TYPES);

export const requestTypeSchema = z
  .string()
  .trim()
  .min(1, "Request type is required")
  .max(40, "Request type is too long")
  .superRefine((val, ctx) => {
    if (retiredSet.has(val.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Request type "${val}" has been retired and is no longer accepted.`,
      });
      return;
    }
    if (!(ALLOWED_REQUEST_TYPES as readonly string[]).includes(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported request type "${val}". Allowed: ${ALLOWED_REQUEST_TYPES.join(", ")}.`,
      });
    }
  });

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

export const createRequestSchema = z.object({
  type: requestTypeSchema,
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(160),
  description: z.string().trim().max(2000).optional().default(""),
  amount: z.number().finite().nonnegative().max(100_000_000).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  company: z.string().trim().min(1).max(8),
  employeeId: z.number().int().positive().max(1_000_000),
  employeeName: z.string().trim().min(1).max(120),
  employeeDept: z.string().trim().min(1).max(80),
  details: z.record(jsonValueSchema).optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export interface ValidationFailure {
  error: "validation_failed" | "retired_request_type";
  message: string;
  issues: { path: string; message: string }[];
}

/** Normalizes a ZodError into a stable 4xx JSON body. */
export function toValidationFailure(err: z.ZodError): { status: 400 | 422; body: ValidationFailure } {
  const issues = err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
  const retired = issues.some((i) => i.path === "type" && i.message.includes("retired"));
  return {
    status: retired ? 422 : 400,
    body: {
      error: retired ? "retired_request_type" : "validation_failed",
      message: retired
        ? "Asset / assist request types are no longer supported."
        : "Request payload failed validation.",
      issues,
    },
  };
}
