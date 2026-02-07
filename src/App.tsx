import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { POSPage } from './pages/POSPage';
import { ProductsPage } from './pages/ProductsPage';
import { BalancePage } from './pages/BalancePage';
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    import('./db/seed').then(m => m.seedDatabase());
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
