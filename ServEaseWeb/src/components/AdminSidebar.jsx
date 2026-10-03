import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logout } from '../api/client';
import { useAuth } from '../context/auth_context';
import fullLogo from '../assets/servease_web_sidebar.png';
import iconLogo from '../assets/servease_icon.png';
import dashboardIconWhite from '../assets/icon_dashboard_white.png';
import dashboardIconBlack from '../assets/icon_dashboard_black.png';
import userIconWhite from '../assets/icon_gear_white.png';
import userIconBlack from '../assets/icon_gear_black.png';
import hamburgerIcon from '../assets/icon_hamburger.png';
import bellIcon from '../assets/icon_ringbell.png';
import dropdownIcon from '../assets/icon_dropdown.png';

const EXPANDED_WIDTH = 229;
const COLLAPSED_WIDTH = 84;
const AUTO_COLLAPSE_QUERY = '(max-width: 900px)';

// "Mark Frederick Cerillo" -> "MC"
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

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

export default function AdminSidebar({ children, initials }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(AUTO_COLLAPSE_QUERY).matches
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, setUser } = useAuth();
  const shownInitials = initials || getInitials(user?.name);
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Responsive: collapse the sidebar automatically on small screens, expand again on large ones
  // (same behavior as CustomerSidebar and ServiceProviderSidebar). Manual toggle below still works.
  useEffect(() => {
    const mq = window.matchMedia(AUTO_COLLAPSE_QUERY);
    const onChange = (e) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close the account dropdown when clicking outside of it or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const dashboardActive = location.pathname === '/admin/dashboard';
  const usersActive = location.pathname.startsWith('/admin/users');

  const handleLogout = () => {
    setMenuOpen(false);
    logout(); // removes the saved login token
    setUser(null); // clears the logged-in user in the app
    navigate('/login', { replace: true });
  };

  const handleNotificationsClick = () => {
    // TODO: open a notifications panel once the backend notifications endpoint exists
    // (e.g. GET /api/admin/notifications).
    console.log('Notifications clicked');
  };

  // Only admin accounts may see the admin pages; everyone else goes to their own dashboard.
  if (user && user.role !== 'admin') return <Navigate to="/customer/dashboard" replace />;

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

        {/* Upper right: notification bell, user avatar, name + role, dropdown */}
        <div className="mr-4 flex flex-none items-center gap-4 sm:mr-[46px] sm:gap-[33px]">
          <button
            type="button"
            onClick={handleNotificationsClick}
            aria-label="Notifications"
            className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
          >
            <img src={bellIcon} alt="" className="h-[27px] w-[27px]" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0"
            >
              <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full bg-[#0255AF] font-[Inter] text-[24px] font-bold leading-[29px] text-white">
                {shownInitials}
              </span>

              <span className="hidden flex-col items-start text-left sm:flex">
                <span className="font-[Inter] text-[16px] font-bold leading-[19px] text-black">
                  {firstName}
                </span>
                <span className="font-[Inter] text-[15px] font-normal leading-[18px] text-[#7C7979]">
                  admin
                </span>
              </span>

              <img src={dropdownIcon} alt="" className="ml-1 h-2 w-[14px] flex-none" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 box-border w-[260px] rounded-[4px] border border-black/15 bg-white px-5 py-4 font-[Inter] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              >
                <p className="m-0 truncate text-[18px] font-bold leading-[22px] text-black">
                  {user?.name}
                </p>
                <p className="m-0 mb-4 truncate text-[16px] leading-[24px] text-[#5B5959]">
                  {user?.email}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-[16px] font-normal leading-[19px] text-[#7B1E12]"
                >
                  <LogOut size={22} color="#7B1E12" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
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