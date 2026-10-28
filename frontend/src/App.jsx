import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import BabPage from './pages/BabPage';
import PhoneLogPage from './pages/PhoneLogPage';
import NewMemberForm from './pages/NewMemberForm';
import homeIcon from './assets/icon.svg';
import clubhouseLogo from './assets/logo.png';

export default function App() {
  // Current active view: 'home' | 'bab' | 'phone' | 'new-member'
  const [currentPage, setCurrentPage] = useState('home');
  const [backendStatus, setBackendStatus] = useState('Verbindung prüfen...');
  const [isBackendOk, setIsBackendOk] = useState(false);

  // Queries the FastAPI health endpoint on port 8000
  useEffect(() => {
    fetch('http://localhost:8000/api/v1/health')
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
      <header className="bg-gray-200 border-b border-gray-300 px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => setCurrentPage('home')}
            className="cursor-pointer flex items-center gap-3"
          >
            <div className="flex items-end gap-2">
              <img 
                src={homeIcon} 
                alt="Home icon" 
                className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity" 
              />
              <img 
                src={clubhouseLogo} 
                alt="ClubHaus Logo" 
                className="h-10 w-auto object-contain" 
              />
            </div>
            <h1 className="text-base font-semibold text-gray-800">
              ClubHaus München Giesing
            </h1>
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