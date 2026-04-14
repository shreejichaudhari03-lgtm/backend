import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const InvoiceScreen = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      // Try regular orders first, then scheduled
      let response;
      if (source === 'scheduled') {
        response = await axios.get(`${BACKEND_URL}/api/scheduled-orders/${orderId}`);
      } else {
        try {
          response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`);
        } catch {
          response = await axios.get(`${BACKEND_URL}/api/scheduled-orders/${orderId}`);
        }
      }
      setOrder(response.data.order);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="invoice-page">
        <div className="invoice-loading">Loading invoice...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="invoice-page">
        <div className="invoice-error">Invoice not found</div>
      </div>
    );
  }

  const cancelledItems = order.cancelled_items || [];
  const availableItems = (order.items || []).filter((_, i) => !cancelledItems.includes(i));
  const unavailableItems = (order.items || []).filter((_, i) => cancelledItems.includes(i));
  
  const availableTotal = availableItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const deliveryFee = order.delivery_fee || 0;
  const grandTotal = availableTotal + deliveryFee;

  return (
    <div className="invoice-page" data-testid="invoice-page">
      <div className="invoice-container">
        <div className="invoice-header">
          <h1 className="invoice-brand">Repid Cart</h1>
          <div className="invoice-meta">
            <span className="invoice-number">Invoice #RC-{order.order_number}</span>
            <span className="invoice-date">
              {new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
          </div>
        </div>

        <div className="invoice-customer">
          <h3>Bill To</h3>
          <p className="customer-name-inv">{order.customer_name}</p>
          <p className="customer-address-inv">{order.customer_address}</p>
          {order.customer_phone && <p className="customer-phone-inv">{order.customer_phone}</p>}
        </div>

        <table className="invoice-table" data-testid="invoice-items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, index) => {
              const isCancelled = cancelledItems.includes(index);
              return (
                <tr key={index} className={isCancelled ? 'item-cancelled' : 'item-available'}>
                  <td className="item-name-cell">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="invoice-item-img" />
                    )}
                    <span>{item.name}</span>
                  </td>
                  <td>{item.quantity || 1}</td>
                  <td>${item.price?.toFixed(2)}</td>
                  <td className={isCancelled ? 'price-struck' : ''}>
                    {isCancelled ? '-' : `$${(item.price * (item.quantity || 1)).toFixed(2)}`}
                  </td>
                  <td>
                    <span className={`item-status ${isCancelled ? 'status-unavailable' : 'status-available'}`}>
                      {isCancelled ? 'Not Available' : 'Delivered'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div className="total-row-inv">
            <span>Subtotal ({availableItems.length} items)</span>
            <span>${availableTotal.toFixed(2)}</span>
          </div>
          {unavailableItems.length > 0 && (
            <div className="total-row-inv unavailable-note">
              <span>{unavailableItems.length} item(s) not available</span>
              <span>-${unavailableItems.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row-inv">
            <span>Delivery Fee</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
          <div className="total-row-inv grand-total">
            <span>Total</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="invoice-footer">
          <p>Thank you for shopping with Repid Cart!</p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceScreen;
