import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faCaretDown,
  faGear,
  faRightFromBracket,
  faTableCellsLarge,
} from "@fortawesome/free-solid-svg-icons";

const links = [
  [faTableCellsLarge, "Dashboard", "/admin/dashboard"],
  [faGear, "User Management", "/admin/users"],
];

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`admin-shell${collapsed ? " admin-shell--collapsed" : ""}`}>
      <header className="admin-header">
        <Brand />
        <button className="admin-profile">
          CG <FontAwesomeIcon icon={faCaretDown} />
        </button>
      </header>
      <aside className="admin-sidebar">
        <nav>
          {links.map(([icon, label, to]) => (
            <Link key={to} to={to} className={pathname === to ? "active" : ""}>
              <span>
                <FontAwesomeIcon icon={icon} />
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-actions">
          <button className="admin-logout" onClick={() => navigate("/signin")}>
            <FontAwesomeIcon icon={faRightFromBracket} /> <span>Log Out</span>
          </button>
          {pathname === "/admin/dashboard" && (
            <button
              className="admin-collapse"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <FontAwesomeIcon icon={faBars} /> <span>Collapse</span>
            </button>
          )}
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
