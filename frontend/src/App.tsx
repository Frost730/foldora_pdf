import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SearchModal } from './components/common/SearchModal';
import { fetchTools } from './services/api';
import { ToolDefinition } from './types';

// Lazy-loaded route views for optimized initial bundle loading
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const ToolsDirectoryPage = lazy(() => import('./pages/ToolsDirectoryPage').then(m => ({ default: m.ToolsDirectoryPage })));
const ToolWorkspacePage = lazy(() => import('./pages/ToolWorkspacePage').then(m => ({ default: m.ToolWorkspacePage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));

// Scroll to top on route change
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

// Lightweight route transition fallback
const RouteLoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center min-h-[50vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 border-2 border-[#12151c] border-t-[#c9f227] rounded-full animate-spin" />
      <span className="text-xs font-mono text-[#64748b]">Loading...</span>
    </div>
  </div>
);

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
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tools" element={<ToolsDirectoryPage />} />
              <Route path="/tool/edit-text" element={<Navigate to="/tool/edit-pdf" replace />} />
              <Route path="/tool/:toolId" element={<ToolWorkspacePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
            </Routes>
          </Suspense>
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
