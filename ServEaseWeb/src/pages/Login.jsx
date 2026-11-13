import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import leftBg from '../assets/auth_left_bg.png';
import { login, loginWithGoogle } from '../api/client';
import { useAuth } from '../context/auth_context';

// Figma frame: 1440 x 1024. Left art panel = 773px (53.68%), form column = 573px wide.
const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    overflowX: 'hidden',
    overflowY: 'auto',
    backgroundColor: '#FFFEFE',
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
    padding: '24px 53px 24px 41px',
    backgroundColor: '#FFFEFE',
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
  form: { display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
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
  forgotRow: {
    marginTop: 23,
    height: 14,
    textAlign: 'right',
    paddingRight: 2,
  },
  forgotLink: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    color: '#2E86FF',
    textDecoration: 'none',
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
  dividerRow: {
    marginTop: 42,
    height: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dividerLine: {
    height: 0,
    margin: 0,
    border: 'none',
    borderTop: '1px solid #000000',
    opacity: 0.6,
    minWidth: 0,
  },
  dividerText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#A6A6A6',
  },
  googleBtn: {
    boxSizing: 'border-box',
    alignSelf: 'center',
    width: 233,
    maxWidth: '100%',
    height: 56,
    marginTop: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  footerText: {
    margin: '29px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#000000',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Where a signed-in user lands, shared by the password and Google paths.
  const routeAfterLogin = (user, provider) => {
    if (user.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (provider) {
      navigate('/serviceprovider/dashboard');
    } else {
      navigate('/customer/dashboard');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const { user, provider } = await login(email, password);
      setUser(user);
      routeAfterLogin(user, provider);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  // tokenResponse.access_token is Google's access token (implicit popup flow) — the
  // backend verifies it (POST /api/auth/google) and returns our own session token.
  const handleGoogleSuccess = async (tokenResponse) => {
    setError('');
    try {
      const { user, provider, needsPhone } = await loginWithGoogle(tokenResponse.access_token);
      setUser(user);
      // Brand-new Google accounts still need a verified phone number (BR-01).
      if (needsPhone) {
        navigate('/complete-profile');
        return;
      }
      routeAfterLogin(user, provider);
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.');
  };

  const startGoogleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  return (
    <div className="servease-login-page" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');
        .servease-input::placeholder { color: #A6A6A6; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-auth-link:hover { text-decoration: underline; }
        .servease-primary-btn:hover:not(:disabled),
        .servease-google-btn:hover { filter: brightness(1.04); }
        .servease-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .servease-primary-btn:active,
        .servease-google-btn:active { transform: translateY(1px); }
        .servease-divider-left { flex: 0 1 192px; }
        .servease-divider-right { flex: 0 1 202px; }
        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <div style={styles.inner}>
          <img className="servease-login-logo" src={logo} alt="ServEase" style={styles.logo} />
          <h1 className="servease-login-heading" style={styles.heading}>Welcome!</h1>

          <form style={{ ...styles.form, marginTop: 29 }} onSubmit={handleSubmit}>
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

            <div style={{ ...styles.fieldGroup, marginTop: 28 }}>
              <label style={styles.label} htmlFor="password">Password</label>
              <div className="servease-textbox" style={styles.textbox}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="servease-input"
                  placeholder="Enter your password"
                  style={styles.inputBare}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div style={styles.forgotRow}>
              <Link className="servease-auth-link" to="/forgot-password" style={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <button
              className="servease-primary-btn"
              type="submit"
              style={styles.primaryBtn}
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div style={styles.dividerRow}>
              <hr className="servease-divider-left" style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <hr className="servease-divider-right" style={styles.dividerLine} />
            </div>

            <button
              type="button"
              className="servease-google-btn"
              style={styles.googleBtn}
              onClick={() => startGoogleLogin()}
            >
              Continue with Google
            </button>

            <p style={styles.footerText}>
              <span>Don&apos;t have an account?</span>
              <Link className="servease-auth-link" to="/signup" style={styles.forgotLink}>Sign up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}