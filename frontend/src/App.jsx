import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import BabPage from "./pages/BabPage";
import PhoneLogPage from "./pages/PhoneLogPage";
import NewMemberForm from "./pages/NewMemberForm";
import clubhouseLogo from "./assets/logo.png";

/**
 * App Shell Component
 * Configures top-level header navigation and client-side routing.
 */
export default function App() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top White Navigation Bar matching Figma Spec */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Organization Logo linking to Home */}
          <Link
            to="/"
            className="cursor-pointer flex items-center focus:outline-none rounded-md p-1"
            aria-label="Zurück zur Startseite"
          >
            <img
              src={clubhouseLogo}
              alt="Sozialpsychiatrisches Zentrum München Logo"
              className="h-14 w-auto object-contain"
            />
          </Link>

          {/* Right: Light Blue Home Button (#EAF2FF) with #0B84CF icon & text */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-medium text-base transition-all shadow-xs hover:brightness-95"
            style={{
              backgroundColor: "var(--color-bg-tint)",
              color: "var(--color-brand-primary)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              <path d="M9 20v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
            </svg>
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area (full-width so HomePage background spans edge-to-edge) */}
      <main className="flex-1 w-full flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/bab"
            element={
              <div className="app-container w-full py-10">
                <BabPage onBackToHome={() => navigate("/")} />
              </div>
            }
          />
          <Route
            path="/phone-log"
            element={
              <div className="app-container w-full py-10">
                <PhoneLogPage onBackToHome={() => navigate("/")} />
              </div>
            }
          />
          <Route
            path="/members/new"
            element={
              <div className="app-container w-full py-10">
                <NewMemberForm onBackToHome={() => navigate("/")} />
              </div>
            }
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
