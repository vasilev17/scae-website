/**
 * The single place the site talks to a form backend. Swapping Formspree for
 * anything else touches this file only — components hand over a form id and a
 * flat payload and get a result union back.
 */

export type FormPayload = Record<string, string>;

export type SubmitResult =
  | { status: 'ok' }
  | { status: 'error'; reason: 'network' | 'rejected'; detail?: string };

const ENDPOINT = 'https://formspree.io/f/';

// Formspree reads the hCaptcha token off this key and verifies it server-side
// against the secret stored in the form's dashboard settings.
export const CAPTCHA_FIELD = 'h-captcha-response';

// Formspree drops any submission where this field is filled in.
export const HONEYPOT_FIELD = '_gotcha';

type FormspreeError = { message?: string; code?: string };

function firstErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const record = body as { error?: unknown; errors?: FormspreeError[] };
  if (typeof record.error === 'string' && record.error.length > 0) {
    return record.error;
  }
  if (!Array.isArray(record.errors)) return undefined;
  return record.errors.find((item) => item.message)?.message;
}

export async function submitForm(
  formId: string,
  payload: FormPayload,
): Promise<SubmitResult> {
  let response: Response;

  try {
    response = await fetch(`${ENDPOINT}${formId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { status: 'error', reason: 'network' };
  }

  if (response.ok) return { status: 'ok' };

  const body: unknown = await response.json().catch(() => null);
  const detail = firstErrorMessage(body);
  console.error(`Formspree ${formId} ${String(response.status)}`, detail ?? body);
  return {
    status: 'error',
    reason: 'rejected',
    detail,
  };
}
