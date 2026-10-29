import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SearchModal } from './components/common/SearchModal';
import { Home } from './pages/Home';
import { ToolsDirectoryPage } from './pages/ToolsDirectoryPage';
import { ToolWorkspacePage } from './pages/ToolWorkspacePage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { fetchTools } from './services/api';
import { ToolDefinition } from './types';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

export function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [tools, setTools] = useState<ToolDefinition[]>([]);

  useEffect(() => {
    fetchTools().then(setTools).catch(() => {});
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-[#f9f9f6] text-[#12151c]">
        <Header onOpenSearch={() => setSearchOpen(true)} />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tools" element={<ToolsDirectoryPage />} />
            <Route path="/tool/edit-text" element={<Navigate to="/tool/edit-pdf" replace />} />
            <Route path="/tool/:toolId" element={<ToolWorkspacePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </main>

        <Footer />

        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          tools={tools}
        />
      </div>
    </Router>
  );
}

export default App;
