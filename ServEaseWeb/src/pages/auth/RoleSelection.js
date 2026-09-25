import React from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { registrationApi } from "../../services/registrationApi";

function RoleSelection() {
  const navigate = useNavigate();

  async function selectRole(role, destination) {
    await registrationApi.selectRole(role);
    navigate(destination);
  }

  return (
    <main className="role-page">
      <Brand large />
      <h1 className="role-title">Continue as</h1>
      <div className="role-actions">
        <button onClick={() => selectRole("Customer", "/customer/dashboard")}>
          Customer
        </button>
        <button
          onClick={() => selectRole("Service Provider", "/provider/category")}
        >
          Service Provider
        </button>
      </div>
    </main>
  );
}

export default RoleSelection;
