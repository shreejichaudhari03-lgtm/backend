import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import AvailableOrdersScreen from './screens/AvailableOrdersScreen';
import ShoppingScreen from './screens/ShoppingScreen';
import DeliveryScreen from './screens/DeliveryScreen';
import '@/App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginScreen />} />
          <Route path="/orders" element={<AvailableOrdersScreen />} />
          <Route path="/shopping/:orderId" element={<ShoppingScreen />} />
          <Route path="/delivery/:orderId" element={<DeliveryScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
