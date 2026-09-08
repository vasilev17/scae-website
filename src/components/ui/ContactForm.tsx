import { zodResolver } from '@hookform/resolvers/zod';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useForm } from 'react-hook-form';

import { SpecularButton } from '@/components/ui/SpecularButton';
import {
  CONTACT_TABS,
  EMAIL_MAX,
  MESSAGE_MAX,
  NAME_MAX,
  SOCIAL_MAX,
  contactSchema,
  type ContactTab,
  type ContactValues,
} from '@/lib/contact-schema';
import {
  CAPTCHA_FIELD,
  HONEYPOT_FIELD,
  submitForm,
  type FormPayload,
} from '@/lib/submit-form';
import type { UiDictionary } from '@/i18n/ui/en';

export type ContactCopy = UiDictionary['contact'];

type ContactFormProps = {
  copy: ContactCopy;
  locale: string;
  formIds: Record<ContactTab, string | undefined>;
  captchaSiteKey?: string;
};

type SubmitState =
  | { status: 'idle' }
  | { status: 'sent'; tab: ContactTab }
  | { status: 'error'; message: string };

type ButtonStatus = 'idle' | 'loading' | 'error';

// One submission per panel per browser. The two keys are independent, so a
// visitor gets one general message *and* one application. `scae_applied` keeps
// its name from the coming-soon site — anyone who applied there already carries
// it, and renaming would hand them a second application.
const SUBMITTED_KEY: Record<ContactTab, string> = {
  general: 'scae_contacted',
  application: 'scae_applied',
};
const BUTTON_RESET_MS = 2500;
const APPLY_SUBJECT_PREFIX = '🚀 Нова СКАИ кандидатура за членство от ';

// The promise hCaptcha hands back must never be left unsettled: one that hangs
// pins the button in its loading state, and nothing short of a reload gets the
// form back. Two deadlines, because the two waits are nothing alike — getting a
// challenge on screen is the widget's job and should be quick, while solving it
// is the visitor's and should not be rushed. `onOpen` is the handover.
const CAPTCHA_HANDSHAKE_MS = 20_000;
const CAPTCHA_SOLVE_MS = 120_000;

// Reasons that mean "the visitor backed out" rather than "the widget broke".
// hCaptcha sends `challenge-closed`; the rest come from react-hcaptcha
// cancelling an execute that is still pending.
const CAPTCHA_CANCELLED = new Set([
  'challenge-closed',
  'hcaptcha-closed',
  'closed',
]);

/**
 * hCaptcha rejects with a bare string (`'network-error'`), react-hcaptcha with
 * an Error, and the odd build with `{ error }`. Flatten all three so the reason
 * can be compared and logged.
 */
function captchaReason(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error !== null && typeof error === 'object') {
    const record = error as { error?: unknown; message?: unknown };
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return 'unknown';
}

function hasSubmitted(tab: ContactTab): boolean {
  try {
    return window.localStorage.getItem(SUBMITTED_KEY[tab]) === 'true';
  } catch {
    return false;
  }
}

function markSubmitted(tab: ContactTab): void {
  try {
    window.localStorage.setItem(SUBMITTED_KEY[tab], 'true');
  } catch {
    // Private mode with storage denied still gets to submit.
  }
}

