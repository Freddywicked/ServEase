/**
 * Web sign-up screen: account details, valid ID upload and terms agreement.
 *
 * The web screen has its own polished card layout that is intentionally
 * distinct from the mobile sign-up screen. Styles live in the `styles`
 * stylesheet below so the whole screen stays in this single file.
 *
 * The form is fully controlled state and nothing is hardcoded - the submit
 * handler is prepared for the backend integration (see the TODO below,
 * registerCustomer() via the shared services layer once added).
 */

import { useState } from 'react';
import logoUrl from '../assets/ServEaseLogo.png';
import uploadIconUrl from '../assets/icon_uploadbutton.png';
import checkboxIconUrl from '../assets/icon_checkbox.png';

/** Screen styles - a clean card layout tailored for the web. */
const styles = `
.signup-page {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  color: #1f2937;
  background: #f5f6f8;
}

.signup-card {
  width: 100%;
  max-width: 520px;
  background: #f0f2f5;
  border: 1px solid #e2e5ea;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(30, 42, 110, 0.06);
  padding: 36px 40px;
}

.signup-logo {
  width: 100px;
  max-width: 34vw;
  height: auto;
  display: block;
  margin: 0 auto 12px;
}

.signup-title {
  font-size: 24px;
  font-weight: 800;
  color: #1e2a6e;
  text-align: center;
  letter-spacing: -0.2px;
  margin: 0 0 4px;
}

.signup-subtitle {
  font-size: 15px;
  line-height: 1.5;
  color: #7c8499;
  text-align: center;
  margin: 0 0 32px;
}

.signup-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.signup-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #7c8499;
  margin-bottom: 8px;
}

.signup-field {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  border: 1px solid #cdd2da;
  border-radius: 10px;
  padding: 0 14px;
  background: #fff;
  margin-bottom: 16px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.signup-field:hover {
  border-color: #a8b0bc;
}

.signup-field:focus-within {
  border-color: #2e7cf6;
  box-shadow: 0 0 0 3px rgba(46, 124, 246, 0.08);
}

.signup-field input {
  flex: 1;
  height: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1f2937;
  background: transparent;
}

.signup-field input::placeholder {
  color: #a6adb8;
}

.signup-eye {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 4px;
  cursor: pointer;
  color: #a6adb8;
}

.signup-eye:hover {
  color: #2e7cf6;
}

.signup-eye svg {
  width: 20px;
  height: 20px;
}

.signup-upload {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px dashed #b8c0ca;
  border-radius: 10px;
  padding: 14px 16px;
  background: #fff;
  margin-bottom: 18px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.signup-upload:hover {
  border-color: #2e7cf6;
  background: #f8fbff;
}

.signup-upload-input {
  display: none;
}

.signup-upload-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.signup-upload-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.signup-upload-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}

.signup-upload-description {
  font-size: 12px;
  color: #a6adb8;
  margin-top: 2px;
}

.signup-upload-check {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #00bfa6;
}

.signup-terms {
  display: flex;
  align-items: flex-start;
  margin-top: 2px;
  margin-bottom: 28px;
}

.signup-checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.signup-checkbox img {
  width: 18px;
  height: 18px;
  display: block;
}

.signup-checkbox-checked {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: #0f6cd6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.signup-terms-text {
  margin: 0 0 0 12px;
  font-size: 13px;
  color: #1f2937;
  line-height: 20px;
}

.signup-terms-text a {
  color: #2e7cf6;
  font-weight: 600;
  text-decoration: none;
}

.signup-terms-text a:hover {
  text-decoration: underline;
}

.signup-error {
  margin: -8px 0 16px;
  font-size: 13px;
  color: #d92d20;
}

.signup-gradient-button {
  height: 52px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(90deg, #0f6cd6, #00bfa6);
  box-shadow: 0 4px 12px rgba(15, 108, 214, 0.2);
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
}

.signup-gradient-button:hover {
  opacity: 0.93;
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(15, 108, 214, 0.28);
}

.signup-gradient-button:active {
  opacity: 0.87;
  transform: translateY(0);
  box-shadow: 0 3px 8px rgba(15, 108, 214, 0.18);
}

.signup-footer {
  margin-top: 28px;
  font-size: 14px;
  color: #7c8499;
  text-align: center;
}

.signup-footer a {
  font-weight: 600;
  color: #2e7cf6;
  text-decoration: none;
}

.signup-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .signup-page {
    padding: 40px 16px;
  }

  .signup-card {
    padding: 28px 24px 24px;
  }

  .signup-title {
    font-size: 22px;
  }
}
`;
/** Eye icon with an optional strike-through when the password is visible. */
const EyeIcon = ({ visible }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 5c5 0 9.27 3.11 11 7-1.73 3.89-6 7-11 7S2.73 15.89 1 12c1.73-3.89 6-7 11-7zm0 2C8.24 7 4.83 9.44 3.18 12 4.83 14.56 8.24 17 12 17s7.17-2.44 8.82-5C19.17 9.44 15.76 7 12 7zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
      fill="currentColor"
    />
    {visible ? (
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ) : null}
  </svg>
);

