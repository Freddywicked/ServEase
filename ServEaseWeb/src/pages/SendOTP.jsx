import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import leftBg from '../assets/auth_left_bg.png';
import iconPhoneColored from '../assets/icon_phone_colored.png';
import iconPhoneWhite from '../assets/icon_phone_white.png';
import iconEmailColored from '../assets/icon_email_colored.png';
import iconEmailWhite from '../assets/icon_email_white.png';
import { requestOtp } from '../api/client';

/*
 * SendOTP — step between Signup and OTPVerification.
 *
 * Data in:  the signup form, handed over by Signup.jsx through router state (location.state).
 *           The phone number / email shown on the two cards are that form's values (masked).
 * Backend:  requestOtp(form, channel)  ->  POST /api/auth/request-otp  { ...form, otp_channel }
 *             channel = 'sms'   -> backend sends the 6-digit code to form.phone
 *             channel = 'email' -> backend sends the 6-digit code to form.email
 *           Optional response: { destination } (masked target as the backend sees it).
 *           If it is missing, the locally masked phone/email is passed on instead.
 * Data out: navigate('/verify-otp', { state: { ...form, otpChannel, otpDestination } })
 */

// ---- masking helpers (derived from what the user typed on Signup; nothing hard-coded) ----
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `*** *** ${digits.slice(-4)}` : '';
}

function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

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
    maxWidth: 451,
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
    textAlign: 'center',
  },
  title: {
    margin: '35px 0 0',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: '25px',
    color: '#292727',
    textAlign: 'left',
  },
  subtitle: {
    margin: '8px 0 0 4px',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#626262',
    textAlign: 'left',
  },
  options: { display: 'flex', flexDirection: 'column', gap: 33, marginTop: 30 },
  card: {
    boxSizing: 'border-box',
    position: 'relative',
    width: '100%',
    height: 87,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '16px 21px 0 17px',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'Roboto', sans-serif",
    transition: 'background-color 150ms ease, border-color 150ms ease',
  },
  chip: {
    flex: 'none',
    width: 35,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms ease',
  },
  chipIcon: { width: 23, height: 23, objectFit: 'contain', display: 'block' },
  textCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  optTitle: {
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    letterSpacing: '0.02em',
    color: '#000000',
    marginBottom: 3,
  },
  optMasked: {
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '14px',
    letterSpacing: '0.02em',
    color: '#3F3F3F',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optSub: { fontWeight: 400, fontSize: 12, lineHeight: '14px', color: '#626262' },
  radio: {
    boxSizing: 'border-box',
    flex: 'none',
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  },
  radioDot: { width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFFFFF' },
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
    alignSelf: 'center',
    width: 336,
    maxWidth: '100%',
    height: 46,
    marginTop: 47,
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

export default function SendOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const form = location.state;

  const [channel, setChannel] = useState('sms'); // 'sms' | 'email'
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Only reachable from Signup, which passes the signup form through router state.
  useEffect(() => {
    if (!form) navigate('/signup', { replace: true });
  }, [form, navigate]);

  if (!form) return null;

  const options = [
    {
      id: 'sms',
      title: 'Text message (SMS)',
      masked: maskPhone(form.phone),
      sub: 'Send a 6-digit code via SMS',
      iconActive: iconPhoneWhite,
      iconIdle: iconPhoneColored,
    },
    {
      id: 'email',
      title: 'Email address',
      masked: maskEmail(form.email),
      sub: 'Send a 6-digit code via email',
      iconActive: iconEmailWhite,
      iconIdle: iconEmailColored,
    },
  ];

  const handleSend = async (e) => {
    e.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      // Backend sends the code to the phone (sms) or the email (email) from the signup form.
      const res = await requestOtp(form, channel);
      const chosen = options.find((o) => o.id === channel);
      navigate('/verify-otp', {
        state: {
          ...form,
          otpChannel: channel,
          otpDestination: res?.destination || chosen.masked,
        },
      });
    } catch (err) {
      setError(err.message || 'Could not send the code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="servease-sendotp-page" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Plus+Jakarta+Sans:wght@700&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-otp-option:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.35); }
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
        <form style={styles.inner} onSubmit={handleSend}>
          <img src={logo} alt="ServEase" style={styles.logo} />
          <h1 style={styles.heading}>Create your account</h1>

          <h2 style={styles.title}>Verify your identity</h2>
          <p style={styles.subtitle}>Where should we send your 6-digit security code?</p>

          <div style={styles.options} role="radiogroup" aria-label="Where to send the code">
            {options.map((o) => {
              const active = channel === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className="servease-otp-option"
                  onClick={() => setChannel(o.id)}
                  style={{
                    ...styles.card,
                    backgroundColor: active ? '#E6EBF9' : '#FFFFFF',
                    border: `1px solid ${active ? '#021E79' : '#C4C4C4'}`,
                  }}
                >
                  <span style={{ ...styles.chip, backgroundColor: active ? '#021E79' : '#D9D9D9' }}>
                    <img src={active ? o.iconActive : o.iconIdle} alt="" style={styles.chipIcon} />
                  </span>

                  <span style={styles.textCol}>
                    <span style={styles.optTitle}>{o.title}</span>
                    <span style={styles.optMasked}>{o.masked}</span>
                    <span style={styles.optSub}>{o.sub}</span>
                  </span>

                  <span
                    style={{
                      ...styles.radio,
                      backgroundColor: active ? '#021E79' : '#FFFFFF',
                      border: `1px solid ${active ? '#021E79' : '#C4C4C4'}`,
                    }}
                    aria-hidden="true"
                  >
                    {active && <span style={styles.radioDot} />}
                  </span>
                </button>
              );
            })}
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <button className="servease-primary-btn" type="submit" style={styles.primaryBtn} disabled={sending}>
            {sending ? 'Sending...' : `Send code via ${channel === 'sms' ? 'SMS' : 'email'}`}
          </button>
        </form>
      </div>
    </div>
  );
}