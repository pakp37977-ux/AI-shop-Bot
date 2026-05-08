import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';

import Home from './pages/Home';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import DashboardLayout from './pages/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import DashboardMenu from './pages/DashboardMenu';
import DashboardOrders from './pages/DashboardOrders';
import DashboardSettings from './pages/DashboardSettings';
import ShopPublic from './pages/ShopPublic';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        
        {/* Public Shop Route */}
        <Route path="/shop/:slug" element={<ShopPublic />} />

        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="menu" element={<DashboardMenu />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="settings" element={<DashboardSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
