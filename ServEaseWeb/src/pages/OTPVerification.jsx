import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import { register } from '../api/client';
import { useAuth } from '../context/auth_context';

const OTP_LENGTH = 6;
const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 1024;

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
    top: 75,
    left: '50%',
    width: 263,
    height: 263,
    display: 'block',
    objectFit: 'contain',
    transform: 'translateX(-50%)',
  },
  heading: {
    position: 'absolute',
    top: 366,
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
    top: 472,
    left: 0,
    right: 0,
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
    top: 534,
    left: '50%',
    display: 'flex',
    gap: 16,
    transform: 'translateX(-50%)',
  },
  otpBox: {
    width: 64,
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
  errorText: {
    position: 'absolute',
    top: 616,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 13,
    color: '#E53935',
    margin: 0,
  },
  primaryBtn: {
    position: 'absolute',
    top: 656,
    left: '50%',
    boxSizing: 'border-box',
    width: 'min(519px, calc(100vw - 40px))',
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
  },
};

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const inputRefs = useRef([]);
  const [scale, setScale] = useState(() =>
    Math.min(1, window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT),
  );

  // This screen only makes sense right after Signup, which hands the form
  // forward via router state. Reached directly, there's nothing to verify.
  useEffect(() => {
    if (!location.state) {
      navigate('/signup', { replace: true });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const handleResize = () => {
      setScale(Math.min(1, window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    try {
      const user = await register(location.state, code);
      setUser(user);
      // Brand-new account: let them pick Customer or Service Provider.
      navigate('/role-selection');
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-otp-box:focus { box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.45); }
        .servease-primary-btn:hover { filter: brightness(1.04); }
        .servease-primary-btn:active { transform: translateX(-50%) translateY(1px); }
      `}</style>

      <div
        style={{
          ...styles.stage,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <img src={logo} alt="ServEase" style={styles.logo} />
        <h1 style={styles.heading}>Create your account</h1>
        <p style={styles.subheading}>Verify your Phone number</p>

        <form style={styles.form} onSubmit={handleSubmit}>
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

          <button className="servease-primary-btn" type="submit" style={styles.primaryBtn}>Verify</button>
        </form>
      </div>
    </div>
  );
}