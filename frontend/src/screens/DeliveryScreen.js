import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Camera, ArrowLeft, CheckCircle, Phone, Copy, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DeliveryScreen = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const isScheduled = searchParams.get('source') === 'scheduled' || localStorage.getItem(`scheduled_order_${orderId}`) === 'true';
  const splitGroup = searchParams.get('splitGroup');
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [splitItems, setSplitItems] = useState(null); // filtered items for this split
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
      const endpoint = isScheduled 
        ? `${BACKEND_URL}/api/scheduled-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`;
      const response = await axios.get(endpoint);
      const fullOrder = response.data.order;
      setOrder(fullOrder);
      
      // Filter items for split group
      if (splitGroup && fullOrder.items) {
        try {
          const splitData = JSON.parse(localStorage.getItem(`split_${orderId}`) || '{}');
          const indices = splitGroup === '1' ? splitData.group1 : splitData.group2;
          if (indices && indices.length > 0) {
            setSplitItems(indices.map(i => fullOrder.items[i]).filter(Boolean));
          }
        } catch {}
      }
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

  const handleWhatsApp = () => {
    if (order?.customer_phone) {
      const phone = order.customer_phone.replace(/[^0-9]/g, '');
      const invoiceParams = new URLSearchParams();
      if (isScheduled) invoiceParams.set('source', 'scheduled');
      if (splitGroup) invoiceParams.set('splitGroup', splitGroup);
      const invoiceQs = invoiceParams.toString() ? `?${invoiceParams.toString()}` : '';
      const invoiceUrl = `${window.location.origin}/invoice/${orderId}${invoiceQs}`;
      const splitNote = splitGroup ? ` (Part ${splitGroup})` : '';
      const message = encodeURIComponent(`Hi ${order.customer_name}, Thanks for using Repid Cart 💚\n\nYour Order #${order.order_number}${splitNote} has been delivered!\n\nView your invoice here:\n${invoiceUrl}`);
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }
  };

  const handleCompleteDelivery = async () => {
    if (!photoFile) {
      toast.error('Please take a delivery proof photo');
      return;
    }

    setCompleting(true);

    try {
      // Upload photo first - pass table param for scheduled orders
      const formData = new FormData();
      formData.append('file', photoFile);

      const tableParam = isScheduled ? '?table=scheduled_orders' : '';
      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/orders/${orderId}/upload-photo${tableParam}`,
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

      const endpoint = isScheduled 
        ? `${BACKEND_URL}/api/scheduled-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`;

      if (splitGroup) {
        // Split delivery flow
        const splitData = JSON.parse(localStorage.getItem(`split_${orderId}`) || '{}');
        
        // Save photo URL for this split group
        const photoUrl = uploadResponse.data.photo_url;
        if (splitGroup === '1') {
          splitData.delivered1 = true;
          splitData.photo1 = photoUrl;
          localStorage.setItem(`split_${orderId}`, JSON.stringify(splitData));
          // Don't mark order as completed yet — Delivery 2 still pending
          toast.success('Delivery 1 completed! Delivery 2 is ready.');
        } else if (splitGroup === '2') {
          splitData.delivered2 = true;
          splitData.photo2 = photoUrl;
          splitData.completed = true;
          // Keep split data so completed view can show both deliveries
          localStorage.setItem(`split_${orderId}`, JSON.stringify(splitData));
          // Mark the whole order as completed
          await axios.patch(endpoint, { status: 'completed' });
          toast.success('All deliveries completed!');
        }
        
        localStorage.removeItem(`working_on_${orderId}`);
        localStorage.removeItem(`scheduled_order_${orderId}`);
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        // Normal (non-split) delivery
        const completeResponse = await axios.patch(endpoint, { status: 'completed' });

        if (completeResponse.data.success) {
          localStorage.removeItem(`working_on_${orderId}`);
          localStorage.removeItem(`scheduled_order_${orderId}`);
          toast.success('Delivery completed successfully!');
          setTimeout(() => navigate('/dashboard'), 1500);
        } else {
          toast.error('Failed to complete delivery');
        }
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
          <div className="nav-actions">
            <button 
              onClick={handleWhatsApp} 
              className="btn-icon whatsapp-btn"
              data-testid="whatsapp-customer-button"
            >
              <WhatsappLogo size={24} weight="bold" />
            </button>
            <button 
              onClick={handleCallCustomer} 
              className="btn-icon"
              data-testid="call-customer-button"
            >
              <Phone size={24} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <div className="screen-content">
        <div className="delivery-address-block" data-testid="delivery-address-block">
          <MapPin size={32} weight="duotone" className="address-icon" />
          <div className="address-content">
            <h2>Delivery Address</h2>
            <div className="address-structured">
              {order.customer_address?.split(',').map((part, i) => {
                const trimmed = part.trim();
                const labels = ['Building', 'Floor', 'House no'];
                const match = trimmed.match(/^(Floor|Door|House)\s*(.+)$/i);
                if (match) {
                  const label = match[1] === 'Door' ? 'House no' : match[1];
                  return <div key={i} className="address-line"><span className="address-label">{label}</span><span className="address-value">{match[2]}</span></div>;
                }
                const label = i === 0 ? 'Building' : (labels[i] || 'Address');
                return <div key={i} className="address-line"><span className="address-label">{label}</span><span className="address-value">{trimmed}</span></div>;
              })}
            </div>
            <p className="customer-name">{order.customer_name}</p>
            <button onClick={handleCopyAddress} className="copy-btn">
              <Copy size={16} />
              Copy Address
            </button>
          </div>
        </div>

        <div className="order-summary">
          {splitGroup && <div className="summary-row split-note-row"><span>Split Delivery Part {splitGroup}</span></div>}
          <div className="summary-row">
            <span>Order Total</span>
            <strong>${splitItems 
              ? (splitItems.reduce((s, it) => s + (it.price * (it.quantity || 1)), 0) + (order.delivery_fee || 0)).toFixed(2) 
              : order.total?.toFixed(2)}</strong>
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
