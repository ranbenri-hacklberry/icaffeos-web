import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SimpleAuthProvider } from './context/SimpleAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginStatus from './pages/LoginStatus';

export default function App() {
  return (
    <ThemeProvider>
      <SimpleAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginStatus />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SimpleAuthProvider>
    </ThemeProvider>
  );
}
