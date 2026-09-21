import React from "react";

function Button({
  type = "button",
  variant = "primary",
  fullWidth = false,
  children,
  onClick,
  disabled = false,
}) {
  let className = "btn";
  if (variant === "google") className += " btn-google";
  if (fullWidth) className += " full-width";

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default Button;
