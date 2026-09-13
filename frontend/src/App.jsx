import { useState, useEffect } from 'react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('Verbindung prüfen...');
  const [isBackendOk, setIsBackendOk] = useState(false);

  useEffect(() => {
    // Calls the FastAPI Health endpoint
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Kopfbereich */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Project Prometheus
            </h1>
            <p className="text-sm text-gray-500">Munich Giesing Clubhouse</p>
          </div>

          {/* Health-Check Anzeige */}
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md border border-gray-200">
            <span
              className={`w-3 h-3 rounded-full ${
                isBackendOk ? 'bg-green-500' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-mono text-gray-700">
              Backend: {backendStatus}
            </span>
          </div>
        </div>
      </header>

      {/* Main content: Neutral landing page */}
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <section aria-labelledby="status-heading" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 id="status-heading" className="text-lg font-semibold text-gray-800 mb-2">
            Front-end development environment ready
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            React with Vite and Tailwind CSS is set up.
          </p>

          <div className="border-t border-gray-100 pt-4 flex gap-4 text-xs text-gray-500">
            <span>• React + Vite</span>
            <span>• Tailwind CSS v4</span>
            <span>• FastAPI Handshake (Port 8000)</span>
          </div>
        </section>
      </main>
    </div>
  );
}