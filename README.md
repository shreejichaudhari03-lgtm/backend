# Repid Cart - Delivery Partner App

A mobile-first delivery partner application for Repid Cart, built with React and FastAPI, powered by Supabase for real-time updates and storage.

## Features

### Screen 1: PIN Login
- 4-digit PIN authentication
- Simple and secure driver login

### Screen 2: Available Orders
- Real-time order updates using Supabase Realtime
- Shows pending orders automatically
- Displays order number, delivery address, item count, and total
- "Accept Order" to claim a delivery

### Screen 3: Shopping Checklist
- Interactive checklist for items to collect
- Visual feedback as items are checked off
- "Start Delivery" button (enabled when all items checked)

### Screen 4: Delivery
- Customer address display
- PIN verification (customer provides PIN to driver)
- Camera capture for delivery proof photo
- Photo upload to Supabase Storage
- "Complete" button to finish delivery

## Tech Stack

**Frontend:**
- React 19
- React Router for navigation
- Supabase JS client for Realtime
- Phosphor Icons
- Axios for API calls

**Backend:**
- FastAPI
- Supabase Python client
- File upload handling

**Database & Storage:**
- Supabase (PostgreSQL)
- Supabase Storage for delivery photos
- Supabase Realtime for live order updates

## Setup Instructions

### 1. Database Setup

Run the SQL script in your Supabase SQL Editor:
```bash
cat /app/backend/supabase_schema.sql
```

This creates:
- `delivery_partners` table
- Adds columns to `orders` table
- Demo partner with PIN `1234`

### 2. Storage Bucket

In Supabase Dashboard:
1. Go to Storage
2. Create new bucket: `delivery-photos`
3. Make it **public**

### 3. Enable Realtime

In Supabase Dashboard:
1. Go to Database > Replication  
2. Enable replication for `orders` table

### 4. Run the App

Services are already running:
- Backend: https://rapid-orders-7.preview.emergentagent.com/api
- Frontend: https://rapid-orders-7.preview.emergentagent.com

## API Endpoints

### Authentication
- `POST /api/auth/pin-login` - Login with 4-digit PIN

### Orders
- `GET /api/orders?status=pending` - Get pending orders
- `GET /api/orders?partner_id={id}` - Get partner's orders
- `PATCH /api/orders/{id}` - Update order status

### Delivery
- `POST /api/orders/{id}/upload-photo` - Upload delivery proof
- `POST /api/orders/{id}/complete` - Complete delivery with PIN verification

## Project Structure

```
/app/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── init_db.py             # Database initialization
│   ├── supabase_schema.sql    # SQL schema for Supabase
│   └── .env                   # Supabase credentials
├── frontend/
│   └── src/
│       ├── screens/
│       │   ├── LoginScreen.js
│       │   ├── AvailableOrdersScreen.js
│       │   ├── ShoppingScreen.js
│       │   └── DeliveryScreen.js
│       ├── lib/
│       │   └── supabase.js    # Supabase client
│       ├── App.js             # Main app with routing
│       └── App.css            # Mobile-first styles
└── memory/
    └── test_credentials.md    # Demo credentials
```

## Design

- **Mobile-first** design optimized for drivers on the go
- **Large touch targets** (56px height) for easy interaction while walking
- **Sticky bottom buttons** for quick access to primary actions
- **High contrast** blue (#2563eb) on light background for outdoor visibility
- **Manrope** font for headings, **IBM Plex Sans** for body text
- **Real-time updates** - no manual refresh needed

## Demo Credentials

**Delivery Partner PIN:** `1234`
**Partner Name:** Test Driver

## Testing

1. Login with PIN `1234`
2. Create a test order in your customer app (or directly in Supabase)
3. Watch it appear in real-time in the Available Orders screen
4. Accept the order and go through the shopping → delivery flow

## Notes

- Orders need `delivery_pin` field for PIN verification
- Camera capture uses native mobile camera when accessed on mobile devices
- All photos stored in Supabase Storage `delivery-photos` bucket
- Real-time subscription automatically updates order list when changes occur
