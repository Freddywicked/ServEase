import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import { forgotPassword } from '../api/client';

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
  form: { position: 'absolute', inset: 0 },
  fieldGroup: {
    position: 'absolute',
    top: 457,
    left: '50%',
    width: 573,
    height: 74,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    transform: 'translateX(-50%)',
    textAlign: 'left',
  },
  label: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#1E1E1E',
  },
  textbox: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 45,
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
  errorText: {
    position: 'absolute',
    top: 606,
    left: '50%',
    width: 573,
    transform: 'translateX(-50%)',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    color: '#E53935',
    margin: 0,
  },
  primaryBtn: {
    position: 'absolute',
    top: 542,
    left: '50%',
    boxSizing: 'border-box',
    width: 573,
    height: 52,
    border: '1px solid rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    backgroundImage: 'linear-gradient(90deg, #0255AF 0%, #04A5A5 100%)',
    color: '#FFFFFF',
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    lineHeight: '23px',
    cursor: 'pointer',
    transform: 'translateX(-50%)',
    transition: 'filter 150ms ease, transform 150ms ease',
  },
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scale, setScale] = useState(getScale);

  useEffect(() => {
    const handleResize = () => setScale(getScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Asks the backend to email/SMS a verification code, then hands the email
  // forward (router state) to the OTP screen.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      navigate('/forgot-password/verify', { state: { email: email.trim() } });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');
        .servease-input::placeholder { color: #A6A6A6; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-primary-btn:hover:not(:disabled) { filter: brightness(1.04); }
        .servease-primary-btn:active:not(:disabled) { transform: translateX(-50%) translateY(1px); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>

      <div style={{ ...styles.stage, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>Forgot Password</h1>

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="email">Email Address</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="email"
                type="email"
                className="servease-input"
                placeholder="Enter your email address"
                style={styles.inputBare}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            className="servease-primary-btn"
            type="submit"
            style={styles.primaryBtn}
            disabled={submitting}
          >
            {submitting ? 'Sending...' : 'Submit'}
          </button>

          {error && <p style={styles.errorText}>{error}</p>}
        </form>
      </div>
    </div>
  );
}