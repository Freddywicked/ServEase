import React from "react";
import { Link } from "react-router-dom";
import serveaseLogo from "../../assets/logo2.png";
import "./brand.css";

export function LogoMark() {
  return (
    <img className="brand-mark" src={serveaseLogo} alt="" aria-hidden="true" />
  );
}

function Brand({ large = false }) {
  return (
    <Link
      to="/"
      className={`brand ${large ? "brand--large" : ""}`}
      aria-label="ServEase home"
    >
      <LogoMark />
      {!large && (
        <span>
          Serv<span>Ease</span>
        </span>
      )}
    </Link>
  );
}

export default Brand;
