import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import leftBg from '../assets/auth_left_bg.png';
import { resetPassword } from '../api/client';

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
    whiteSpace: 'nowrap',
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 32,
    lineHeight: '32px',
    color: '#021E79',
  },
  form: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginTop: 29 },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    height: 52,
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
    margin: '10px 0 -10px',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    lineHeight: '13px',
    color: '#E53935',
  },
  primaryBtn: {
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

  // Without an email + reset token (i.e. OTP not verified) there is nothing to reset.
  useEffect(() => {
    if (!email || !resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, resetToken, navigate]);

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
        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <div style={styles.inner}>
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
            />
            <PasswordField
              id="confirm-password"
              label="Confirm Password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              show={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              style={{ marginTop: 28 }}
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
    </div>
  );
}