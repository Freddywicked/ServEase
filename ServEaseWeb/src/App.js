import React from "react";
import AppRoutes from "./routes/AppRoutes";
import "./App.css";
import "./styles/navigation.css";
import "./pages/customer/customer-pages.css";

function App() {
  return (
    <div className="app-container">
      <AppRoutes />
    </div>
  );
}

export default App;
