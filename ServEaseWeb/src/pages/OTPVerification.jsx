import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import leftBg from '../assets/auth_left_bg.png';
import { register } from '../api/client';
import { useAuth } from '../context/auth_context';

/*
 * OTPVerification — last step of signup.
 *
 * Data in (router state from SendOTP.jsx):
 *   { ...signupForm, otpChannel: 'sms' | 'email', otpDestination }
 *   otpChannel     = where the backend sent the 6-digit code (the phone or the email from the form)
 *   otpDestination = masked target returned by the backend (or the masked phone/email from the form)
 * Backend: register(form, code, otpChannel)  ->  POST /api/auth/register { ...form, otp, otp_channel }
 *   The backend checks the code against the one it sent to that channel, then creates the account.
 */

const OTP_LENGTH = 6;

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
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 32,
    lineHeight: '32px',
    color: '#021E79',
    textAlign: 'center',
  },
  title: {
    margin: '44px 0 0',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: '25px',
    color: '#292727',
    textAlign: 'left',
  },
  subtitle: {
    margin: '8px 0 0',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#626262',
    textAlign: 'left',
    wordBreak: 'break-all',
  },
  otpRow: {
    display: 'flex',
    gap: 12,
    marginTop: 36,
  },
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
  errorText: {
    margin: '14px 0 -14px',
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    lineHeight: '14px',
    color: '#E53935',
  },
  primaryBtn: {
    boxSizing: 'border-box',
    width: '100%',
    height: 46,
    marginTop: 36,
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
};

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef([]);

  // Split the router state: the signup form, and the channel the user chose on SendOTP.
  const { otpChannel, otpDestination, ...form } = location.state || {};

  // Reached directly -> go back to Signup. Reached without choosing SMS/email -> go to SendOTP.
  useEffect(() => {
    if (!location.state) {
      navigate('/signup', { replace: true });
    } else if (!otpChannel) {
      navigate('/send-otp', { replace: true, state: location.state });
    }
  }, [location.state, otpChannel, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const code = digits.join('');
    try {
      // Backend verifies the code that was sent to the chosen channel, then creates the account.
      const user = await register(form, code, otpChannel);
      setUser(user);
      // Brand-new account: straight to the Customer Dashboard (role selection was removed).
      navigate('/customer/dashboard');
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!location.state || !otpChannel) return null;

  return (
    <div className="servease-otp-page" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Plus+Jakarta+Sans:wght@700&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-otp-box:focus { box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.45); }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .servease-primary-btn:active { transform: translateY(1px); }

        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <form style={styles.inner} onSubmit={handleSubmit}>
          <img src={logo} alt="ServEase" style={styles.logo} />
          <h1 style={styles.heading}>Create your account</h1>

          <h2 style={styles.title}>Verify your identity</h2>
          <p style={styles.subtitle}>Sending the 6-digit code to {otpDestination}</p>

          <div style={styles.otpRow}>
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

          {error && <p style={styles.errorText}>{error}</p>}

          <button className="servease-primary-btn" type="submit" style={styles.primaryBtn} disabled={submitting}>
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}