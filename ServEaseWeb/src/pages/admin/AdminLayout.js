import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faRightFromBracket,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

const links = [
  [faChartLine, "Dashboard", "/admin/dashboard"],
  [faUsers, "User Management", "/admin/users"],
];

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Brand />
        <button className="admin-profile">
          CG <FontAwesomeIcon icon={faBars} />
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
        <button className="admin-logout" onClick={() => navigate("/signin")}>
          <FontAwesomeIcon icon={faRightFromBracket} /> <span>Log Out</span>
        </button>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
