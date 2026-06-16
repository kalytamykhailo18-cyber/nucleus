import { env } from '@/lib/env';

/**
 * Aura (CIMA / pf360.mx) API client — Juan 2026-05-19.
 *
 * Every Aura endpoint shares the same envelope:
 *   - Header `X-Token: <our account token>`
 *   - Body `{ rfc: "...", ... }` — `rfc` resolves the user on Aura's
 *     side via their `validate.user.active` middleware, which then
 *     injects `user_id` and `plan_id` server-side.
 *
 * The client is a no-op when `AURA_X_TOKEN` is not configured: each
 * method resolves to `{ ok: false, reason: 'disabled' }` so the rest
 * of the dispatch pipeline (web push, call-center lookup, EviewEvent
 * persistence) continues to work and we can flip Aura on with one env
 * var change once Juan delivers the token.
 *
 * All four endpoints (SOS, Assistances, Calls, Follow Me) are wired
 * here so the integration is one ENV var away from production.
 */

const ACCEPT_JSON = 'application/json';

export interface AuraSosInput {
  rfc: string;
  lat: string;
  long: string;
  contacts: string[];
  originPhone: string;
  userId?: number;
}

export interface AuraSosResult {
  alertId: string | null;
  status: string | null;
  raw: unknown;
}

export interface AuraAssistanceItem {
  id: number;
  name: string;
  description: string | null;
  type: 'call' | 'url' | string;
  ivr: string | null;
  url: string | null;
}

export interface AuraAssistanceCategory {
  id: number;
  name: string;
  assistances: AuraAssistanceItem[];
}

export interface AuraAssistancesResult {
  planId: number | null;
  planName: string | null;
  categories: AuraAssistanceCategory[];
  raw: unknown;
}

export interface AuraCallInput {
  rfc: string;
  phoneNumber: string;
  message: string;
  campaignId?: string;
  priority?: number;
}

export interface AuraFollowMeInput {
  rfc: string;
  lat: string;
  long: string;
  /** Minutes — must be 30, 60, or 90 per Aura's contract. */
  duration: 30 | 60 | 90;
  userId?: number;
}

export type AuraResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'disabled' | 'network' | 'auth' | 'rejected'; status?: number; message?: string };

function buildHeaders(): HeadersInit | null {
  const token = env.AURA_X_TOKEN;
  if (!token) return null;
  return {
    'X-Token': token,
    'Content-Type': ACCEPT_JSON,
    Accept: ACCEPT_JSON,
  };
}

async function postAura(
  path: string,
  body: Record<string, unknown>,
): Promise<AuraResult<unknown>> {
  const headers = buildHeaders();
  if (!headers) return { ok: false, reason: 'disabled' };

  let response: Response;
  try {
    response = await fetch(`${env.AURA_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    // Aura sometimes returns text/plain on 5xx; treat as opaque payload.
    parsed = text;
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      reason: 'auth',
      status: response.status,
      message: messageOf(parsed),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: 'rejected',
      status: response.status,
      message: messageOf(parsed),
    };
  }
  return { ok: true, data: parsed };
}

function messageOf(parsed: unknown): string | undefined {
  if (parsed && typeof parsed === 'object' && 'message' in parsed) {
    const v = (parsed as { message: unknown }).message;
    if (typeof v === 'string') return v;
  }
  if (typeof parsed === 'string') return parsed;
  return undefined;
}

/**
 * Fire an SOS alert. Aura's backend talks to Tecnotrust which is what
 * actually notifies the contact list. Each user can have at most one
 * active SOS at a time — Aura returns 210 with a "ya cuentas con una
 * alerta activa" message that we map to `rejected`.
 */
export async function fireAuraSos(input: AuraSosInput): Promise<AuraResult<AuraSosResult>> {
  const body: Record<string, unknown> = {
    rfc: input.rfc,
    lat: input.lat,
    long: input.long,
    contacts: input.contacts,
    origin_phone: input.originPhone,
  };
  if (input.userId !== undefined) body.user_id = input.userId;
  const res = await postAura('/api/sos', body);
  if (!res.ok) return res;
  const raw = res.data as
    | { data?: { alert_id?: string; status?: string } }
    | undefined;
  return {
    ok: true,
    data: {
      alertId: raw?.data?.alert_id ?? null,
      status: raw?.data?.status ?? null,
      raw: res.data,
    },
  };
}

/**
 * Fetch the assistance services contracted for this user's plan. Used
 * to render the Total-tier concierge menu (Aura medical / legal /
 * roadside / etc.).
 */
export async function fetchAuraAssistances(
  rfc: string,
  planId?: number,
): Promise<AuraResult<AuraAssistancesResult>> {
  const body: Record<string, unknown> = { rfc };
  if (planId !== undefined) body.plan_id = planId;
  const res = await postAura('/api/assistances', body);
  if (!res.ok) return res;
  const raw = res.data as
    | {
        id?: number;
        name?: string;
        categories?: Array<{
          id: number;
          name: string;
          assistances?: Array<{
            id: number;
            name: string;
            description?: string | null;
            type?: string;
            ivr?: string | null;
            url?: string | null;
          }>;
        }>;
      }
    | undefined;
  return {
    ok: true,
    data: {
      planId: raw?.id ?? null,
      planName: raw?.name ?? null,
      categories: (raw?.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        assistances: (c.assistances ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description ?? null,
          type: a.type ?? 'call',
          ivr: a.ivr ?? null,
          url: a.url ?? null,
        })),
      })),
      raw: res.data,
    },
  };
}

/** Make an outbound voice call via Aura's Publifon proxy. */
export async function fireAuraCall(
  input: AuraCallInput,
): Promise<AuraResult<unknown>> {
  const body: Record<string, unknown> = {
    rfc: input.rfc,
    phone_number: input.phoneNumber,
    message: input.message,
  };
  if (input.campaignId) body.campaign_id = input.campaignId;
  if (input.priority !== undefined) body.priority = input.priority;
  return postAura('/api/calls', body);
}

/** Start a temporary "Follow Me" tracking window (30 / 60 / 90 min). */
export async function fireAuraFollowMe(
  input: AuraFollowMeInput,
): Promise<AuraResult<unknown>> {
  const body: Record<string, unknown> = {
    rfc: input.rfc,
    lat: input.lat,
    long: input.long,
    duration: input.duration,
  };
  if (input.userId !== undefined) body.user_id = input.userId;
  return postAura('/api/followme', body);
}

/** True when AURA_X_TOKEN is configured — every endpoint becomes live. */
export function isAuraEnabled(): boolean {
  return env.AURA_X_TOKEN !== undefined;
}
