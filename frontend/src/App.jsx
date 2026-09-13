import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import BabPage from './pages/BabPage';
import PhoneLogPage from './pages/PhoneLogPage';
import NewMemberForm from './pages/NewMemberForm';

export default function App() {
  // Current active view: 'home' | 'bab' | 'phone' | 'new-member'
  const [currentPage, setCurrentPage] = useState('home');
  const [backendStatus, setBackendStatus] = useState('Verbindung prüfen...');
  const [isBackendOk, setIsBackendOk] = useState(false);

  useEffect(() => {
    // Queries the FastAPI health endpoint on port 8000
    fetch('http://127.0.0.1:8000/api/v1/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBackendStatus(`Verbunden (${data.status || 'OK'})`);
        setIsBackendOk(true);
      })
      .catch((err) => {
        setBackendStatus(`Backend nicht erreichbar: ${err.message}`);
        setIsBackendOk(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      {/* Header: Left logo/branding, Right Clubhouse title & Backend indicator */}
      <header className="bg-gray-300 border-b border-gray-400 px-8 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-32">
          <div 
            onClick={() => setCurrentPage('home')}
            className="cursor-pointer flex items-center gap-3"
          >
            <div className="bg-white px-8 py-4 rounded border border-gray-300 text-base font-bold text-gray-700">
              Logo
            </div>
          </div>

          <div className="flex items-center gap-6">

            {/* Backend connectivity badge */}
            <div className="flex items-center gap-2 bg-gray-100 px-2.5 py-1 rounded border border-gray-300">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBackendOk ? 'bg-green-500' : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              <span className="text-xs font-mono text-gray-700">
                {backendStatus}
              </span>
            </div>

            <h1 className="text-xl font-semibold text-gray-800">
              ClubHaus Muenchen Giesing
            </h1>

          </div>
        </div>
      </header>

      {/* Main semantic area: Swapping views instead of static text */}
      <main className="max-w-5xl mx-auto px-8 py-10">
        {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
        {currentPage === 'bab' && <BabPage onBackToHome={() => setCurrentPage('home')} />}
        {currentPage === 'phone' && <PhoneLogPage onBackToHome={() => setCurrentPage('home')} />}
        {currentPage === 'new-member' && <NewMemberForm onBackToHome={() => setCurrentPage('home')} />}
      </main>
    </div>
  );
}
