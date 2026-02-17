import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { POSPage } from './pages/POSPage';
import { ProductsPage } from './pages/ProductsPage';
import { BalancePage } from './pages/BalancePage';
import { LayawaysPage } from './pages/LayawaysPage';
import { LoginPage } from './pages/LoginPage';
import { POSProvider, usePOS } from './context/POSContext';

function AppContent() {
  const { currentUser } = usePOS();

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<POSPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/balance" element={<BalancePage />} />
        <Route path="/layaways" element={<LayawaysPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    // FORCE CLEANUP ONE TIME
    const hasCleaned = localStorage.getItem('HAS_CLEANED_V1');
    if (!hasCleaned) {
      console.log("🧨 FORCING CLEANUP OF ZOMBIE DATA...");
      import('./db/db').then(async ({ db }) => {
        await db.products.clear();
        localStorage.setItem('HAS_CLEANED_V1', 'true');
        window.location.reload();
      });
    } else {
      import('./db/seed').then(m => m.seedDatabase());
    }
  }, []);

  return (
    <BrowserRouter>
      <POSProvider>
        <AppContent />
      </POSProvider>
    </BrowserRouter>
  );
}

export default App;
