import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import { resetPassword } from '../api/client';

// Same card as Login.jsx (width, colours, radius); only the height differs
// because this screen has less content.
const CARD_WIDTH = 659;
const CARD_HEIGHT = 520;

const getScale = () =>
  Math.min(1, window.innerWidth / CARD_WIDTH, window.innerHeight / CARD_HEIGHT);

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
  card: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#E2E5E8',
    borderRadius: 30,
  },
  logo: {
    position: 'absolute',
    top: 25,
    left: '50%',
    width: 150,
    height: 150,
    display: 'block',
    objectFit: 'contain',
    transform: 'translateX(-50%)',
  },
  heading: {
    position: 'absolute',
    top: 170,
    left: '50%',
    height: 49,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 32,
    lineHeight: '32px',
    letterSpacing: 0,
    color: '#021E79',
    margin: 0,
    transform: 'translateX(-50%)',
  },
  form: { position: 'absolute', inset: 0 },
  fieldGroup: {
    position: 'absolute',
    left: '6.525%',
    right: '6.525%',
    height: 52,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    textAlign: 'left',
  },
  newField: { top: 248 },
  confirmField: { top: 328 },
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
  eyeBtn: {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  },
  errorText: {
    position: 'absolute',
    top: 392,
    left: '6.525%',
    right: '6.525%',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    color: '#E53935',
    margin: 0,
  },
  primaryBtn: {
    position: 'absolute',
    top: 421,
    left: '6.525%',
    right: '6.525%',
    boxSizing: 'border-box',
    height: 46,
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

function PasswordField({ id, label, placeholder, value, onChange, show, onToggle, style }) {
  return (
    <div style={{ ...styles.fieldGroup, ...style }}>
      <label style={styles.label} htmlFor={id}>{label}</label>
      <div className="servease-textbox" style={styles.textbox}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="servease-input"
          placeholder={placeholder}
          style={styles.inputBare}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          style={styles.eyeBtn}
          onClick={onToggle}
          aria-label="Toggle password visibility"
        >
          <img
            src={eyeIcon}
            alt=""
            width={15}
            height={15}
            style={{ opacity: show ? 1 : 0.75 }}
          />
        </button>
      </div>
    </div>
  );
}

export default function NewPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const resetToken = location.state?.resetToken;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scale, setScale] = useState(getScale);

  // Without an email + reset token (i.e. OTP not verified) there is nothing to reset.
  useEffect(() => {
    if (!email || !resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, resetToken, navigate]);

  useEffect(() => {
    const handleResize = () => setScale(getScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      // Password rules (length, complexity) are enforced by the backend, which
      // returns the message shown below if the new password is rejected.
      // The backend looks the reset token up by email, so both are sent.
      await resetPassword(email, resetToken, password);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not reset your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');
        .servease-input::placeholder { color: #A6A6A6; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .servease-primary-btn:active:not(:disabled) { transform: translateY(1px); }
      `}</style>

      <div style={{ ...styles.card, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>Forgot Password</h1>

        <form style={styles.form} onSubmit={handleSubmit}>
          <PasswordField
            id="new-password"
            label="Enter New Password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            show={showPassword}
            onToggle={() => setShowPassword((s) => !s)}
            style={styles.newField}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm Password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            show={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
            style={styles.confirmField}
          />

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            className="servease-primary-btn"
            type="submit"
            style={styles.primaryBtn}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}