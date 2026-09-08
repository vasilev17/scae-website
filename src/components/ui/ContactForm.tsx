import { zodResolver } from '@hookform/resolvers/zod';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import {
  useId,
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

// One application per browser, mirroring the coming-soon site's guard.
const APPLIED_KEY = 'scae_applied';
const BUTTON_RESET_MS = 2500;
const APPLY_SUBJECT_PREFIX = '🚀 Нова СКАИ кандидатура за членство от ';

function hasApplied(): boolean {
  try {
    return window.localStorage.getItem(APPLIED_KEY) === 'true';
  } catch {
    return false;
  }
}

function markApplied(): void {
  try {
    window.localStorage.setItem(APPLIED_KEY, 'true');
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
  const inFlight = useRef(false);
  const captchaReady = useRef(false);
  const pendingCaptcha = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const groupId = useId();
  const applying = tab === 'application';

  const {
    register,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    // Resolver reads `tab` on each validate so switching panels does not keep
    // the general schema after the application fields appear.
    resolver: (values, context, options) =>
      zodResolver(contactSchema(tab, copy.errors))(values, context, options),
    mode: 'onChange',
  });

  const formId = formIds[tab];
  const submitLabel = applying ? copy.labels.applySubmit : copy.labels.submit;

  const clear = () => {
    reset();
  };

  const selectTab = (next: ContactTab) => {
    if (next === tab) return;
    setTab(next);
    setState({ status: 'idle' });
    setButtonStatus('idle');
    window.clearTimeout(errorTimer.current);
    clear();
  };

  const pulseError = () => {
    setButtonStatus('error');
    window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => {
      setButtonStatus('idle');
    }, BUTTON_RESET_MS);
  };

  const fail = (message: string) => {
    pendingCaptcha.current = null;
    inFlight.current = false;
    captchaRef.current?.resetCaptcha();
    setState({ status: 'error', message });
    pulseError();
  };

  const waitForWidget = () => {
    if (captchaReady.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (captchaReady.current) {
          resolve();
          return;
        }
        if (Date.now() - start > 2000) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  };

  // Same sequence as coming-soon: execute() opens the challenge, onVerify
  // delivers the token. execute({ async: true }) plus onClose → resetCaptcha
  // aborted the first (General) run before the overlay painted.
  const requestToken = async () => {
    await waitForWidget();
    return new Promise<string>((resolve, reject) => {
      pendingCaptcha.current = { resolve, reject };
      captchaRef.current?.execute();
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

  const send = async () => {
    if (!formId) {
      fail(copy.errors.generic);
      return;
    }
    if (applying && hasApplied()) {
      fail(copy.errors.alreadySubmitted);
      return;
    }

    setState({ status: 'idle' });
    setButtonStatus('loading');
    inFlight.current = true;

    let token: string;
    try {
      token = await requestToken();
    } catch {
      fail(copy.errors.generic);
      return;
    }

    const values = getValues();
    const payload: FormPayload = {
      name: values.name,
      email: values.email,
      message: values.message,
      [HONEYPOT_FIELD]: values[HONEYPOT_FIELD] ?? '',
      [CAPTCHA_FIELD]: token,
    };
    if (applying) {
      const subject = `${APPLY_SUBJECT_PREFIX}${values.name}`;
      payload.social = values.social ?? '';
      payload.subject = subject;
      payload._subject = subject;
    } else {
      payload._subject = `SCAE general form — ${values.name}`;
    }

    const result = await submitForm(formId, payload);
    captchaRef.current?.resetCaptcha();

    if (result.status === 'ok') {
      inFlight.current = false;
      if (applying) markApplied();
      setButtonStatus('idle');
      setState({ status: 'sent', tab });
      clear();
      return;
    }

    fail(result.detail ?? copy.errors.generic);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (buttonStatus !== 'idle') return;
    void (async () => {
      const valid = await trigger();
      if (!valid) {
        pulseError();
        return;
      }
      await send();
    })();
  };

  const busy = buttonStatus !== 'idle';
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
              <span className="contact-field-note">{copy.labels.optional}</span>
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
            onLoad={() => {
              captchaReady.current = true;
            }}
            onVerify={(token) => {
              pendingCaptcha.current?.resolve(token);
              pendingCaptcha.current = null;
            }}
            onClose={() => {
              // Overlay dismissed. Do not resetCaptcha here — that is what
              // killed the first General submit before the UI appeared.
              const pending = pendingCaptcha.current;
              if (!pending) return;
              pendingCaptcha.current = null;
              pending.reject(new Error('closed'));
            }}
            onError={() => {
              const pending = pendingCaptcha.current;
              if (!pending) return;
              pendingCaptcha.current = null;
              pending.reject(new Error('hcaptcha'));
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
