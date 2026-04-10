import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Camera, ArrowLeft, CheckCircle, Phone, Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';

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
      const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`);
      setOrder(response.data.order);
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

  const handleCopyAddress = () => {
    if (order?.customer_address) {
      navigator.clipboard.writeText(order.customer_address);
      toast.success('Address copied to clipboard!');
    }
  };

  const handleCallCustomer = () => {
    if (order?.customer_phone) {
      window.location.href = `tel:${order.customer_phone}`;
    }
  };

  const handleCompleteDelivery = async () => {
    if (!photoFile) {
      toast.error('Please take a delivery proof photo');
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

      // Complete delivery (no PIN needed)
      const completeResponse = await axios.patch(
        `${BACKEND_URL}/api/orders/${orderId}`,
        { status: 'completed' }
      );

      if (completeResponse.data.success) {
        toast.success('Delivery completed successfully!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        toast.error('Failed to complete delivery');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      toast.error('Failed to complete delivery. Please try again.');
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
          <button onClick={() => navigate('/dashboard')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Delivery in Progress</h3>
          <button 
            onClick={handleCallCustomer} 
            className="btn-icon"
            data-testid="call-customer-button"
          >
            <Phone size={24} weight="bold" />
          </button>
        </div>
      </div>

      <div className="screen-content">
        <div className="delivery-address-block" data-testid="delivery-address-block">
          <MapPin size={32} weight="duotone" className="address-icon" />
          <div className="address-content">
            <h2>Delivery Address</h2>
            <p className="address-text">{order.customer_address}</p>
            <p className="customer-name">{order.customer_name}</p>
            <button onClick={handleCopyAddress} className="copy-btn">
              <Copy size={16} />
              Copy Address
            </button>
          </div>
        </div>

        <div className="order-summary">
          <div className="summary-row">
            <span>Order Total</span>
            <strong>${order.total?.toFixed(2)}</strong>
          </div>
          <div className="summary-row">
            <span>Your Earning</span>
            <strong className="earning">${order.delivery_fee?.toFixed(2)}</strong>
          </div>
        </div>

        <div className="photo-section">
          <h3>Delivery Proof Photo</h3>
          <p className="instruction-text">Take a photo of the delivered items at the door</p>
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
                <Camera size={20} />
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
          disabled={completing || !photoFile}
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
