import { prisma } from '@/lib/db';
import { env, constants } from '@/lib/env';

/**
 * HubSpot one-way sync (Phase A+ #2).
 *
 * Pushes every new Nucleus signup into the client's existing HubSpot
 * Contacts so marketing keeps its single source of attribution truth
 * (HubSpot owns email automation, pipelines, lists, dashboards;
 * Nucleus owns operational data — devices, subscriptions, IMEIs).
 *
 * Pattern mirrors `lib/email-transport.ts`:
 *   - inline HTTP call, fire-and-forget at the caller (`void syncContact`)
 *   - never throws; all errors caught + console.error
 *   - dev mode skips the real call so staging/test traffic does not
 *     pollute the production HubSpot portal
 *   - when E2E_HOOKS_SECRET is set, a `HubSpotOutboxTest` row is written
 *     regardless of mode so Playwright can assert on the payload
 *
 * Idempotency: the upsert endpoint identifies contacts by email
 * (`idProperty=email`), so re-firing for the same buyer updates the
 * existing contact rather than duplicating.
 */

export interface SyncContactInput {
  email: string;
  fullName: string | null;
  phone: string | null;
  signupSource: string | null;
  planType?: string | null;
  pricePaidCentavos?: number | null;
  channel?: string | null;
}

export async function syncContact(input: SyncContactInput): Promise<void> {
  const apiKey = env.HUBSPOT_API_KEY;
  const mode = env.HUBSPOT_MODE;
  const e2eHooks = env.E2E_HOOKS_SECRET !== undefined;

  const properties = buildProperties(input);
  const payload = {
    properties,
    idProperty: 'email',
  };

  if (apiKey && mode === 'live') {
    try {
      // Upsert by email — HubSpot's create-or-update endpoint accepts the
      // email as the `{id}` segment when `idProperty=email`. Returns 200
      // on update, 201 on create.
      const url =
        `${constants.HUBSPOT_API_URL}/crm/v3/objects/contacts/` +
        `${encodeURIComponent(input.email)}?idProperty=email`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });
      if (res.status === 404) {
        // First-time contact — fall back to plain POST.
        const create = await fetch(
          `${constants.HUBSPOT_API_URL}/crm/v3/objects/contacts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties }),
          },
        );
        if (!create.ok) {
          const body = await create.text().catch(() => '<unreadable>');
          console.error(`[hubspot] create ${create.status}: ${body}`);
        }
      } else if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        console.error(`[hubspot] upsert ${res.status}: ${body}`);
      }
    } catch (err) {
      console.error('[hubspot] sync failed', err);
    }
  } else if (apiKey && mode === 'dev') {
    console.info(
      `[hubspot] (sandbox — HUBSPOT_MODE=dev) email=${input.email} source=${input.signupSource ?? 'null'}`,
    );
  } else {
    console.info(
      `[hubspot] (no-op — HUBSPOT_API_KEY unset) email=${input.email} source=${input.signupSource ?? 'null'}`,
    );
  }

  if (e2eHooks) {
    try {
      await prisma.hubSpotOutboxTest.create({
        data: {
          email: input.email.toLowerCase(),
          source: input.signupSource,
          payload,
        },
      });
    } catch (err) {
      console.error('[hubspot] outbox write failed', err);
    }
  }
}

function buildProperties(input: SyncContactInput): Record<string, string> {
  const props: Record<string, string> = { email: input.email.toLowerCase() };
  if (input.fullName) {
    const { firstName, lastName } = splitFullName(input.fullName);
    if (firstName) props.firstname = firstName;
    if (lastName) props.lastname = lastName;
  }
  if (input.phone) props.phone = input.phone;
  if (input.signupSource) props.signup_source = input.signupSource;
  if (input.planType) props.nucleus_plan = input.planType;
  if (input.pricePaidCentavos != null) {
    // HubSpot's "number" property expects a string-encoded numeric. We
    // store MXN pesos (not centavos) so marketing dashboards read in the
    // natural currency unit.
    props.nucleus_price_mxn = (input.pricePaidCentavos / 100).toFixed(2);
  }
  if (input.channel) props.nucleus_channel = input.channel;
  return props;
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, lastSpace),
    lastName: trimmed.slice(lastSpace + 1),
  };
}
