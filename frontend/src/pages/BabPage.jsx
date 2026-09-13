export default function BabPage({ onBackToHome }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <button 
        type="button" 
        onClick={onBackToHome} 
        className="text-blue-600 mb-4 block cursor-pointer"
      >
        ← Zurück zur Startseite
      </button>
      <h2 className="text-xl font-bold">BAB Entry</h2>
      <p className="text-gray-500 text-sm mt-2">Formular entsteht hier.</p>
    </div>
  );
}