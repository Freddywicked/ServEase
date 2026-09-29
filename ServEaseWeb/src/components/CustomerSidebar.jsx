import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import fullLogo from '../assets/servease_web_sidebar.png';
import iconLogo from '../assets/servease_icon.png';
import dashboardIconWhite from '../assets/icon_dashboard_white.png';
import dashboardIconBlack from '../assets/icon_dashboard_black.png';
import gearIconWhite from '../assets/icon_gear_white.png';
import gearIconBlack from '../assets/icon_gear_black.png';
import toolsIconWhite from '../assets/icon_tools_white.png';
import toolsIconBlack from '../assets/icon_tools.png';
import chatIconWhite from '../assets/icon_chatbubble_white.png';
import chatIconBlack from '../assets/icon_chatbubble.png';
import historyIconWhite from '../assets/icon_history_white.png';
import historyIconBlack from '../assets/icon_history.png';
import logoutIcon from '../assets/icon_logout.png';
import hamburgerIcon from '../assets/icon_hamburger.png';

const EXPANDED_WIDTH = 229;
const COLLAPSED_WIDTH = 84;
const AUTO_COLLAPSE_QUERY = '(max-width: 900px)';

// Fallback shown when no logged-in customer data is available yet (matches the Figma design).
const DEFAULT_INITIALS = 'CG';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    to: '/customer/dashboard',
    iconActive: dashboardIconWhite,
    iconInactive: dashboardIconBlack,
  },
  {
    label: 'Find Service Providers',
    to: '/customer/providers',
    iconActive: gearIconWhite,
    iconInactive: gearIconBlack,
  },
  {
    label: 'Track Requests',
    to: '/customer/requests',
    iconActive: toolsIconWhite,
    iconInactive: toolsIconBlack,
  },
  {
    label: 'Messages',
    to: '/customer/messages',
    iconActive: chatIconWhite,
    iconInactive: chatIconBlack,
  },
  {
    label: 'History',
    to: '/customer/history',
    iconActive: historyIconWhite,
    iconInactive: historyIconBlack,
  },
];

export default function CustomerSidebar({ children, initials = DEFAULT_INITIALS }) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(AUTO_COLLAPSE_QUERY).matches
  );
  const location = useLocation();
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Responsive: collapse the sidebar automatically on small screens, expand again on large ones.
  useEffect(() => {
    const mq = window.matchMedia(AUTO_COLLAPSE_QUERY);
    const onChange = (e) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleLogout = () => {
    // TODO: clear the Supabase Auth session and redirect to /login once the backend is set up
    console.log('Log out clicked');
  };

  const handleAccountClick = () => {
    // TODO: wire up an account menu (profile / log out) once auth is connected
    console.log('Account menu clicked');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top header (same size as the admin header) */}
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

        <button
          type="button"
          onClick={handleAccountClick}
          className="mr-4 flex flex-none cursor-pointer items-center gap-1 border-none bg-transparent p-0 sm:mr-8"
        >
          <span className="font-[Quicksand] text-[22px] font-bold text-black">{initials}</span>
          <ChevronDown size={18} color="#000000" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar (same padding and item sizes as the admin sidebar) */}
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
            onClick={handleLogout}
            className={`mb-[6px] flex cursor-pointer items-center gap-3 rounded-md border-none bg-transparent p-[7px] text-left ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <img src={logoutIcon} alt="" className="h-[18px] w-[18px]" />
            {!collapsed && (
              <span className="whitespace-nowrap font-[Quicksand] text-[14px] font-bold leading-[130%] text-black">
                Log Out
              </span>
            )}
          </button>

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
    </div>
  );
}