export function ContactForm({
  copy,
  locale,
  formIds,
  captchaSiteKey,
}: ContactFormProps) {
  const [tab, setTab] = useState<ContactTab>('general');
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const [buttonStatus, setButtonStatus] = useState<ButtonStatus>('idle');
  const captchaRef = useRef<HCaptcha>(null);
  const errorTimer = useRef<number>(0);
  // Set by requestToken for as long as one challenge is outstanding.
  const onCaptchaOpen = useRef<(() => void) | null>(null);
  const groupId = useId();
  const applying = tab === 'application';

  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  const schema = useMemo(
    () => contactSchema(tab, copy.errors),
    [tab, copy.errors],
  );

  const {
    register,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    // useForm re-reads its options on every render, so this closure always
    // validates against the schema for the panel that is currently open.
    resolver: (values, context, options) =>
      zodResolver(schema)(values, context, options),
    mode: 'onChange',
  });

  const formId = formIds[tab];
  const submitLabel = applying ? copy.labels.applySubmit : copy.labels.submit;

  const selectTab = (next: ContactTab) => {
    if (next === tab) return;
    setTab(next);
    setState({ status: 'idle' });
    setButtonStatus('idle');
    window.clearTimeout(errorTimer.current);
    reset();
  };

  const pulseError = () => {
    setButtonStatus('error');
    window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => {
      setButtonStatus('idle');
    }, BUTTON_RESET_MS);
  };

  const fail = (message: string) => {
    setState({ status: 'error', message });
    pulseError();
  };

  // A token is single-use, and resetCaptcha() also cancels whatever execute is
  // still in flight — so this may only run once an attempt has settled.
  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
  };

  /**
   * `execute({ async: true })` is the entire handshake: react-hcaptcha queues
   * the call when the widget has not finished rendering, resolves with the
   * token once the challenge passes, and rejects with hCaptcha's own reason
   * when it is closed or fails. The hand-rolled onVerify/onClose promise this
   * replaces had to guess at the widget's ready state, and reset it from the
   * close handler — which cancelled the challenge that was still opening.
   */
  const requestToken = (): Promise<string> => {
    const widget = captchaRef.current;
    if (!widget) return Promise.reject(new Error('captcha-not-mounted'));

    return new Promise<string>((resolve, reject) => {
      let timer = 0;
      const arm = (ms: number) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          onCaptchaOpen.current = null;
          reject(new Error('captcha-timeout'));
        }, ms);
      };
      const settle = (run: () => void) => {
        window.clearTimeout(timer);
        onCaptchaOpen.current = null;
        run();
      };

      // Until the overlay is up the widget is on the clock; once it is, the
      // visitor is, and they get the long deadline.
      onCaptchaOpen.current = () => arm(CAPTCHA_SOLVE_MS);
      arm(CAPTCHA_HANDSHAKE_MS);

      widget.execute({ async: true }).then(
        ({ response }) =>
          settle(() =>
            response
              ? resolve(response)
              : reject(new Error('captcha-empty-token')),
          ),
        (error: unknown) =>
          settle(() =>
            reject(
              error instanceof Error ? error : new Error(captchaReason(error)),
            ),
          ),
      );
    });
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const index = CONTACT_TABS.indexOf(tab);
    const next =
      CONTACT_TABS[(index + step + CONTACT_TABS.length) % CONTACT_TABS.length];
    if (next) selectTab(next);
  };

  const send = async (values: ContactValues) => {
    if (!formId || !captchaSiteKey) {
      const missing = !formId
        ? `PUBLIC_FORMSPREE_${applying ? 'APPLICATION' : 'CONTACT'}_ID`
        : 'PUBLIC_HCAPTCHA_SITEKEY';
      console.error(`Contact form is not configured: missing ${missing}`);
      fail(copy.errors.generic);
      return;
    }
    // Checked before requestToken so a blocked submit never burns a challenge.
    if (hasSubmitted(tab)) {
      fail(copy.errors.alreadySubmitted[tab]);
      return;
    }

    setState({ status: 'idle' });
    setButtonStatus('loading');

    let token: string;
    try {
      token = await requestToken();
    } catch (error) {
      const reason = captchaReason(error);
      // The reason is the only thing separating "visitor dismissed the overlay"
      // from "the widget never got a challenge", so keep it visible.
      console.error('hCaptcha execute failed:', reason, error);
      resetCaptcha();
      fail(
        CAPTCHA_CANCELLED.has(reason)
          ? copy.errors.captchaCancelled
          : copy.errors.captchaFailed,
      );
      return;
    }

    const payload: FormPayload = {
      name: values.name,
      email: values.email,
      message: values.message,
      [HONEYPOT_FIELD]: values[HONEYPOT_FIELD] ?? '',
      [CAPTCHA_FIELD]: token,
    };
    // Only `_subject`. Formspree treats underscore-prefixed keys as directives
    // — `_subject` sets the notification email's subject line and is not kept
    // as submission data — while a plain `subject` would be stored and listed
    // as a field, which there is no input for.
    if (applying) {
      payload.social = values.social ?? '';
      payload._subject = `${APPLY_SUBJECT_PREFIX}${values.name}`;
    } else {
      payload._subject = `SCAE general form — ${values.name}`;
    }

    const result = await submitForm(formId, payload);
    // Formspree burns the token whether or not it accepts the payload, so a
    // retry needs a fresh challenge either way.
    resetCaptcha();

    if (result.status === 'ok') {
      markSubmitted(tab);
      setButtonStatus('idle');
      setState({ status: 'sent', tab });
      reset();
      return;
    }

    // submitForm has already logged the status and Formspree's own `detail`.
    // That text is for us, not the visitor — it carries trace ids and error
    // codes — so the panel keeps the localized copy.
    fail(copy.errors.generic);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (buttonStatus === 'loading') return;
    void (async () => {
      const valid = await trigger();
      if (!valid) {
        pulseError();
        return;
      }
      // trigger() only reports validity. The schema's trim/lowercase live in
      // its parsed output, so read the values back through it rather than
      // posting the raw fields.
      const parsed = schema.safeParse(getValues());
      if (!parsed.success) {
        pulseError();
        return;
      }
      await send(parsed.data as ContactValues);
    })();
  };

  const busy = buttonStatus === 'loading';
  const sent = state.status === 'sent' ? copy.success[state.tab] : null;

  return (
    <div className="contact-form-shell">
      <div className="contact-tabs" role="tablist" aria-label={copy.tabsLabel}>
        {CONTACT_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${groupId}-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`${groupId}-panel`}
            tabIndex={tab === id ? 0 : -1}
            className="contact-tab"
            onClick={() => selectTab(id)}
            onKeyDown={onTabKeyDown}
          >
            {copy.tabs[id]}
          </button>
        ))}
      </div>

      {sent ? (
        <div
          className="contact-success"
          id={`${groupId}-panel`}
          role="status"
          aria-labelledby={`${groupId}-tab-${tab}`}
        >
          <span className="contact-success-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h3 className="contact-success-title">{sent.title}</h3>
          <p className="contact-success-body">{sent.body}</p>
        </div>
      ) : (
        <form
          className="contact-form"
          id={`${groupId}-panel`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${tab}`}
          onSubmit={onSubmit}
          noValidate
        >
          <label className="contact-field">
            <span className="contact-field-label">
              {applying ? copy.labels.applyName : copy.labels.name}
            </span>
            <input
              {...register('name')}
              className="contact-input"
              maxLength={NAME_MAX}
              autoComplete="name"
              placeholder={copy.placeholders.name}
              aria-invalid={errors.name ? true : undefined}
            />
            <span className="contact-field-error">{errors.name?.message}</span>
          </label>

          <label className="contact-field">
            <span className="contact-field-label">
              {applying ? copy.labels.applyEmail : copy.labels.email}
            </span>
            <input
              {...register('email')}
              className="contact-input"
              type="email"
              maxLength={EMAIL_MAX}
              autoComplete="email"
              placeholder={copy.placeholders.email}
              aria-invalid={errors.email ? true : undefined}
            />
            <span className="contact-field-error">{errors.email?.message}</span>
          </label>

          {applying ? (
            <label className="contact-field">
              <span className="contact-field-label">
                {copy.labels.social}
                <span className="contact-field-note">
                  {copy.labels.optional}
                </span>
              </span>
              <input
                {...register('social')}
                className="contact-input"
                maxLength={SOCIAL_MAX}
                placeholder={copy.placeholders.social}
                aria-invalid={errors.social ? true : undefined}
              />
              <span className="contact-field-error">
                {errors.social?.message}
              </span>
            </label>
          ) : null}

          <label className="contact-field contact-field--grow">
            <span className="contact-field-label">
              {applying ? copy.labels.applyMessage : copy.labels.message}
              {applying ? (
                <span className="contact-field-note">
                  {copy.labels.messageHint}
                </span>
              ) : null}
            </span>
            <textarea
              {...register('message')}
              className="contact-input contact-textarea"
              maxLength={MESSAGE_MAX}
              placeholder={copy.placeholders.message}
              aria-invalid={errors.message ? true : undefined}
            />
            <span className="contact-field-error">
              {errors.message?.message}
              <span className="contact-field-count">{copy.labels.maxChars}</span>
            </span>
          </label>

          <input
            {...register(HONEYPOT_FIELD)}
            className="contact-honeypot"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {captchaSiteKey ? (
            <HCaptcha
              ref={captchaRef}
              sitekey={captchaSiteKey}
              size="invisible"
              theme="dark"
              languageOverride={locale}
              // The overlay is up, so hand the deadline over to the visitor.
              onOpen={() => {
                onCaptchaOpen.current?.();
              }}
              // The rest is diagnostics — requestToken owns the flow. These put
              // hCaptcha's own reason code in the console, which is the only
              // way to tell a closed challenge from a broken one.
              onError={(event) => {
                console.error('hCaptcha error:', event);
              }}
              onClose={() => {
                console.info('hCaptcha challenge closed');
              }}
              onChalExpired={() => {
                console.info('hCaptcha challenge expired');
              }}
            />
          ) : null}

          {state.status === 'error' ? (
            <p className="contact-form-status" role="alert">
              {state.message}
            </p>
          ) : (
            <p className="contact-form-status" aria-hidden="true" />
          )}

          <SpecularButton
            type="submit"
            className="contact-submit"
            disabled={busy}
            aria-label={submitLabel}
          >
            <span
              className="contact-submit-face"
              data-status={buttonStatus}
              aria-live="polite"
            >
              <span className="contact-submit-label">{submitLabel}</span>
              <span className="contact-submit-busy" aria-hidden="true" />
              <span className="contact-submit-fail" aria-hidden="true">
                ×
              </span>
            </span>
          </SpecularButton>
        </form>
      )}
    </div>
  );
}
