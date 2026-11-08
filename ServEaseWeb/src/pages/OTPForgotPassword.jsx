import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import { forgotPassword, verifyResetOtp } from '../api/client';

const OTP_LENGTH = 6;
const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 1024;

const getScale = () =>
  Math.min(1, window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);

const styles = {
  page: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100vh',
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: '#EBEBEB',
    fontFamily: "'Roboto', sans-serif",
  },
  stage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  logo: {
    position: 'absolute',
    top: 89,
    left: '50%',
    width: 263,
    height: 263,
    display: 'block',
    objectFit: 'contain',
    transform: 'translateX(-50%)',
  },
  heading: {
    position: 'absolute',
    top: 380,
    left: 0,
    right: 0,
    height: 49,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 32,
    lineHeight: '32px',
    color: '#021E79',
    margin: 0,
  },
  subheading: {
    position: 'absolute',
    top: 464,
    left: 0,
    right: 0,
    height: 30,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    lineHeight: '30px',
    textAlign: 'center',
    color: '#292727',
    margin: 0,
  },
  form: { position: 'absolute', inset: 0 },
  otpRow: {
    position: 'absolute',
    top: 527,
    left: '50%',
    display: 'flex',
    gap: 16,
    transform: 'translateX(-50%)',
  },
  otpBox: {
    width: 64.5,
    height: 71,
    padding: 0,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 28,
    color: '#292727',
    border: 'none',
    borderRadius: 10,
    backgroundColor: '#D9D9D9',
    outline: 'none',
    caretColor: '#0255AF',
  },
  resendRow: {
    position: 'absolute',
    top: 620,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: '23px',
    color: '#484040',
    margin: 0,
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: '23px',
    color: '#2E86FF',
  },
  primaryBtn: {
    position: 'absolute',
    top: 675,
    left: '50%',
    boxSizing: 'border-box',
    width: 467,
    height: 62,
    border: '1px solid rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    backgroundImage: 'linear-gradient(90deg, #0255AF 0%, #04A5A5 100%)',
    color: '#FFFFFF',
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    lineHeight: '23px',
    cursor: 'pointer',
    transform: 'translateX(-50%)',
    transition: 'filter 150ms ease, transform 150ms ease',
  },
  statusText: {
    position: 'absolute',
    top: 749,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 13,
    margin: 0,
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
  const [scale, setScale] = useState(getScale);

  // This screen only makes sense right after ForgotPassword, which hands the
  // email forward via router state. Reached directly, there's nothing to verify.
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    const handleResize = () => setScale(getScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-otp-box:focus { box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.45); }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:active:not(:disabled) { transform: translateX(-50%) translateY(1px); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .servease-resend-btn:hover:not(:disabled) { text-decoration: underline; }
        .servease-resend-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div style={{ ...styles.stage, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>Forgot Password</h1>
        <p style={styles.subheading}>Enter verification code</p>

        <form style={styles.form} onSubmit={handleSubmit}>
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