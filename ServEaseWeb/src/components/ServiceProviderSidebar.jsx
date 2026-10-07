import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logout } from '../api/client';
import { useAuth } from '../context/auth_context';
import fullLogo from '../assets/servease_web_sidebar.png';
import iconLogo from '../assets/servease_icon.png';
import dashboardIconWhite from '../assets/icon_dashboard_white.png';
import dashboardIconBlack from '../assets/icon_dashboard_black.png';
import requestIconWhite from '../assets/icon_request_white.png';
import requestIconBlack from '../assets/icon_request.png';
import toolsIconWhite from '../assets/icon_tools_white.png';
import toolsIconBlack from '../assets/icon_tools.png';
import historyIconWhite from '../assets/icon_history_white.png';
import historyIconBlack from '../assets/icon_history.png';
import hamburgerIcon from '../assets/icon_hamburger.png';
import dropdownIcon from '../assets/icon_dropdown.png';
import MessagingWidget from './MessagingWidget';
import Notifications from './Notifications';

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

// Messages is not a tab: it is the floating message button (MessagingWidget) at the bottom-right.
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/serviceprovider/dashboard',
    iconActive: dashboardIconWhite,
    iconInactive: dashboardIconBlack,
  },
  {
    label: 'Service Requests',
    to: '/serviceprovider/requests',
    iconActive: requestIconWhite,
    iconInactive: requestIconBlack,
  },
  {
    label: 'Active Jobs',
    to: '/serviceprovider/jobs',
    iconActive: toolsIconWhite,
    iconInactive: toolsIconBlack,
  },
  {
    label: 'Earnings',
    to: '/serviceprovider/earnings',
    iconActive: historyIconWhite,
    iconInactive: historyIconBlack,
  },
];

export default function ServiceProviderSidebar({ children, initials }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(AUTO_COLLAPSE_QUERY).matches
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const shownInitials = initials || getInitials(user?.name);
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Responsive: collapse the sidebar automatically on small screens, expand again on large ones.
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

  const handleLogout = () => {
    setMenuOpen(false);
    logout(); // removes the saved login token
    setUser(null); // clears the logged-in user in the app
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top header (same size as the admin/customer header) */}
      <header className="box-border flex h-[76px] flex-none items-center justify-between border-b border-black/15 bg-white">
        <div
          className="box-border flex h-full flex-none items-center justify-start overflow-hidden pl-5"
          style={{ width }}
        >
          <img
            src={collapsed ? iconLogo : fullLogo}
            alt="ServEase"
            className={collapsed ? 'h-8 w-8' : 'h-auto w-[136px]'}
          />
        </div>

        {/* Upper right: notification bell, user avatar, name + role, dropdown */}
        <div className="mr-4 flex flex-none items-center gap-4 sm:mr-[46px] sm:gap-[33px]">
          <Notifications viewer="provider" />

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
                {/* TODO: replace with the account's role from the backend if it differs */}
                <span className="font-[Inter] text-[15px] font-normal leading-[18px] text-[#7C7979]">
                  provider
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

      <div className="flex min-h-0 flex-1">
        {/* Sidebar (same padding and item sizes as the admin/customer sidebar) */}
        <nav
          className="box-border flex flex-none flex-col border-r border-black/15 bg-white px-[15px] pb-5 pt-4 transition-[width] duration-200"
          style={{ width }}
        >
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`mb-[14px] box-border flex items-center gap-[10px] rounded-[10px] p-[10px] no-underline ${
                  collapsed ? 'justify-center' : 'justify-start'
                } ${active ? 'bg-gradient-to-r from-[#005FCA] to-[#04A5A5]' : ''}`}
              >
                <img
                  src={active ? item.iconActive : item.iconInactive}
                  alt=""
                  className="h-[22px] w-[22px] flex-none object-contain"
                />
                {!collapsed && (
                  <span
                    className={`whitespace-nowrap font-[Quicksand] text-[12px] font-bold leading-[130%] ${
                      active ? 'text-white' : 'text-black'
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}

          <hr className="mx-[10px] mb-0 mt-[6px] border-0 border-t border-black/15" />

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mb-[6px] flex cursor-pointer items-center gap-3 rounded-md border-none bg-transparent p-[7px] text-left ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <img src={hamburgerIcon} alt="" className="h-[22px] w-[22px]" />
            {!collapsed && (
              <span className="whitespace-nowrap font-[Quicksand] text-[14px] font-bold leading-[130%] text-black">
                Collapse
              </span>
            )}
          </button>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto bg-white">{children}</main>
      </div>

      {/* Floating messages button + chat popups (bottom-right of every provider screen) */}
      <MessagingWidget viewer="provider" />
    </div>
  );
}