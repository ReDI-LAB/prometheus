import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import BabPage from "./pages/BabPage";
import PhoneLogPage from "./pages/PhoneLogPage";
import NewMemberForm from "./pages/NewMemberForm";
import homeIcon from "./assets/icon.svg";
import clubhouseLogo from "./assets/logo.png";

/**
 * App Shell Component
 * Configures top-level layout, persistent backend health check, and client routing.
 */
export default function App() {
  const [backendStatus, setBackendStatus] = useState("Verbindung prüfen...");
  const [isBackendOk, setIsBackendOk] = useState(false);
  const navigate = useNavigate();

  // Queries the FastAPI health endpoint on port 8000
  useEffect(() => {
    fetch("http://localhost:8000/api/v1/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBackendStatus(`Verbunden (${data.status || "OK"})`);
        setIsBackendOk(true);
      })
      .catch((err) => {
        setBackendStatus(`Backend nicht erreichbar: ${err.message}`);
        setIsBackendOk(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      {/* Header: Left logo/branding with Link to home, Right Clubhouse title & Backend indicator */}
      <header className="bg-gray-200 border-b border-gray-300 px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="cursor-pointer flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            aria-label="Zurück zur Startseite"
          >
            <div className="flex flex-col items-center justify-around gap-1">
              <img
                src={clubhouseLogo}
                alt="ClubHaus Logo"
                className="h-20 w-auto object-contain"
              />
              <h1 className="text-base font-semibold text-gray-800">
                ClubHaus München Giesing
              </h1>
            </div>

            <img
              src={homeIcon}
              alt="Home icon"
              className="h-18 w-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>

          <div className="flex items-center gap-6">
            {/* Backend connectivity badge */}
            <div className="flex items-center gap-2 bg-gray-100 px-2.5 py-1 rounded border border-gray-300">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBackendOk ? "bg-green-500" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-xs font-mono text-gray-700">
                {backendStatus}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main semantic area: Declarative routing views */}
      <main className="max-w-4xl mx-auto px-0 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/bab"
            element={<BabPage onBackToHome={() => navigate("/")} />}
          />
          <Route
            path="/phone-log"
            element={<PhoneLogPage onBackToHome={() => navigate("/")} />}
          />
          <Route
            path="/members/new"
            element={<NewMemberForm onBackToHome={() => navigate("/")} />}
          />
          {/* Fallback redirect for unknown paths */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
