import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { registrationApi } from "../../services/registrationApi";

const categories = [
  "IT-RELATED DEVICE REPAIR",
  "PHONE REPAIR",
  "AUTOMOTIVE SERVICES",
  "HOME REPAIR SERVICES",
];

export default function ProviderCategory() {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [serviceInput, setServiceInput] = useState("");
  const [servicesOffered, setServicesOffered] = useState([]);
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [offersHomeService, setOffersHomeService] = useState("");

  function toggleCategory(category) {
    setSelectedCategories((currentCategories) =>
      currentCategories.includes(category)
        ? currentCategories.filter((item) => item !== category)
        : [...currentCategories, category],
    );
  }

  function addService() {
    const trimmedService = serviceInput.trim();

    if (!trimmedService || servicesOffered.includes(trimmedService)) return;

    setServicesOffered((currentServices) => [
      ...currentServices,
      trimmedService,
    ]);
    setServiceInput("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    await registrationApi.saveProviderDetails({
      categories: selectedCategories,
      servicesOffered,
      yearsOfExperience: Number(yearsOfExperience),
      offersHomeService: offersHomeService === "yes",
    });
    navigate("/provider/verify");
  }

  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress">
        <span className="active" />
        <span />
      </div>
      <form className="provider-form" onSubmit={handleSubmit}>
        <section className="provider-panel">
          <h3>Service Category</h3>
          <div className="category-layout">
            <div>
              <div className="category-options">
                {categories.map((category) => (
                  <label className="category-option" key={category}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
              <div className="form-field">
                <label>WHAT SERVICES DO YOU PROVIDE?</label>
                <div className="inline-service">
                  <input
                    value={serviceInput}
                    onChange={(event) => setServiceInput(event.target.value)}
                    placeholder="Services"
                  />
                  <button className="add-more" onClick={addService} type="button">
                    Add more
                  </button>
                </div>
                {servicesOffered.length > 0 && (
                  <p className="selected-services">
                    {servicesOffered.join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="form-field">
                <label>YEARS OF EXPERIENCE</label>
                <input
                  min="0"
                  onChange={(event) => setYearsOfExperience(event.target.value)}
                  required
                  type="number"
                  value={yearsOfExperience}
                />
              </div>
              <fieldset className="compact-checks">
                <legend>DO YOU OFFER HOME SERVICES?</legend>
                <label className="choice">
                  <input
                    checked={offersHomeService === "yes"}
                    name="home-service"
                    onChange={() => setOffersHomeService("yes")}
                    required
                    type="radio"
                  />
                  YES
                </label>
                <label className="choice">
                  <input
                    checked={offersHomeService === "no"}
                    name="home-service"
                    onChange={() => setOffersHomeService("no")}
                    type="radio"
                  />
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
