import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const isDevelopment = import.meta.env.VITE_NODE_ENV === "development";

createRoot(document.getElementById("root")).render(
  isDevelopment ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  )
);
