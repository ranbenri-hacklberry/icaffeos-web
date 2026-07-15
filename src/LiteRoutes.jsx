
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LiteModeSelection from './pages/lite/LiteModeSelection';
import LiteKDS from './pages/lite/LiteKDS';
import LiteOrdering from './pages/lite/LiteOrdering';
import { useStore } from './core/store';

const ProtectedLiteRoute = ({ children }) => {
    const { currentUser } = useStore();
    if (!currentUser) return <Navigate to="/mode-selection" replace />;
    return children;
};

const LiteRoutes = () => {
    return (
        <BrowserRouter>
            {/* Route Structure restricted to minimal set */}
            <Routes>
                <Route path="/mode-selection" element={<LiteModeSelection />} />

                {/* Protected Routes */}
                <Route path="/kds" element={
                    <ProtectedLiteRoute>
                        <LiteKDS />
                    </ProtectedLiteRoute>
                } />

                <Route path="/" element={
                    <ProtectedLiteRoute>
                        <LiteOrdering />
                    </ProtectedLiteRoute>
                } />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/mode-selection" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default LiteRoutes;
