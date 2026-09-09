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

const SUBMITTED_KEY: Record<ContactTab, string> = {
  general: 'scae_contacted',
  application: 'scae_applied',
};
const BUTTON_RESET_MS = 2500;
const APPLY_SUBJECT_PREFIX = '🚀 Нова СКАИ кандидатура за членство от ';

const CAPTCHA_HANDSHAKE_MS = 20_000;
const CAPTCHA_SOLVE_MS = 120_000;

const CAPTCHA_CANCELLED = new Set([
  'challenge-closed',
  'hcaptcha-closed',
  'closed',
]);

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

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
  };

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
    if (applying) {
      payload.social = values.social ?? '';
      payload._subject = `${APPLY_SUBJECT_PREFIX}${values.name}`;
    } else {
      payload._subject = `SCAE general form — ${values.name}`;
    }

    const result = await submitForm(formId, payload);
    resetCaptcha();

    if (result.status === 'ok') {
      markSubmitted(tab);
      setButtonStatus('idle');
      setState({ status: 'sent', tab });
      reset();
      return;
    }

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
