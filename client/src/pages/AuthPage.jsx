import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './auth.css';

const SUCCESS_DISPLAY_MS = 1500;
const SUCCESS_DELAY_MS = 850;

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createSuccessTone() {
  if (typeof window === 'undefined' || !window.AudioContext) return null;

  try {
    const context = new window.AudioContext();
    const play = () => {
      const start = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(988, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.1, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
      oscillator.addEventListener('ended', () => context.close(), { once: true });
    };
    play.close = () => context.close();
    return play;
  } catch {
    return null;
  }
}

function FieldIcon({ type }) {
  if (type === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    );
  }

  if (type === 'email') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

function SuccessMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="m6 14.5 5.2 5.2L22 8.8" />
    </svg>
  );
}

function PasswordEye({ isOpen }) {
  return (
    <svg
      className={`auth-eye-icon${isOpen ? ' auth-eye-open' : ' auth-eye-closed'}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        className="auth-eye-outline"
        d="M2.5 12s3.4-7 9.5-7 9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7Z"
      />
      <circle className="auth-eye-pupil" cx="12" cy="12" r="3" />
      <path className="auth-eye-lid" d="M4 14.5c2.2 1.8 4.9 2.7 8 2.7s5.8-.9 8-2.7" />
      <g className="auth-eye-lashes auth-eye-open-lashes">
        <path d="m5.5 8-1.4-1.4M9 5.8 8.5 4M15 5.8l.5-1.8M18.5 8l1.4-1.4" />
      </g>
      <g className="auth-eye-lashes auth-eye-closed-lashes">
        <path d="m5.2 15.5-1.4 1.2M9 16.8l-.4 1.8M15 16.8l.4 1.8M18.8 15.5l1.4 1.2" />
      </g>
    </svg>
  );
}

function AuthField({
  autoComplete,
  error,
  hint,
  icon,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  placeholder,
  type = 'text',
  value,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const fieldId = `auth-${name}`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="auth-field-wrap">
      <label className="auth-label" htmlFor={fieldId}>
        <span className="sr-only">{label}</span>
      </label>
      <div className={`auth-input-shell${error ? ' auth-input-shell-error' : ''}`}>
        <span className="auth-field-icon">
          <FieldIcon type={icon} />
        </span>
        <input
          autoComplete={autoComplete}
          className="auth-input"
          id={fieldId}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          required
          type={type === 'password' && isPasswordVisible ? 'text' : type}
          value={value}
          aria-label={label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
        />
        {type === 'password' && (
          <button
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={isPasswordVisible}
            className="auth-password-toggle"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            type="button"
          >
            <PasswordEye isOpen={isPasswordVisible} />
          </button>
        )}
      </div>
      {error && (
        <p className="auth-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="auth-field-hint">{hint}</p>}
    </div>
  );
}

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: '',
    identifier: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const successTone = useRef(null);
  const pageRef = useRef(null);
  const cardRef = useRef(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const card = cardRef.current;
    if (!page || !card) return undefined;

    const fitCard = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const pageStyle = window.getComputedStyle(page);
      const horizontalPadding =
        parseFloat(pageStyle.paddingLeft) + parseFloat(pageStyle.paddingRight);
      const verticalPadding =
        parseFloat(pageStyle.paddingTop) + parseFloat(pageStyle.paddingBottom);

      card.style.zoom = '1';
      card.style.maxHeight = 'none';
      card.style.overflowY = 'visible';
      const availableWidth = Math.max(1, width - horizontalPadding);
      const availableHeight = Math.max(1, height - verticalPadding);
      const scale = Math.min(
        1,
        availableWidth / card.offsetWidth,
        availableHeight / card.scrollHeight
      );
      card.style.zoom = String(scale);
    };

    fitCard();
    window.addEventListener('resize', fitCard);
    window.visualViewport?.addEventListener('resize', fitCard);

    return () => {
      window.removeEventListener('resize', fitCard);
      window.visualViewport?.removeEventListener('resize', fitCard);
    };
  }, [errorMessage, fieldErrors, isSignup, values.password]);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setErrorMessage('');
  }

  function getErrorFields(error) {
    const details = error?.details || [];
    return Object.fromEntries(
      details
        .filter((detail) => ['username', 'email', 'password'].includes(detail.field))
        .map((detail) => [detail.field, detail.message])
    );
  }

  function validateForm() {
    const errors = {};

    if (isSignup) {
      if (!values.username.trim()) {
        errors.username = 'Enter a username.';
      } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(values.username.trim())) {
        errors.username = 'Use 3–30 letters, numbers, or underscores.';
      }

      const email = values.email.trim();
      if (!email) {
        errors.email = 'Enter an email address.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Enter a valid email.';
      }
    } else if (!values.identifier.trim()) {
      errors.identifier = 'Enter your email or username.';
    }

    const passwordLength = Array.from(values.password).length;
    if (!values.password) {
      errors.password = 'Enter a password.';
    } else if (isSignup && passwordLength < 12) {
      errors.password = `Enter ${12 - passwordLength} more characters.`;
    } else if (isSignup && passwordLength > 128) {
      errors.password = 'Use no more than 128 characters.';
    }

    if (isSignup && values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === 'loading' || status === 'success') return;

    setErrorMessage('');
    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setStatus('loading');
    successTone.current = createSuccessTone();

    try {
      const authentication = isSignup
        ? register({
            username: values.username,
            email: values.email,
            password: values.password,
          })
        : login({
            identifier: values.identifier,
            password: values.password,
          });
      await authentication;
      await delay(SUCCESS_DELAY_MS);
      setStatus('success');
      try {
        successTone.current?.();
      } catch {
        // Audio is decorative; it must not change the result of a successful auth request.
      }
      await delay(SUCCESS_DISPLAY_MS);
      navigate('/', { replace: true });
    } catch (error) {
      try {
        successTone.current?.close?.();
      } catch {
        // Audio cleanup is best-effort and must not hide the authentication error.
      }
      const serverFieldErrors = getErrorFields(error);
      setFieldErrors(serverFieldErrors);
      setErrorMessage(
        Object.keys(serverFieldErrors).length === 0
          ? error?.message ||
              `Unable to ${isSignup ? 'create your account' : 'sign in'} right now. Please try again.`
          : ''
      );
      setStatus('idle');
    }
  }

  return (
    <main className="auth-page" ref={pageRef}>
      <section className="auth-card" ref={cardRef} aria-labelledby="auth-title">
        <Link aria-label="Reddit Clone home" className="auth-brand" to="/">
          <span className="auth-brand-mark">r/</span>
          <span>reddit</span>
        </Link>

        <div className="auth-heading">
          <p className="auth-eyebrow">{isSignup ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</p>
          <h1 id="auth-title">{isSignup ? 'Create your account' : 'Sign in'}</h1>
          <p>
            {isSignup
              ? 'Find your people and join the conversation.'
              : 'Your communities are waiting for you.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup ? (
            <>
              <AuthField
                autoComplete="username"
                error={fieldErrors.username}
                icon="user"
                label="Username"
                maxLength={30}
                minLength={3}
                name="username"
                onChange={updateField}
                placeholder="Username"
                value={values.username}
              />
              <AuthField
                autoComplete="email"
                error={fieldErrors.email}
                icon="email"
                label="Email"
                maxLength={254}
                name="email"
                onChange={updateField}
                placeholder="Email"
                type="email"
                value={values.email}
              />
            </>
          ) : (
            <AuthField
              autoComplete="username"
              error={fieldErrors.identifier}
              icon="email"
              label="Email or username"
              name="identifier"
              onChange={updateField}
              placeholder="Email or username"
              value={values.identifier}
            />
          )}

          <AuthField
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            error={fieldErrors.password}
            hint={
              isSignup &&
              values.password.length > 0 &&
              Array.from(values.password).length < 12 &&
              `Enter ${12 - Array.from(values.password).length} more characters.`
            }
            icon="password"
            label="Password"
            maxLength={isSignup ? 128 : 1024}
            minLength={isSignup ? 12 : undefined}
            name="password"
            onChange={updateField}
            placeholder="Password"
            type="password"
            value={values.password}
          />

          {isSignup && (
            <AuthField
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
              icon="password"
              label="Confirm password"
              name="confirmPassword"
              onChange={updateField}
              placeholder="Confirm password"
              type="password"
              value={values.confirmPassword}
            />
          )}

          {!isSignup && (
            <div className="auth-form-options">
              <button
                className="auth-text-button"
                disabled
                title="Password recovery is coming soon"
                type="button"
              >
                Forgot password? <span className="auth-coming-soon">(soon)</span>
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="auth-error-banner" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className={`auth-submit${status === 'success' ? ' auth-submit-success' : ''}`}
            disabled={status === 'loading' || status === 'success'}
            type="submit"
            aria-live="polite"
            aria-busy={status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />
                <span>{isSignup ? 'Creating account' : 'Signing in'}</span>
              </>
            ) : status === 'success' ? (
              <>
                <span className="auth-checkmark">
                  <SuccessMark />
                </span>
                <span>{isSignup ? 'Account created' : 'Signed in'}</span>
              </>
            ) : isSignup ? (
              'Sign Up'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign In' : 'Sign Up'}</Link>
        </p>

        <div className="auth-providers">
          <button
            aria-label="Google sign-in coming soon"
            className="auth-provider-button"
            disabled
            title="Google sign-in coming soon"
            type="button"
          >
            <svg className="auth-google-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"
                fill="#4285F4"
              />
              <path
                d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H3v2.6A10 10 0 0 0 12 22Z"
                fill="#34A853"
              />
              <path d="M6.2 13.7a6 6 0 0 1 0-3.4V7.7H3a10 10 0 0 0 0 8.6l3.2-2.6Z" fill="#FBBC05" />
              <path
                d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.7l3.2 2.6C7 7.8 9.3 6 12 6Z"
                fill="#EA4335"
              />
            </svg>
          </button>
          <button
            aria-label="Apple sign-in coming soon"
            className="auth-provider-button"
            disabled
            title="Apple sign-in coming soon"
            type="button"
          >
            <svg className="auth-apple-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.4 12.8c0-2 1.6-3 1.7-3.1a3.7 3.7 0 0 0-2.9-1.6c-1.2-.1-2.3.7-2.9.7-.6 0-1.5-.7-2.5-.7a3.9 3.9 0 0 0-3.3 2c-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2s1.3-.6 2.5-.6 1.6.6 2.6.6 1.7-.9 2.4-1.9a8 8 0 0 0 1.1-2.2 3.4 3.4 0 0 1-2.2-3.2ZM14.5 6.8a3.7 3.7 0 0 0 .9-2.7 3.8 3.8 0 0 0-2.5 1.3 3.5 3.5 0 0 0-.9 2.6 3.2 3.2 0 0 0 2.5-1.2Z" />
            </svg>
          </button>
          <button
            aria-label="GitHub sign-in coming soon"
            className="auth-provider-button"
            disabled
            title="GitHub sign-in coming soon"
            type="button"
          >
            <svg className="auth-github-mark" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.5v-2c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.8 2.2 3.4 1.6.1-.7.4-1.2.7-1.5-2.5-.3-5.2-1.2-5.2-5.5 0-1.2.4-2.1 1.1-2.9-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.4 10.4 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.7 1.1 2.9 0 4.3-2.6 5.2-5.2 5.5.4.3.8 1 .8 2v3c0 .3.2.6.8.5A11.1 11.1 0 0 0 12 .9Z" />
            </svg>
          </button>
        </div>

        <p className="auth-legal">
          By continuing, you agree to keep this community welcoming and respectful.
        </p>
      </section>
    </main>
  );
}
