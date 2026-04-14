import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ShoppingScreen from './screens/ShoppingScreen';
import DeliveryScreen from './screens/DeliveryScreen';
import ProfileScreen from './screens/ProfileScreen';
import CompletedOrderScreen from './screens/CompletedOrderScreen';
import InvoiceScreen from './screens/InvoiceScreen';
import '@/App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/shopping/:orderId" element={<ShoppingScreen />} />
          <Route path="/delivery/:orderId" element={<DeliveryScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/completed/:orderId" element={<CompletedOrderScreen />} />
          <Route path="/invoice/:orderId" element={<InvoiceScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
