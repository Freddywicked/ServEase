import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import leftBg from '../assets/auth_left_bg.png';
import { me, requestPhoneOtp, verifyPhoneOtp } from '../api/client';
import { useAuth } from '../context/auth_context';

// Shown right after a FIRST-TIME Google sign-in: Google provides no phone number,
// but ServEase requires one verified number per account (BR-01). The user enters
// their PH mobile number, receives an SMS OTP, and verifying it attaches the
// number to their account (backend: POST /api/auth/phone/request-otp + /phone/verify).
const PHONE_RE = /^(09|\+639)\d{9}$/;

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
    maxWidth: 573,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  logo: {
    width: 150,
    height: 150,
    display: 'block',
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: -5,
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
  },
  subtitle: {
    margin: '12px auto 0',
    maxWidth: 460,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    lineHeight: '18px',
    color: '#7C7979',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    height: 52,
    marginTop: 29,
    textAlign: 'left',
  },
  label: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 9,
    lineHeight: '11px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#7C7979',
  },
  textbox: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 40,
    padding: 8,
    backgroundColor: '#FFFFFF',
    border: '1px solid #A6A6A6',
    borderRadius: 6,
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  inputBare: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#333',
  },
  error: {
    margin: '10px 0 -10px',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    lineHeight: '13px',
    color: '#E53935',
  },
  button: {
    boxSizing: 'border-box',
    width: '100%',
    height: 46,
    marginTop: 40,
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
  resend: {
    alignSelf: 'center',
    marginTop: 20,
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#2E86FF',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    cursor: 'pointer',
  },
};

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalizedPhone = phone.trim().replace(/[\s-]/g, '');

  const sendCode = async () => {
    setError('');
    if (!PHONE_RE.test(normalizedPhone)) {
      setError('Enter a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX).');
      return;
    }
    setSubmitting(true);
    try {
      await requestPhoneOtp(normalizedPhone);
      setOtpSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send the code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      const updatedUser = await verifyPhoneOtp(normalizedPhone, otp.trim());
      setUser(updatedUser);
      // Re-fetch to learn the provider status, then route like the login screen does.
      const { provider } = await me();
      if (updatedUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (provider) {
        navigate('/serviceprovider/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');
        .servease-input::placeholder { color: #A6A6A6; }
        .servease-input:disabled { color: #7C7979; cursor: not-allowed; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .servease-primary-btn:active:not(:disabled) { transform: translateY(1px); }
        .servease-resend-btn:hover { text-decoration: underline; }
        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <div style={styles.inner}>
          <img src={logo} alt="ServEase" style={styles.logo} />
          <h1 style={styles.heading}>One more step</h1>
          <p style={styles.subtitle}>
            Your Google account is connected. Add and verify your mobile number to finish
            setting up your ServEase account.
          </p>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="phone">Phone Number</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="phone"
                className="servease-input"
                style={styles.inputBare}
                placeholder="09XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={otpSent}
              />
            </div>
          </div>

          {otpSent && (
            <div style={{ ...styles.fieldGroup, marginTop: 28 }}>
              <label style={styles.label} htmlFor="otp">Verification Code</label>
              <div className="servease-textbox" style={styles.textbox}>
                <input
                  id="otp"
                  className="servease-input"
                  style={styles.inputBare}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}

          {!otpSent ? (
            <button
              className="servease-primary-btn"
              style={styles.button}
              onClick={sendCode}
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send verification code'}
            </button>
          ) : (
            <>
              <button
                className="servease-primary-btn"
                style={styles.button}
                onClick={verify}
                disabled={submitting}
              >
                {submitting ? 'Verifying…' : 'Verify and continue'}
              </button>
              <button
                className="servease-resend-btn"
                style={styles.resend}
                onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
              >
                Use a different number / resend code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}