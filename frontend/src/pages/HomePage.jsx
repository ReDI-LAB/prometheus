import ActionCard from "../components/ActionCard";

export default function HomePage({ onNavigate }) {
  return (
    <nav aria-label="Hauptfunktionen" className="pt-8">
      <ul className="flex justify-center gap-16">
        <ActionCard label="BAB-Eintrag" onClick={() => onNavigate("bab")} />
        <ActionCard label="Telefondoku" onClick={() => onNavigate("phone")} />
        <ActionCard
          label="Neues Mitglied"
          onClick={() => onNavigate("new-member")}
        />
      </ul>
    </nav>
  );
}
