import { useNavigate } from "react-router-dom";
import ActionCard from "../components/ActionCard";

/**
 * HomePage Component
 * Navigation dashboard connecting ActionCards to declarative router paths.
 */
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <nav aria-label="Hauptfunktionen" className="pt-8">
      <ul className="max-w-6xl mx-auto flex justify-center gap-12">
        <ActionCard label="Anwesenheit" onClick={() => navigate("/bab")} />
        <ActionCard
          label="Telefondoku"
          onClick={() => navigate("/phone-log")}
        />
        <ActionCard
          label="Neues Mitglied"
          onClick={() => navigate("/members/new")}
        />
      </ul>
    </nav>
  );
}
