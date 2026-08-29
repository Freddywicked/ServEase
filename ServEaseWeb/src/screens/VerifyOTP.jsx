/**
 * Web OTP verification screen: six-box phone verification code input.
 * The styled boxes display the digits while a visually hidden input captures
 * the typing, keeping the design aligned with the ServEase mobile screen.
 *
 * Styles live in the `styles` stylesheet below so the whole screen stays
 * in this single file.
 *
 * The code starts empty and nothing is hardcoded - the Sign In handler is
 * prepared for the backend integration (see the TODO below, verifyOtp() via
 * the shared services layer once added). The phone number is passed in from
 * the Signup screen (currently via the URL query string).
 */

import { useRef, useState } from 'react';
import logoUrl from '../assets/ServEaseLogo.png';

const OTP_LENGTH = 6;

/** Screen styles - mirrors the ServEase mobile OTP screen. */
const styles = `
.verifyotp-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #1f2937;
}

.verifyotp-logo {
  width: 140px;
  max-width: 40vw;
  height: auto;
}

.verifyotp-title {
  font-size: 26px;
  font-weight: 700;
  color: #1e2a6e;
  text-align: center;
  margin: 12px 0 20px;
}

.verifyotp-subtitle {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}

.verifyotp-phone {
  font-size: 13px;
  color: #7c8499;
  margin-top: 4px;
  text-align: center;
}

.verifyotp-boxes {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 28px;
  max-width: 400px;
  width: 100%;
}

.verifyotp-box {
  flex: 1;
  height: 56px;
  max-width: 46px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #e9ebef;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: text;
}

.verifyotp-box-active {
  background: #fff;
  border-color: #0f6cd6;
}

.verifyotp-digit {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.verifyotp-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.verifyotp-error {
  width: 100%;
  max-width: 400px;
  margin: -16px 0 16px;
  font-size: 13px;
  color: #d92d20;
  text-align: center;
}

.verifyotp-gradient-button {
  width: 100%;
  max-width: 400px;
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

.verifyotp-gradient-button:hover {
  opacity: 0.9;
}

.verifyotp-gradient-button:active {
  opacity: 0.8;
}
`;
const VerifyOTP = ({ phone = '' }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleChange = event => {
    setCode(event.target.value.replace(/[^0-9]/g, ''));
  };

  const handleVerify = () => {
    if (code.length < OTP_LENGTH) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError('');
    // TODO: verify via the shared services layer (verifyOtp(phone, code))
    // once the backend is integrated, then store the token and navigate
    // onward. Until then, proceed to Login as the final step of the signup
    // flow.
    window.location.href = '/login';
  };

  return (
    <main className="verifyotp-page">
      <style>{styles}</style>
      <img className="verifyotp-logo" src={logoUrl} alt="ServEase" />

      <h1 className="verifyotp-title">Create your account</h1>
      <p className="verifyotp-subtitle">Verify your Phone number</p>
      {phone ? <p className="verifyotp-phone">{phone}</p> : null}

      <div
        className="verifyotp-boxes"
        role="button"
        tabIndex={0}
        aria-label="Verification code"
        onClick={() => inputRef.current?.focus()}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            inputRef.current?.focus();
          }
        }}
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const isActive = index === code.length;
          return (
            <div
              key={index}
              className={`verifyotp-box${isActive ? ' verifyotp-box-active' : ''}`}
            >
              <span className="verifyotp-digit">{code[index] || ''}</span>
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        className="verifyotp-hidden-input"
        value={code}
        onChange={handleChange}
        inputMode="numeric"
        maxLength={OTP_LENGTH}
        autoFocus
        aria-label="Verification code"
        tabIndex={-1}
      />

      {error ? (
        <p className="verifyotp-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="verifyotp-gradient-button"
        type="button"
        onClick={handleVerify}
      >
        Sign In
      </button>
    </main>
  );
};

export default VerifyOTP;

