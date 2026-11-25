import { useNavigate } from "react-router-dom";
import ActionCard from "../components/ActionCard";
import homeBg from "../assets/home-bg.png";
import cardAttendance from "../assets/card-attendance.jpg";
import cardPhone from "../assets/card-phone.jpg";
import cardMember from "../assets/card-member.jpg";

/**
 * HomePage Component
 * Landing portal displaying the Figma bokeh backdrop, welcome header, and 3 ActionCards.
 */
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex-1 w-full bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundImage: `url(${homeBg})` }}
    >
      {/* Welcome Headline & Subtitle matching Figma */}
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#05619A] tracking-tight mb-2">
          Willkommen im Team-Portal
        </h1>
        <p className="text-lg sm:text-xl font-medium text-black">
          Schnellzugriff auf Ihre täglichen Tools
        </p>
      </div>

      {/* 3 Primary Navigation Cards */}
      <nav aria-label="Hauptfunktionen" className="w-full max-w-5xl">
        <ul className="flex flex-wrap justify-center gap-8">
          {/* Card 1: Anwesenheiten */}
          <ActionCard
            title="Anwesenheiten"
            subtitle="Tägliche Anwesenheit erfassen"
            image={cardAttendance}
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
                className="w-7 h-7"
              >
                <rect x="4" y="3" width="12" height="16" rx="2" />
                <path d="M8 9l2 2 4-4" />
                <circle cx="17" cy="15" r="2.5" />
                <path d="M13.5 21c.5-2 2-3 3.5-3s3 1 3.5 3" />
              </svg>
            }
          />

          {/* Card 2: Telefondoku */}
          <ActionCard
            title="Telefondoku"
            subtitle="Telefonate und Notizen dokumentieren"
            image={cardPhone}
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
                className="w-7 h-7"
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
            image={cardMember}
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
                className="w-7 h-7"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <circle cx="19" cy="15" r="3" />
                <line x1="19" y1="13.7" x2="19" y2="16.3" />
                <line x1="17.7" y1="15" x2="20.3" y2="15" />
              </svg>
            }
          />
        </ul>
      </nav>
    </div>
  );
}
