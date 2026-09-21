import React from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
const Field = ({ label, placeholder, type = "text" }) => (
  <div className="form-field">
    <label>{label}</label>
    <input type={type} placeholder={placeholder} />
  </div>
);
function ProviderApply() {
  const nav = useNavigate();
  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress">
        <span className="active" />
        <span />
        <span />
      </div>
      <form
        className="provider-form"
        onSubmit={(e) => {
          e.preventDefault();
          nav("/provider/category");
        }}
      >
        <section className="provider-panel">
          <h3>Personal Details</h3>
          <div className="provider-grid">
            <div>
              <Field label="FIRST NAME" placeholder="Juan" />
              <Field label="MIDDLE NAME (OPTIONAL)" placeholder="Batumbakal" />
              <Field label="LAST NAME" placeholder="Batumbakal" />
              <Field label="EMAIL ADDRESS" placeholder="juanluna@gmail.com" />
            </div>
            <div>
              <Field label="DATE OF BIRTH" placeholder="MM/DD/Y" />
              <div className="form-field">
                <label>GENDER</label>
                <select defaultValue="MALE">
                  <option>MALE</option>
                  <option>FEMALE</option>
                  <option>OTHER</option>
                </select>
              </div>
              <Field label="PHONE NUMBER" placeholder="+63 912 345 6789" />
              <Field
                label="ADDRESS"
                placeholder="Street, Barangay, Municipality, Province"
              />
            </div>
          </div>
        </section>
        <button className="gradient-button provider-action">NEXT</button>
      </form>
    </main>
  );
}
export default ProviderApply;
