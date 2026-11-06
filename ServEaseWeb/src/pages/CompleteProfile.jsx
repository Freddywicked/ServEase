import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBEBEB',
    fontFamily: "'Roboto', sans-serif",
    padding: 16,
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#E2E5E8',
    borderRadius: 24,
    padding: '32px 32px 28px',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  logo: { width: 90, height: 90, objectFit: 'contain' },
  heading: {
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 26,
    color: '#021E79',
    margin: '8px 0 4px',
  },
  subtitle: { fontSize: 13, color: '#7C7979', margin: '0 0 24px', lineHeight: '18px' },
  label: {
    display: 'block',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#7C7979',
    marginBottom: 4,
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    height: 44,
    padding: 8,
    backgroundColor: '#FFFFFF',
    border: '1px solid #A6A6A6',
    borderRadius: 6,
    fontSize: 14,
    color: '#333',
    outline: 'none',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    height: 46,
    border: 'none',
    borderRadius: 8,
    backgroundImage: 'linear-gradient(90deg, #0255AF 0%, #04A5A5 100%)',
    color: '#FFFFFF',
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
  },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: { color: '#E53935', fontSize: 12, margin: '0 0 12px' },
  resend: {
    marginTop: 14,
    background: 'none',
    border: 'none',
    color: '#2E86FF',
    fontWeight: 700,
    fontSize: 12,
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
      <div style={styles.card}>
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>One more step</h1>
        <p style={styles.subtitle}>
          Your Google account is connected. Add and verify your mobile number to finish
          setting up your ServEase account.
        </p>

        {error && <p style={styles.error}>{error}</p>}

        <label style={styles.label} htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          style={styles.input}
          placeholder="09XX XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={otpSent}
        />

        {!otpSent ? (
          <button
            style={{ ...styles.button, ...(submitting ? styles.buttonDisabled : {}) }}
            onClick={sendCode}
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Send verification code'}
          </button>
        ) : (
          <>
            <label style={styles.label} htmlFor="otp">Verification Code</label>
            <input
              id="otp"
              style={styles.input}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <button
              style={{ ...styles.button, ...(submitting ? styles.buttonDisabled : {}) }}
              onClick={verify}
              disabled={submitting}
            >
              {submitting ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button style={styles.resend} onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}>
              Use a different number / resend code
            </button>
          </>
        )}
      </div>
    </div>
  );
}
