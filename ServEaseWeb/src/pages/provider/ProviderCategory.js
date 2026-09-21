import React from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
function ProviderCategory() {
  const nav = useNavigate();
  const cats = [
    "IT-RELATED DEVICE REPAIR",
    "PHONE REPAIR",
    "AUTOMOTIVE SERVICES",
    "HOME REPAIR SERVICES",
  ];
  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress">
        <span />
        <span className="active" />
        <span />
      </div>
      <form
        className="provider-form"
        onSubmit={(e) => {
          e.preventDefault();
          nav("/provider/verify");
        }}
      >
        <section className="provider-panel">
          <h3>Service Category</h3>
          <div className="category-layout">
            <div>
              <div className="category-options">
                {cats.map((x) => (
                  <label className="category-option" key={x}>
                    <input type="checkbox" />
                    {x}
                  </label>
                ))}
              </div>
              <div className="form-field">
                <label>WHAT SERVICES DO YOU PROVIDE?</label>
                <div className="inline-service">
                  <input placeholder="Services" />
                  <button className="add-more" type="button">
                    Add more
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="form-field">
                <label>YEARS OF EXPERIENCE</label>
                <input type="number" placeholder="0" />
              </div>
              <fieldset className="compact-checks">
                <legend>DO YOU OFFER HOME SERVICES?</legend>
                <label className="choice">
                  <input type="checkbox" />
                  YES
                </label>
                <label className="choice">
                  <input type="checkbox" />
                  NO
                </label>
              </fieldset>
            </div>
          </div>
        </section>
        <button className="gradient-button provider-action">NEXT</button>
      </form>
    </main>
  );
}
export default ProviderCategory;
