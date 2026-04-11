import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, MapPin, User, Phone, Package, Camera } from '@phosphor-icons/react';
import ImageModal from '../components/ImageModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CompletedOrderScreen = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      // Try regular orders first
      const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`);
      setOrder(response.data.order);
    } catch (error) {
      // Fallback: try scheduled_orders table
      try {
        const scheduledRes = await axios.get(`${BACKEND_URL}/api/scheduled-orders/${orderId}`);
        setOrder(scheduledRes.data.order);
      } catch (err) {
        console.error('Error fetching order:', err);
      }
    } finally {
      setLoading(false);
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

  const completedDate = new Date(order.created_at);
  const formattedDate = completedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="screen-container">
      <div className="top-nav">
        <div className="nav-content">
          <button onClick={() => navigate('/dashboard')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Order Details</h3>
          <div style={{ width: '40px' }}></div>
        </div>
      </div>

      <div className="screen-content">
        {/* Completed Badge */}
        <div className="completed-badge-large">
          <CheckCircle size={48} weight="fill" />
          <h2>Delivery Completed</h2>
          <p>{formattedDate}</p>
        </div>

        {/* Order Info */}
        <div className="order-detail-card">
          <h3>Order #{order.order_number}</h3>
          <div className="detail-row">
            <User size={20} weight="bold" />
            <div>
              <span className="label">Customer</span>
              <span className="value">{order.customer_name}</span>
            </div>
          </div>
          <div className="detail-row">
            <Phone size={20} weight="bold" />
            <div>
              <span className="label">Phone</span>
              <span className="value">{order.customer_phone}</span>
            </div>
          </div>
          <div className="detail-row">
            <MapPin size={20} weight="bold" />
            <div>
              <span className="label">Address</span>
              <span className="value">{order.customer_address}</span>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="order-detail-card">
          <h3>Items Delivered ({order.items?.length || 0})</h3>
          <div className="completed-items-list">
            {order.items && order.items.map((item, index) => (
              <div key={index} className="completed-item">
                {(item.image || item.image_url) && (
                  <img 
                    src={item.image || item.image_url}
                    alt={item.name}
                    className="completed-item-image"
                    onClick={() => setSelectedImage(item.image || item.image_url)}
                  />
                )}
                <div className="completed-item-details">
                  <span className="item-name">{item.name}</span>
                  <span className="item-meta">Qty: {item.quantity} × ${item.price?.toFixed(2)}</span>
                </div>
                <span className="item-total">${(item.quantity * item.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Order Total */}
        <div className="order-detail-card">
          <div className="total-row">
            <span>Subtotal</span>
            <span>${order.subtotal?.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Delivery Fee</span>
            <span>${order.delivery_fee?.toFixed(2)}</span>
          </div>
          <div className="total-row total">
            <span>Total</span>
            <strong>${order.total?.toFixed(2)}</strong>
          </div>
          <div className="total-row earning-row">
            <span>Your Earning</span>
            <strong className="earning">${order.delivery_fee?.toFixed(2)}</strong>
          </div>
        </div>

        {/* Delivery Proof Photo */}
        {order.delivery_photo_url && (
          <div className="order-detail-card">
            <h3>
              <Camera size={20} weight="bold" style={{ marginRight: '0.5rem' }} />
              Delivery Proof Photo
            </h3>
            <div className="proof-photo-container">
              <img 
                src={order.delivery_photo_url}
                alt="Delivery proof"
                className="proof-photo"
                onClick={() => setSelectedImage(order.delivery_photo_url)}
              />
              <p className="photo-caption">Tap to view full size</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
};

export default CompletedOrderScreen;
