import React from "react";

function Input({
  label,
  type = "text",
  name,
  placeholder,
  value,
  onChange,
  required = false,
}) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}

export default Input;
