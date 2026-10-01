import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import { requestOtp } from '../api/client';
import { useAuth } from '../context/auth_context';

const CARD_WIDTH = 659;
const CARD_HEIGHT = 930;

const styles = {
  page: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100vh',
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#EBEBEB',
    padding: '24px 0',
    fontFamily: "'Roboto', sans-serif",
  },
  card: {
    position: 'relative',
    left: '50%',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#E2E5E8',
    borderRadius: 30,
  },
  logo: {
    position: 'absolute',
    top: 30,
    left: '50%',
    width: 110,
    height: 110,
    display: 'block',
    objectFit: 'contain',
    transform: 'translateX(-50%)',
  },
  heading: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Maven Pro', sans-serif",
    fontWeight: 800,
    fontSize: 32,
    lineHeight: '40px',
    letterSpacing: 0,
    color: '#021E79',
    margin: 0,
  },
  subtitle: {
    position: 'absolute',
    top: 196,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    lineHeight: '16px',
    color: '#7C7979',
    margin: 0,
  },
  form: { position: 'absolute', inset: 0 },
  fieldGroup: {
    position: 'absolute',
    left: '6.525%',
    right: '6.525%',
    height: 55,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
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
  selectBare: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
  },
  chevron: {
    flex: 'none',
    width: 0,
    height: 0,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderTop: '6px solid #7C7979',
    pointerEvents: 'none',
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
  checkRow: {
    position: 'absolute',
    top: 792,
    left: '6.525%',
    right: '6.525%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    margin: 0,
    flexShrink: 0,
    cursor: 'pointer',
    accentColor: '#0255AF',
  },
  checkText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#333',
  },
  errorText: {
    position: 'absolute',
    top: 808,
    left: '6.525%',
    right: '6.525%',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    color: '#E53935',
    margin: 0,
  },
  primaryBtn: {
    position: 'absolute',
    top: 826,
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
    fontSize: 14,
    lineHeight: '18px',
    cursor: 'pointer',
  },
  footerText: {
    position: 'absolute',
    top: 888,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#333',
    margin: 0,
  },
  link: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    color: '#2E86FF',
    textDecoration: 'none',
  },
};

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    birthdate: '',
    gender: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(() => Math.min(1, window.innerWidth / CARD_WIDTH));

  useEffect(() => {
    const handleResize = () => {
      setScale(Math.min(1, window.innerWidth / CARD_WIDTH));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) return;
    try {
      await requestOtp(form);
      navigate('/verify-otp', { state: form });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="servease-signup-page" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-input::placeholder { color: #9E9E9E; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-auth-link:hover { text-decoration: underline; }
        .servease-primary-btn:hover { filter: brightness(1.04); }
        .servease-primary-btn:active { transform: translateY(1px); }
      `}</style>

      <div
        style={{
          ...styles.card,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: (scale - 1) * CARD_HEIGHT,
        }}
      >
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.subtitle}>Start booking trusted service providers near you.</p>

        <form style={styles.form} onSubmit={handleNext}>
          <div style={{ ...styles.fieldGroup, top: 240 }}>
            <label style={styles.label} htmlFor="fullName">Full Name</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="fullName"
                className="servease-input"
                style={styles.inputBare}
                placeholder="Juan Luna"
                value={form.fullName}
                onChange={update('fullName')}
                required
              />
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 308 }}>
            <label style={styles.label} htmlFor="email">Email Address</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="email"
                type="email"
                className="servease-input"
                style={styles.inputBare}
                placeholder="juanluna@gmail.com"
                value={form.email}
                onChange={update('email')}
                required
              />
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 376 }}>
            <label style={styles.label} htmlFor="phone">Phone Number</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="phone"
                type="tel"
                className="servease-input"
                style={styles.inputBare}
                placeholder="+63 912 345 6789"
                value={form.phone}
                onChange={update('phone')}
                required
              />
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 444 }}>
            <label style={styles.label} htmlFor="password">Password</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="servease-input"
                style={styles.inputBare}
                placeholder="Create a password"
                value={form.password}
                onChange={update('password')}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword((s) => !s)}
                aria-label="Toggle password visibility"
              >
                <img
                  src={eyeIcon}
                  alt=""
                  width={15}
                  height={15}
                  style={{ opacity: showPassword ? 1 : 0.75 }}
                />
              </button>
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 512 }}>
            <label style={styles.label} htmlFor="confirmPassword">Confirm Password</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                className="servease-input"
                style={styles.inputBare}
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                required
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowConfirm((s) => !s)}
                aria-label="Toggle confirm password visibility"
              >
                <img
                  src={eyeIcon}
                  alt=""
                  width={15}
                  height={15}
                  style={{ opacity: showConfirm ? 1 : 0.75 }}
                />
              </button>
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 580 }}>
            <label style={styles.label} htmlFor="address">Address</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="address"
                className="servease-input"
                style={styles.inputBare}
                placeholder="Street, Barangay, Municipality, Province"
                value={form.address}
                onChange={update('address')}
                required
              />
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 648 }}>
            <label style={styles.label} htmlFor="birthdate">Birthdate</label>
            <div className="servease-textbox" style={styles.textbox}>
              <input
                id="birthdate"
                type="date"
                className="servease-input"
                style={{ ...styles.inputBare, color: form.birthdate ? '#333' : '#9E9E9E' }}
                value={form.birthdate}
                onChange={update('birthdate')}
                required
              />
            </div>
          </div>

          <div style={{ ...styles.fieldGroup, top: 716 }}>
            <label style={styles.label} htmlFor="gender">Gender</label>
            <div className="servease-textbox" style={styles.textbox}>
              <select
                id="gender"
                className="servease-input"
                style={{ ...styles.selectBare, color: form.gender ? '#333' : '#9E9E9E' }}
                value={form.gender}
                onChange={update('gender')}
                required
              >
                <option value="" disabled>Male/Female</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <span style={styles.chevron} aria-hidden="true" />
            </div>
          </div>

          <div style={styles.checkRow}>
            <input
              id="terms"
              type="checkbox"
              style={styles.checkbox}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <label htmlFor="terms" style={styles.checkText}>
              I agree to ServEase&apos;s Terms of Service and Privacy Policy
            </label>
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <button className="servease-primary-btn" type="submit" style={styles.primaryBtn}>Next</button>

          <p style={styles.footerText}>
            Already have an account?{' '}
            <Link className="servease-auth-link" to="/login" style={styles.link}>Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}