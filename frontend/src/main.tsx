import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/dashboard/page';
import DonorPage from './pages/donor/page';
import AuthPage from './pages/auth/page';
import HomePage from './pages/home/page';
import RequestPage from './pages/request/page';
import { AuthProvider } from './lib/auth';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/donor" element={<DonorPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/requests/:id" element={<RequestPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);