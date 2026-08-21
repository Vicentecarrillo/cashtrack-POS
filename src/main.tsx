import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { startPWA } from "./pwa";

startPWA();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
