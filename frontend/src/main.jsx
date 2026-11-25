import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { MemberProvider } from "./context/MemberContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MemberProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MemberProvider>
  </StrictMode>,
);