const Signup = () => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validId, setValidId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  const updateField = key => event =>
    setForm(previous => ({ ...previous, [key]: event.target.value }));

  const handleUploadId = event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setValidId(file);
    }
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.address.trim()
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setError('');
    // TODO: register via the shared services layer (registerCustomer(form,
    // validId)) once the backend is integrated, then continue the flow
    // (Sign up -> Verify OTP -> Login) with the entered phone number.
    //
    // Until the backend exists, carry the phone forward through the URL
    // query string so the client-side flow can be previewed end to end.
    const phone = encodeURIComponent(form.phone.trim());
    window.location.href = `/verify-otp?phone=${phone}`;
  };

  return (
    <main className="signup-page">
      <style>{styles}</style>
      <div className="signup-card">
        <img className="signup-logo" src={logoUrl} alt="ServEase" />
        <h1 className="signup-title">Create your account</h1>
        <p className="signup-subtitle">
          Start booking trusted service providers near you.
        </p>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
        <label className="signup-label" htmlFor="signup-full-name">
          Full Name
        </label>
        <div className="signup-field">
          <input
            id="signup-full-name"
            type="text"
            placeholder="Juan Luna"
            autoComplete="name"
            value={form.fullName}
            onChange={updateField('fullName')}
          />
        </div>

        <label className="signup-label" htmlFor="signup-email">
          Email Address
        </label>
        <div className="signup-field">
          <input
            id="signup-email"
            type="email"
            placeholder="juanluna@gmail.com"
            autoComplete="email"
            value={form.email}
            onChange={updateField('email')}
          />
        </div>

        <label className="signup-label" htmlFor="signup-phone">
          Phone Number
        </label>
        <div className="signup-field">
          <input
            id="signup-phone"
            type="tel"
            placeholder="+63 912 345 6789"
            autoComplete="tel"
            value={form.phone}
            onChange={updateField('phone')}
          />
        </div>

        <label className="signup-label" htmlFor="signup-password">
          Password
        </label>
        <div className="signup-field">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            autoComplete="new-password"
            value={form.password}
            onChange={updateField('password')}
          />
          <button
            type="button"
            className="signup-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(previous => !previous)}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>

        <label className="signup-label" htmlFor="signup-confirm-password">
          Confirm Password
        </label>
        <div className="signup-field">
          <input
            id="signup-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={updateField('confirmPassword')}
          />
          <button
            type="button"
            className="signup-eye"
            aria-label={
              showConfirmPassword
                ? 'Hide confirm password'
                : 'Show confirm password'
            }
            onClick={() => setShowConfirmPassword(previous => !previous)}
          >
            <EyeIcon visible={showConfirmPassword} />
          </button>
        </div>

        <label className="signup-label" htmlFor="signup-address">
          Address
        </label>
        <div className="signup-field">
          <input
            id="signup-address"
            type="text"
            placeholder="Street, Barangay, Municipality, Province"
            autoComplete="street-address"
            value={form.address}
            onChange={updateField('address')}
          />
        </div>

        <span className="signup-label" id="signup-upload-label">
          Upload Valid ID
        </span>
        <label className="signup-upload" aria-labelledby="signup-upload-label">
          <input
            className="signup-upload-input"
            type="file"
            accept="image/*,.pdf"
            onChange={handleUploadId}
          />
          <img
            className="signup-upload-icon"
            src={uploadIconUrl}
            alt=""
            aria-hidden="true"
          />
          <span className="signup-upload-text">
            <span className="signup-upload-title">
              {validId ? validId.name : 'Tap to upload'}
            </span>
            <span className="signup-upload-description">
              {validId
                ? 'File attached - tap to replace'
                : 'Government-issued ID for account verification'}
            </span>
          </span>
          {validId ? (
            <svg
              className="signup-upload-check"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"
                fill="currentColor"
              />
            </svg>
          ) : null}
        </label>

        <div className="signup-terms">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            aria-label="Agree to Terms of Service and Privacy Policy"
            className="signup-checkbox"
            onClick={() => setAgreed(previous => !previous)}
          >
            {agreed ? (
              <span className="signup-checkbox-checked">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="#fff"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : (
              <img src={checkboxIconUrl} alt="" aria-hidden="true" />
            )}
          </button>
          <p className="signup-terms-text">
            {"I agree to ServEase's "}
            <a href="/terms-of-service">Terms of Service</a>
            {' and '}
            <a href="/privacy-policy">Privacy Policy</a>
          </p>
        </div>

        {error ? (
          <p className="signup-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="signup-gradient-button" type="submit">
          Next
        </button>

        <p className="signup-footer">
          {'Already have an account? '}
          <a href="/login">Log in</a>
        </p>
        </form>
      </div>
    </main>
  );
};

export default Signup;

