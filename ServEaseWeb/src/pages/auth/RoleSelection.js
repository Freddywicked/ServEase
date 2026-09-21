import React from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";

function RoleSelection() {
  const navigate = useNavigate();

  return (
    <main className="role-page">
      <Brand large />
      <h1 className="role-title">Continue as</h1>
      <div className="role-actions">
        <button onClick={() => navigate("/customer/dashboard")}>
          Customer
        </button>
        <button onClick={() => navigate("/provider/apply")}>
          Service Provider
        </button>
      </div>
    </main>
  );
}

export default RoleSelection;
