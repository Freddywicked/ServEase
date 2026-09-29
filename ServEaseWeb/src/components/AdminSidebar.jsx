import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import fullLogo from '../assets/servease_web_sidebar.png';
import iconLogo from '../assets/servease_icon.png';
import dashboardIconWhite from '../assets/icon_dashboard_white.png';
import dashboardIconBlack from '../assets/icon_dashboard_black.png';
import userIconWhite from '../assets/icon_gear_white.png';
import userIconBlack from '../assets/icon_gear_black.png';
import logoutIcon from '../assets/icon_logout.png';
import hamburgerIcon from '../assets/icon_hamburger.png';

const EXPANDED_WIDTH = 229;
const COLLAPSED_WIDTH = 84;
const AUTO_COLLAPSE_QUERY = '(max-width: 900px)';

const styles = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  header: {
    height: 76,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid rgba(0, 0, 0, 0.15)',
    boxSizing: 'border-box',
    flex: 'none',
  },
  logoCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 20,
    height: '100%',
    boxSizing: 'border-box',
    flex: 'none',
    overflow: 'hidden',
    transition: 'width 200ms',
  },
  accountBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginRight: 32,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flex: 'none',
  },
  accountLabel: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    color: '#000000',
  },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid rgba(0, 0, 0, 0.15)',
    padding: '16px 15px 20px',
    boxSizing: 'border-box',
    flex: 'none',
    transition: 'width 200ms',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    textDecoration: 'none',
    marginBottom: 14,
    boxSizing: 'border-box',
  },
  navItemActive: {
    backgroundImage: 'linear-gradient(90deg, #005FCA 0%, #04A5A5 100%)',
  },
  navLabel: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: '130%',
    whiteSpace: 'nowrap',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid rgba(0, 0, 0, 0.15)',
    margin: '6px 10px 0',
  },
  spacer: { flex: 1 },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 7,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    marginBottom: 6,
    borderRadius: 6,
  },
  bottomLabel: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 14,
    lineHeight: '130%',
    color: '#000000',
    whiteSpace: 'nowrap',
  },
  main: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', overflowY: 'auto' },
};

export default function AdminSidebar({ children }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(AUTO_COLLAPSE_QUERY).matches
  );
  const location = useLocation();
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Responsive: collapse the sidebar automatically on small screens, expand again on large ones
  // (same behavior as CustomerSidebar and ServiceProviderSidebar). Manual toggle below still works.
  useEffect(() => {
    const mq = window.matchMedia(AUTO_COLLAPSE_QUERY);
    const onChange = (e) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const dashboardActive = location.pathname === '/admin/dashboard';
  const usersActive = location.pathname.startsWith('/admin/users');

  const handleLogout = () => {
    // TODO: clear the Supabase Auth session and redirect to /login once the backend is set up
    console.log('Log out clicked');
  };

  const handleAccountClick = () => {
    // TODO: replace hardcoded "CG" with the logged-in admin's initials, and wire up
    // an account menu (profile / log out) once auth is connected
    console.log('Account menu clicked');
  };

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={{ ...styles.logoCell, width }}>
          <img
            src={collapsed ? iconLogo : fullLogo}
            alt="ServEase"
            style={collapsed ? { width: 32, height: 32 } : { width: 136, height: 'auto' }}
          />
        </div>

        <button type="button" style={styles.accountBtn} onClick={handleAccountClick}>
          <span style={styles.accountLabel}>CG</span>
          <ChevronDown size={18} color="#000000" />
        </button>
      </header>

      <div style={styles.body}>
        <nav style={{ ...styles.nav, width }}>
          <Link
            to="/admin/dashboard"
            style={{
              ...styles.navItem,
              ...(dashboardActive ? styles.navItemActive : null),
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <img src={dashboardActive ? dashboardIconWhite : dashboardIconBlack} alt="" width={22} height={22} />
            {!collapsed && (
              <span style={{ ...styles.navLabel, color: dashboardActive ? '#FFFFFF' : '#000000' }}>
                Dashboard
              </span>
            )}
          </Link>

          <Link
            to="/admin/users"
            style={{
              ...styles.navItem,
              ...(usersActive ? styles.navItemActive : null),
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <img src={usersActive ? userIconWhite : userIconBlack} alt="" width={22} height={22} />
            {!collapsed && (
              <span style={{ ...styles.navLabel, color: usersActive ? '#FFFFFF' : '#000000' }}>
                User Management
              </span>
            )}
          </Link>

          <hr style={styles.divider} />

          <div style={styles.spacer} />

          <button
            type="button"
            style={{ ...styles.bottomRow, justifyContent: collapsed ? 'center' : 'flex-start' }}
            onClick={handleLogout}
          >
            <img src={logoutIcon} alt="" width={18} height={18} />
            {!collapsed && <span style={styles.bottomLabel}>Log out</span>}
          </button>

          <button
            type="button"
            style={{ ...styles.bottomRow, justifyContent: collapsed ? 'center' : 'flex-start' }}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <img src={hamburgerIcon} alt="" width={22} height={22} />
            {!collapsed && <span style={styles.bottomLabel}>Collapse</span>}
          </button>
        </nav>

        <main style={styles.main}>{children}</main>
      </div>
    </div>
  );
}