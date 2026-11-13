import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import leftBg from '../assets/auth_left_bg.png';
import { forgotPassword, verifyResetOtp } from '../api/client';

const OTP_LENGTH = 6;

// Same layout as the refined OTPVerification.jsx so both OTP screens line up.
const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    overflowX: 'hidden',
    overflowY: 'auto',
    backgroundColor: '#FFFFFF',
    fontFamily: "'Roboto', sans-serif",
  },
  left: {
    flex: '0 0 53.68%',
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
    height: '100vh',
    backgroundColor: '#1565C0',
    backgroundImage: `url(${leftBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  right: {
    flex: 1,
    minWidth: 0,
    minHeight: '100vh',
    display: 'flex',
    boxSizing: 'border-box',
    padding: '24px 48px',
    backgroundColor: '#FFFFFF',
  },
  inner: {
    width: '100%',
    maxWidth: 416,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  logo: {
    width: 200,
    height: 200,
    display: 'block',
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: -22,
  },
  heading: {
    height: 49,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 32,
    lineHeight: '32px',
    color: '#021E79',
  },
  subheading: {
    margin: '44px 0 0',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: '25px',
    color: '#292727',
    textAlign: 'left',
  },
  otpRow: { display: 'flex', gap: 12, marginTop: 24 },
  otpBox: {
    boxSizing: 'border-box',
    flex: 1,
    minWidth: 0,
    height: 62,
    padding: 0,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    color: '#292727',
    border: 'none',
    borderRadius: 10,
    backgroundColor: '#D9D9D9',
    outline: 'none',
    caretColor: '#0255AF',
  },
  resendRow: {
    margin: '16px 0 0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    color: '#484040',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    color: '#2E86FF',
  },
  primaryBtn: {
    boxSizing: 'border-box',
    width: '100%',
    height: 46,
    marginTop: 20,
    border: '1px solid rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    backgroundImage: 'linear-gradient(90deg, #0255AF 0%, #04A5A5 100%)',
    color: '#FFFFFF',
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    lineHeight: '23px',
    cursor: 'pointer',
    transition: 'filter 150ms ease, transform 150ms ease',
  },
  statusText: {
    margin: '14px 0 0',
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    lineHeight: '14px',
  },
};

export default function OTPForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // This screen only makes sense right after ForgotPassword, which hands the
  // email forward via router state. Reached directly, there's nothing to verify.
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  const handleChange = (index, value) => {
    if (value && !/^[0-9]$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Lets users paste a full code into any box.
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verifying) return;
    setError('');
    setInfo('');
    setVerifying(true);
    try {
      // Backend checks the code and returns a short-lived reset token that
      // authorises the password change on the next screen.
      const { resetToken } = await verifyResetOtp(email, digits.join(''));
      navigate('/forgot-password/new-password', { state: { email, resetToken } });
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      await forgotPassword(email);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setInfo('A new verification code has been sent.');
    } catch (err) {
      setError(err.message || 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Plus+Jakarta+Sans:wght@700&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-otp-box:focus { box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.45); }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:active:not(:disabled) { transform: translateY(1px); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .servease-resend-btn:hover:not(:disabled) { text-decoration: underline; }
        .servease-resend-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <form style={styles.inner} onSubmit={handleSubmit}>
          <img src={logo} alt="ServEase" style={styles.logo} />
          <h1 style={styles.heading}>Forgot Password</h1>
          <h2 style={styles.subheading}>Enter verification code</h2>

          <div style={styles.otpRow} onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                className="servease-otp-box"
                style={styles.otpBox}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <p style={styles.resendRow}>
            <span>If you didn’t receive a code,</span>
            <button
              type="button"
              className="servease-resend-btn"
              style={styles.resendBtn}
              onClick={handleResend}
              disabled={resending}
            >
              Resend
            </button>
          </p>

          <button
            className="servease-primary-btn"
            type="submit"
            style={styles.primaryBtn}
            disabled={verifying || digits.some((d) => !d)}
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>

          {error && <p style={{ ...styles.statusText, color: '#E53935' }}>{error}</p>}
          {!error && info && <p style={{ ...styles.statusText, color: '#04A5A5' }}>{info}</p>}
        </form>
      </div>
    </div>
  );
}