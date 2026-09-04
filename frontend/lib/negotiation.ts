export type NegotiationStatus =
  | "continue"
  | "accepted"
  | "no_deal";

export interface NegotiationResponse {
  session_id: string;
  status: NegotiationStatus;
  round_number: number;
  max_rounds: number;
  quantity: number;
  requested_quantity: number;
  stock_remaining: number;
  quantity_reduced_due_to_inventory: boolean;
  offered_price_per_unit: string;
  calculated_price: string;
  floor_price_per_unit: string;
  buyer_effective_max: string;
  reason: string;
  explanation: string;
  payment_link: unknown | null;
}

export interface NegotiationPayload {
  session_id: string;
  quantity: number;
  offered_price_per_unit: string;
}

interface NegotiationError {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface NegotiationSuccess {
  ok: true;
  data: NegotiationResponse;
}

export interface NegotiationFailure {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
}

export type SubmitResult =
  | NegotiationSuccess
  | NegotiationFailure;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function formatMoney(
  value: string | number,
): string {
  const raw = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return raw;
  }

  const [whole, decimal = ""] =
    raw.split(".");

  return `${whole}.${decimal.padEnd(2, "0")}`;
}

export async function submitNegotiationStep(
  payload: NegotiationPayload,
): Promise<SubmitResult> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/negotiate/step`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = (await response.json()) as
      | NegotiationResponse
      | NegotiationError;

    if (!response.ok) {
      const errorData =
        data as NegotiationError;

      return {
        ok: false,
        code:
          errorData.error?.code ??
          "REQUEST_REJECTED",
        message:
          errorData.error?.message ??
          "The negotiation request was rejected.",
        details:
          errorData.error?.details,
      };
    }

    return {
      ok: true,
      data: data as NegotiationResponse,
    };
  } catch (error) {
    console.error(error);

    return {
      ok: false,
      code: "BACKEND_UNREACHABLE",
      message:
        "Could not reach the negotiation backend. Make sure FastAPI is running on port 8000.",
    };
  }
}