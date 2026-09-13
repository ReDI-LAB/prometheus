import ActionCard from '../components/ActionCard';

export default function HomePage({ onNavigate }) {
  return (
    <nav aria-label="Hauptfunktionen" className="pt-8">
      <ul className="flex justify-center gap-16">
        <ActionCard
          label="BAB Entry"
          onClick={() => onNavigate('bab')}
        />
        <ActionCard
          label="Phone Log"
          onClick={() => onNavigate('phone')}
        />
        <ActionCard
          label="New Member"
          onClick={() => onNavigate('new-member')}
        />
      </ul>
    </nav>
  );
}