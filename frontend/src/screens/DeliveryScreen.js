import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { MapPin, Camera, ArrowLeft, CheckCircle } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DeliveryScreen = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [customerPin, setCustomerPin] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      alert('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteDelivery = async () => {
    if (customerPin.length !== 4) {
      alert('Please enter the 4-digit customer PIN');
      return;
    }

    if (!photoFile) {
      alert('Please take a delivery proof photo');
      return;
    }

    setCompleting(true);

    try {
      // Upload photo first
      const formData = new FormData();
      formData.append('file', photoFile);

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/orders/${orderId}/upload-photo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error('Photo upload failed');
      }

      // Verify PIN and complete delivery
      const completeResponse = await axios.post(
        `${BACKEND_URL}/api/orders/${orderId}/complete`,
        { customer_pin: customerPin }
      );

      if (completeResponse.data.success) {
        alert('Delivery completed successfully!');
        navigate('/orders');
      } else {
        alert(completeResponse.data.message || 'Invalid customer PIN');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Failed to complete delivery. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-container">
        <div className="screen-content">
          <div className="loading-state">Loading...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="screen-container">
        <div className="screen-content">
          <div className="error-message">Order not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="top-nav">
        <div className="nav-content">
          <button onClick={() => navigate('/orders')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Delivery in Progress</h3>
          <div style={{ width: '40px' }}></div>
        </div>
      </div>

      <div className="screen-content">
        <div className="delivery-address-block" data-testid="delivery-address-block">
          <MapPin size={32} weight="duotone" className="address-icon" />
          <div>
            <h2>Delivery Address</h2>
            <p className="address-text">{order.customer_address}</p>
            <p className="customer-name">{order.customer_name}</p>
          </div>
        </div>

        <div className="verification-section">
          <h3>Customer PIN Verification</h3>
          <p className="instruction-text">Ask the customer for their 4-digit PIN</p>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="4"
            value={customerPin}
            onChange={(e) => setCustomerPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="pin-input"
            data-testid="customer-pin-input"
          />
        </div>

        <div className="photo-section">
          <h3>Delivery Proof Photo</h3>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
            data-testid="camera-upload-input"
          />
          
          {photoPreview ? (
            <div className="photo-preview">
              <img src={photoPreview} alt="Delivery proof" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary retake-btn"
              >
                Retake Photo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="camera-upload-area"
            >
              <Camera size={32} weight="duotone" />
              <span>Take Photo</span>
            </button>
          )}
        </div>
      </div>

      <div className="sticky-bottom">
        <button
          onClick={handleCompleteDelivery}
          className="btn-primary"
          disabled={completing || customerPin.length !== 4 || !photoFile}
          data-testid="complete-delivery-button"
        >
          {completing ? (
            'Completing...'
          ) : (
            <>
              <CheckCircle size={20} weight="bold" />
              Complete Delivery
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DeliveryScreen;
