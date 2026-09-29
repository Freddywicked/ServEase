import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "./CustomerDashboard";
import { customerFlowApi } from "../../services/customerFlowApi";

const filters = [
  "Available",
  "Top rated",
  "Automotive",
  "IT and Phone",
  "Home Repair",
];

export default function Providers() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Available");

  useEffect(() => {
    customerFlowApi.getProviders().then(setProviders);
  }, []);

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return providers.filter((provider) => {
      const matchesQuery = [
        provider.name,
        provider.serviceType,
        ...provider.specialties,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesFilter =
        activeFilter === "Available" ? provider.available :
        activeFilter === "Top rated" ? provider.rating >= 4.8 :
        activeFilter === "IT and Phone" ?
          provider.categories.some(
            (category) => category.includes("IT") || category.includes("Phone"),
          ) :
          provider.categories.includes(activeFilter);

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, providers, query]);

  return (
    <CustomerLayout>
      <h1 className="customer-title">Service Providers</h1>
      <input
        className="customer-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search services or service providers..."
        value={query}
      />
      <div className="filter-pills">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter ? "active" : ""}
            key={filter}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="provider-list">
        {filteredProviders.map((provider) => (
          <article key={provider.id}>
            <div>
              <h3>{provider.name}</h3>
              <p>⌖ {provider.location}</p>
              <u>Reviews ({provider.rating})</u>
            </div>
            <div>
              {provider.verified && <span className="verified">✓ Verified</span>}
              {provider.available && <span className="available">Available</span>}
            </div>
            <button
              onClick={() =>
                navigate(`/customer/providers/profile?id=${provider.id}`)
              }
            >
              View Profile
            </button>
          </article>
        ))}
      </div>
    </CustomerLayout>
  );
}
