import { useNavigate } from "react-router-dom";
import ActionCard from "../components/ActionCard";

/**
 * HomePage Component
 * Navigation dashboard connecting ActionCards to declarative router paths.
 */
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Hauptfunktionen"
      className="min-h-[65vh] flex items-center justify-center"
    >
      <ul className="flex flex-wrap justify-center gap-10">
        {/* Card 1: Anwesenheiten */}
        <ActionCard
          title="Anwesenheiten"
          subtitle="Tägliche Anwesenheit erfassen"
          onClick={() => navigate("/bab")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-12 h-12"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />

        {/* Card 2: Telefondoku */}
        <ActionCard
          title="Telefondoku"
          subtitle="Telefonate und Notizen dokumentieren"
          onClick={() => navigate("/phone-log")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-12 h-12"
            >
              <polyline points="22 2 16 8" />
              <polyline points="16 2 16 8 22 8" />
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />

        {/* Card 3: Neues Mitglied */}
        <ActionCard
          title="Neues Mitglied"
          subtitle="Mitglied hinzufügen"
          onClick={() => navigate("/members/new")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-12 h-12"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          }
        />
      </ul>
    </nav>
  );
}
