import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/servease_logo.png';
import eyeIcon from '../assets/icon_eye.png';
import leftBg from '../assets/auth_left_bg.png';
// Terms text lives in this file (not in the component) and is rendered from it.
import termsRaw from '../assets/terms_and_conditions.txt?raw';
import { useAuth } from '../context/auth_context';

// Figma frame: 1440 x 1024. Left art panel = 773px (53.68%), form column = 573px wide.
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
    padding: '26px 41px 26px 53px',
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
    textAlign: 'center',
  },
  subtitle: {
    margin: '19px 0 0',
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 20,
    lineHeight: '23px',
    color: '#7B7777',
  },
  form: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginTop: 14 },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    height: 55,
    textAlign: 'left',
    flex: 'none',
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
    marginTop: 27,
    height: 17,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#000000',
    cursor: 'pointer',
  },
  checkLinkText: {
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#021E79',
  },
  // ---- Terms modal (Figma "Terms and Conditions": 1087 x 937 card on a 35% white overlay) ----
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  modal: {
    boxSizing: 'border-box',
    width: 1087,
    maxWidth: 'calc(100vw - 32px)',
    height: 937,
    maxHeight: 'calc(100vh - 88px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  modalTitle: {
    flex: 'none',
    margin: 0,
    padding: '48px 24px 27px',
    textAlign: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    lineHeight: '19px',
    color: '#18315B',
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    margin: '0 86px 24px 118px',
    paddingRight: 14,
    textAlign: 'left',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    lineHeight: '15px',
    color: '#000000',
  },
  termsPara: { margin: '0 0 15px' },
  termsHeading: { margin: 0 },
  termsItem: { margin: 0, paddingLeft: 14, textIndent: -10 },
  modalFooter: {
    flex: 'none',
    display: 'flex',
    justifyContent: 'center',
    padding: '0 24px 48px',
  },
  doneBtn: {
    boxSizing: 'border-box',
    width: 626,
    maxWidth: '100%',
    height: 44,
    border: '1px solid rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    backgroundImage: 'linear-gradient(90deg, #0255AF 0%, #04A5A5 100%)',
    color: '#FFFFFF',
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    lineHeight: '23px',
    cursor: 'pointer',
    transition: 'filter 150ms ease, transform 150ms ease',
  },
  errorText: {
    margin: '8px 0 -6px',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 11,
    lineHeight: '13px',
    color: '#E53935',
  },
  primaryBtn: {
    boxSizing: 'border-box',
    width: '100%',
    height: 46,
    marginTop: 22,
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
    margin: '28px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: '14px',
    color: '#000000',
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

// Vertical gaps between fields, taken from the Figma tops (276, 344, 415, 486, 557, 628, 692, 756).
const GAP = { email: 13, phone: 16, password: 16, confirm: 16, address: 16, birthdate: 9, gender: 9 };

// Turns the plain-text terms file into display blocks. Nothing is typed in here:
// text before the first "1." heading = intro paragraphs; "N. Title" lines = headings;
// lines ending with ":" = plain lines; every other line = a list item.
function parseTerms(raw) {
  const blocks = [];
  let seenHeading = false;
  String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/^\d+\.\s/.test(line)) {
        seenHeading = true;
        blocks.push({ type: 'heading', text: line });
      } else if (!seenHeading || line.endsWith(':')) {
        blocks.push({ type: 'para', text: line });
      } else {
        blocks.push({ type: 'item', text: line });
      }
    });
  return blocks;
}

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
  const [showTerms, setShowTerms] = useState(false);
  const termsBlocks = useMemo(() => parseTerms(termsRaw), []);

  useEffect(() => {
    if (!showTerms) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowTerms(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTerms]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleNext = (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) return;
    // The OTP is requested on the next screen (SendOTP), after the user chooses
    // whether to receive it by SMS or by email.
    navigate('/send-otp', { state: form });
  };

  return (
    <div className="servease-signup-page" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Maven+Pro:wght@800&family=Quicksand:wght@700&family=Roboto:wght@400;700&display=swap');

        .servease-input::placeholder { color: #A6A6A6; }
        .servease-textbox:focus-within {
          border-color: #0255AF;
          box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.12);
        }
        .servease-auth-link:hover { text-decoration: underline; }
        .servease-primary-btn:hover { filter: brightness(1.04); }
        .servease-primary-btn:active { transform: translateY(1px); }

        /* Checkbox styled like the Figma "image 57" (17px, navy outline, rounded) */
        .servease-checkbox {
          appearance: none;
          -webkit-appearance: none;
          box-sizing: border-box;
          flex: none;
          width: 17px;
          height: 17px;
          margin: 0;
          border: 2px solid #021E79;
          border-radius: 4px;
          background: #FFFFFF;
          cursor: pointer;
          display: grid;
          place-content: center;
        }
        .servease-checkbox::after {
          content: '';
          width: 9px;
          height: 5px;
          border-left: 2px solid #FFFFFF;
          border-bottom: 2px solid #FFFFFF;
          transform: rotate(-45deg) translate(1px, -1px);
          opacity: 0;
        }
        .servease-checkbox:checked { background: #021E79; }
        .servease-checkbox:checked::after { opacity: 1; }
        .servease-checkbox:focus-visible { box-shadow: 0 0 0 2px rgba(2, 85, 175, 0.25); }

        .servease-terms-link:hover { text-decoration: underline; }
        .servease-done-btn:hover { filter: brightness(1.04); }
        .servease-done-btn:active { transform: translateY(1px); }

        /* Scrollbar like the Figma "Scrollbar" (17px track, #C1C1C1 thumb) */
        .servease-terms-body::-webkit-scrollbar { width: 17px; }
        .servease-terms-body::-webkit-scrollbar-track {
          background: #FAFAFA;
          box-shadow: inset 1px 0 0 #E8E8E8, inset -1px 0 0 #F0F0F0;
        }
        .servease-terms-body::-webkit-scrollbar-thumb {
          background: #C1C1C1;
          border-radius: 4px;
          border: 4px solid #FAFAFA;
          border-top-width: 0;
          border-bottom-width: 0;
        }
        .servease-terms-body { scrollbar-color: #C1C1C1 #FAFAFA; }
        @media (max-width: 1100px) {
          .servease-terms-body { margin-left: 24px !important; margin-right: 24px !important; }
        }

        @media (max-width: 900px) {
          .servease-auth-left { display: none !important; }
          .servease-auth-right { padding: 24px 24px !important; }
        }
      `}</style>

      <div className="servease-auth-left" style={styles.left} aria-hidden="true" />

      <div className="servease-auth-right" style={styles.right}>
        <div style={styles.inner}>
          <img src={logo} alt="ServEase" style={styles.logo} />
          <h1 style={styles.heading}>Create your account</h1>
          <p style={styles.subtitle}>Start booking trusted service providers near you.</p>

          <form style={styles.form} onSubmit={handleNext}>
            <div style={styles.fieldGroup}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.email }}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.phone }}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.password }}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.confirm }}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.address }}>
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

            <div style={{ ...styles.fieldGroup, marginTop: GAP.birthdate }}>
              <label style={styles.label} htmlFor="birthdate">Birthdate</label>
              <div className="servease-textbox" style={styles.textbox}>
                <input
                  id="birthdate"
                  type="date"
                  className="servease-input"
                  style={{ ...styles.inputBare, color: form.birthdate ? '#333' : '#A6A6A6' }}
                  value={form.birthdate}
                  onChange={update('birthdate')}
                  required
                />
              </div>
            </div>

            <div style={{ ...styles.fieldGroup, marginTop: GAP.gender }}>
              <label style={styles.label} htmlFor="gender">Gender</label>
              <div className="servease-textbox" style={styles.textbox}>
                <select
                  id="gender"
                  className="servease-input"
                  style={{ ...styles.selectBare, color: form.gender ? '#333' : '#A6A6A6' }}
                  value={form.gender}
                  onChange={update('gender')}
                  required
                >
                  <option value="" disabled>Male/Female</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div style={styles.checkRow}>
              <input
                id="terms"
                type="checkbox"
                className="servease-checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
              />
              <label htmlFor="terms" style={styles.checkText}>
                I agree to ServEase&apos;s
              </label>
              <button
                type="button"
                className="servease-terms-link"
                style={{ ...styles.checkLinkText, marginLeft: -4 }}
                onClick={() => setShowTerms(true)}
              >
                Terms of Service and Privacy Policy
              </button>
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <button className="servease-primary-btn" type="submit" style={styles.primaryBtn}>Next</button>

            <p style={styles.footerText}>
              <span>Already have an account?</span>
              <Link className="servease-auth-link" to="/login" style={styles.link}>Log in</Link>
            </p>
          </form>
        </div>
      </div>

      {showTerms && (
        <div style={styles.overlay} onClick={() => setShowTerms(false)}>
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="terms-title" style={styles.modalTitle}>Terms of Service and Privacy Policy</h2>

            <div className="servease-terms-body" style={styles.modalBody}>
              {termsBlocks.map((b, i) => {
                if (b.type === 'heading') return <p key={i} style={styles.termsHeading}>{b.text}</p>;
                if (b.type === 'item') return <p key={i} style={styles.termsItem}>&bull; {b.text}</p>;
                return <p key={i} style={b.text.endsWith(':') ? styles.termsHeading : styles.termsPara}>{b.text}</p>;
              })}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                className="servease-done-btn"
                style={styles.doneBtn}
                onClick={() => setShowTerms(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}