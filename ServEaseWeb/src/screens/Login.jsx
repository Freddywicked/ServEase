/**
 * Web login screen: email/password sign-in, Google sign-in placeholder,
 * and links to the sign-up page.
 *
 * Styles live in the `styles` stylesheet below so the whole screen stays
 * in this single file.
 *
 * The form is fully controlled state and nothing is hardcoded - the submit
 * handler is prepared for the backend integration (see the TODO below,
 * POST /api/auth/login via the shared services layer once added).
 */

import { useState } from 'react';
import logoUrl from '../assets/ServEaseLogo.png';

/** Screen styles - mirrors the ServEase mobile login screen. */
const styles = `
.login-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #1f2937;
}

.login-logo {
  width: 220px;
  max-width: 60vw;
  height: auto;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e2a6e;
  margin: 28px 0 36px;
}

.login-form {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.login-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #7c8499;
  margin-bottom: 8px;
}

.login-field {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  border: 1px solid #c9cdd4;
  border-radius: 8px;
  padding: 0 14px;
  background: #fff;
  margin-bottom: 16px;
}

.login-field:focus-within {
  border-color: #2e7cf6;
  box-shadow: 0 0 0 3px rgba(46, 124, 246, 0.15);
}

.login-field-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #a6adb8;
}

.login-field input {
  flex: 1;
  height: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1f2937;
  background: transparent;
}

.login-field input::placeholder {
  color: #a6adb8;
}

.login-eye {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 4px;
  cursor: pointer;
  color: #a6adb8;
}

.login-eye:hover {
  color: #2e7cf6;
}

.login-eye svg {
  width: 20px;
  height: 20px;
}

.login-forgot {
  align-self: flex-end;
  margin: -8px 0 24px;
  font-size: 13px;
  font-weight: 600;
  color: #2e7cf6;
  text-decoration: none;
}

.login-forgot:hover {
  text-decoration: underline;
}

.login-error {
  margin: -8px 0 16px;
  font-size: 13px;
  color: #d92d20;
}

.login-gradient-button {
  height: 52px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(to right, #0f6cd6, #00bfa6);
  transition: opacity 0.15s ease;
}

.login-gradient-button:hover {
  opacity: 0.9;
}

.login-gradient-button:active {
  opacity: 0.8;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
}

.login-divider-line {
  flex: 1;
  height: 1px;
  background: #c9cdd4;
}

.login-divider-text {
  font-size: 13px;
  color: #a6adb8;
}

.login-google-button {
  align-self: center;
  width: 60%;
  height: 48px;
}

.login-footer {
  margin-top: 24px;
  font-size: 14px;
  color: #1f2937;
  text-align: center;
}

.login-footer a {
  font-weight: 600;
  color: #2e7cf6;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}
`;

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const updateField = key => event =>
    setForm(previous => ({ ...previous, [key]: event.target.value }));

  const handleSubmit = event => {
    event.preventDefault();
    if (!form.email.trim() || !form.password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    // TODO: authenticate via the backend (POST /api/auth/login) once the
    // shared services layer is added, then store the token and route to
    // the dashboard/home page.
  };

  const handleGoogleSignIn = () => {
    // TODO: integrate Google Identity Services (OAuth) sign-in.
  };

  return (
    <main className="login-page">
      <style>{styles}</style>
      <img className="login-logo" src={logoUrl} alt="ServEase" />
      <h1 className="login-title">Welcome!</h1>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label className="login-label" htmlFor="login-email">
          Email Address
        </label>
        <div className="login-field">
          <svg
            className="login-field-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.3 2 7.7 6.2L19.7 7H4.3zM4 8.4V17h16V8.4l-7.4 5.9a1 1 0 0 1-1.2 0L4 8.4z"
              fill="currentColor"
            />
          </svg>
          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            value={form.email}
            onChange={updateField('email')}
          />
        </div>

        <label className="login-label" htmlFor="login-password">
          Password
        </label>
        <div className="login-field">
          <svg
            className="login-field-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M12 2a5 5 0 0 1 5 5v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1V7a5 5 0 0 1 5-5zm3 8V7a3 3 0 1 0-6 0v3h6zm-3 4a2 2 0 0 0-1 3.73V19h2v-1.27A2 2 0 0 0 12 14z"
              fill="currentColor"
            />
          </svg>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={form.password}
            onChange={updateField('password')}
          />
          <button
            type="button"
            className="login-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(previous => !previous)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M12 5c5 0 9.27 3.11 11 7-1.73 3.89-6 7-11 7S2.73 15.89 1 12c1.73-3.89 6-7 11-7zm0 2C8.24 7 4.83 9.44 3.18 12 4.83 14.56 8.24 17 12 17s7.17-2.44 8.82-5C19.17 9.44 15.76 7 12 7zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
                fill="currentColor"
              />
              {showPassword ? (
                <path
                  d="M4 4l16 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
          </button>
        </div>

        <a className="login-forgot" href="/forgot-password">
          Forgot password?
        </a>

        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="login-gradient-button" type="submit">
          Sign in
        </button>

        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">or</span>
          <span className="login-divider-line" />
        </div>

        <button
          className="login-gradient-button login-google-button"
          type="button"
          onClick={handleGoogleSignIn}
        >
          Continue with Google
        </button>

        <p className="login-footer">
          {"Don't have an account? "}
          <a href="/signup">Sign up</a>
        </p>
      </form>
    </main>
  );
};

export default Login;
