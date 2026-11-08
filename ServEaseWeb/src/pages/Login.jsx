import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import { login, loginWithGoogle } from '../api/client';
import { useAuth } from '../context/auth_context';

const CARD_WIDTH = 659;
const CARD_HEIGHT = 737;

// The multicolor Google "G" mark, shown in a white chip on the gradient button.
function GoogleGLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

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
    width: 160,
    height: 49,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  emailField: { top: 248 },
  passwordField: { top: 328 },
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
    position: 'absolute',
    top: 403,
    right: '6.525%',
    height: 14,
    textAlign: 'right',
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
    position: 'absolute',
    top: 424,
    left: '6.525%',
    right: '6.525%',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    color: '#E53935',
    margin: 0,
  },
  primaryBtn: {
    position: 'absolute',
    top: 453,
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
  dividerRow: {
    position: 'absolute',
    top: 541,
    left: 120,
    width: 430,
    maxWidth: '65.25%',
    height: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    height: 0,
    margin: 0,
    border: 'none',
    borderTop: '1px solid #000000',
    opacity: 0.6,
  },
  dividerLineLeft: { flex: '0 1 192px' },
  dividerLineRight: { flex: '0 1 202px' },
  dividerText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#A6A6A6',
  },
  // Custom Google button: same gradient, size and width as the Sign in button, with
  // the Google "G" in a white chip. It triggers useGoogleLogin (popup flow), which
  // returns an access token the backend verifies — so we are free to style it.
  googleBtn: {
    position: 'absolute',
    top: 581,
    left: '6.525%',
    right: '6.525%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
  googleChip: {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  footerText: {
    position: 'absolute',
    top: 666,
    left: 0,
    width: '100%',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#000000',
    margin: 0,
    textAlign: 'center',
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
  const [scale, setScale] = useState(() =>
    Math.min(1, window.innerWidth / CARD_WIDTH, window.innerHeight / CARD_HEIGHT),
  );

  useEffect(() => {
    const handleResize = () => {
      setScale(Math.min(1, window.innerWidth / CARD_WIDTH, window.innerHeight / CARD_HEIGHT));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // The custom gradient button starts the same Google sign-in the official button
  // did, but as a popup we fully control the look of.
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
        .servease-primary-btn:active { transform: translateY(1px); }
        .servease-google-btn:active { translate: 0 1px; }
      `}</style>
      <div style={{ ...styles.card, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <img className="servease-login-logo" src={logo} alt="ServEase" style={styles.logo} />
        <h1 className="servease-login-heading" style={styles.heading}>Welcome!</h1>

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={{ ...styles.fieldGroup, ...styles.emailField }}>
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

          <div style={{ ...styles.fieldGroup, ...styles.passwordField }}>
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
            <Link className="servease-auth-link" to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
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
            <hr style={{ ...styles.dividerLine, ...styles.dividerLineLeft }} />
            <span style={styles.dividerText}>or</span>
            <hr style={{ ...styles.dividerLine, ...styles.dividerLineRight }} />
          </div>

          <button
            type="button"
            className="servease-google-btn"
            style={styles.googleBtn}
            onClick={() => startGoogleLogin()}
          >
            <span style={styles.googleChip}>
              <GoogleGLogo />
            </span>
            Continue with Google
          </button>

          <p style={styles.footerText}>
            Don&apos;t have an account?{' '}
            <Link className="servease-auth-link" to="/signup" style={styles.forgotLink}>Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}