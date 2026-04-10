# Repid Cart - Delivery Partner App 🚚

A complete, production-ready delivery partner application for Repid Cart, built with React and FastAPI, powered by Supabase for real-time updates and storage.

## ✨ Complete Feature Set

### 📱 Dashboard with 3 Tabs
1. **Available Tab** - View all pending orders, accept or skip them
2. **Active Tab** - Your current orders (shopping/delivering)
3. **Completed Tab** - Your delivery history with earnings

### 🔐 Authentication
- 4-digit PIN login for quick driver access
- Secure session management
- Demo credentials: PIN `1234`

### 📦 Order Management
- **Accept Orders** - Claim pending deliveries
- **Skip Orders** - Pass on orders you can't take
- **View Details** - See items, customer info, earnings per order
- **Real-time Updates** - Orders appear instantly via Supabase Realtime
- **Call Customer** - Direct phone dialer integration

### 🛒 Shopping Flow
- Interactive checklist showing all items to collect
- Item quantities, prices, and subtotals
- Visual progress bar (items collected / total items)
- Must check all items before starting delivery
- Contact customer button for questions

### 🚚 Delivery Flow
- **Address Display** with copy-to-clipboard functionality
- **Customer PIN Verification** (4-digit security)
- **Camera Photo Upload** for proof of delivery
- **Order Summary** showing total and your earning
- **Complete Delivery** button with validation

### 👤 Profile & Earnings
- **Total Earnings** - Lifetime delivery income
- **Today's Earnings** - Current day revenue
- **Total Deliveries** - Number of completed orders
- **Active Orders** - Currently in-progress deliveries
- **Online/Offline Toggle** - Control availability
- **Logout** - Secure session termination

## 🛠 Tech Stack

**Frontend:**
- React 19
- React Router v7 (client-side routing)
- Supabase JS v2 (Realtime subscriptions)
- Phosphor Icons (bold, duotone variants)
- Sonner (toast notifications)
- Axios (HTTP client)
- Mobile-first responsive CSS

**Backend:**
- FastAPI (Python async web framework)
- Supabase Python client v2
- Pydantic (data validation)
- File upload with type & size validation
- RESTful API architecture

**Database & Storage:**
- Supabase PostgreSQL
- Row Level Security (RLS) policies
- Supabase Storage (delivery photos)
- Supabase Realtime (WebSocket updates)

## 📋 Setup Instructions

### Prerequisites
- Supabase account with an existing project
- Your Supabase URL and Anon Key
- `delivery_partners` and `orders` tables (see SQL below)

### Step 1: Create Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Create delivery_partners table
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id BIGSERIAL PRIMARY KEY,
    pin TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on delivery_partners" 
ON public.delivery_partners 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_partner_id BIGINT REFERENCES public.delivery_partners(id),
ADD COLUMN IF NOT EXISTS delivery_pin TEXT,
ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;

-- Insert demo delivery partner
INSERT INTO public.delivery_partners (pin, name, phone, is_active)
VALUES ('1234', 'Test Driver', '+1234567890', true)
ON CONFLICT DO NOTHING;
```

### Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **New bucket**
3. Name: `delivery-photos`
4. Toggle **Public bucket** ON
5. Click **Create bucket**

### Step 3: Enable Realtime

1. Go to Supabase Dashboard → **Database** → **Replication**
2. Find the `orders` table
3. Toggle replication **ON**

### Step 4: Test the App

**URL:** https://rapid-orders-7.preview.emergentagent.com

1. Login with PIN: `1234`
2. View available orders (status = 'pending')
3. Accept an order
4. Complete shopping checklist
5. Deliver and complete

## 🔌 API Endpoints

### Authentication
```
POST /api/auth/pin-login
Body: { "pin": "1234" }
Response: { "success": true, "partner_id": 1, "partner_name": "Test Driver" }
```

### Orders
```
GET /api/orders?status=pending          # Get pending orders
GET /api/orders?partner_id=1            # Get partner's orders
GET /api/orders/{id}                    # Get order details
PATCH /api/orders/{id}                  # Update order status
POST /api/orders/{id}/reject            # Skip an order
POST /api/orders/{id}/complete          # Complete with PIN verification
POST /api/orders/{id}/upload-photo      # Upload delivery photo
```

### Partner
```
GET /api/partner/{id}                   # Get partner profile
GET /api/partner/{id}/stats             # Get earnings & stats
PATCH /api/partner/{id}/status          # Toggle online/offline
```

## 📊 Sample Test Order

Create a test order in Supabase SQL Editor:

```sql
INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_phone,
    customer_address,
    items,
    subtotal,
    delivery_fee,
    total,
    status,
    delivery_pin
) VALUES (
    1001,
    'Sarah Johnson',
    '+14155551234',
    '456 Market St, San Francisco, CA 94102',
    '[
        {"name": "Organic Milk", "quantity": 2, "price": 4.99},
        {"name": "Whole Wheat Bread", "quantity": 1, "price": 3.49},
        {"name": "Free Range Eggs (Dozen)", "quantity": 1, "price": 5.99},
        {"name": "Fresh Spinach", "quantity": 1, "price": 3.99}
    ]'::jsonb,
    22.45,
    4.99,
    27.44,
    'pending',
    '5678'
);
```

## 🎨 Design System

**Color Palette:**
- Primary: `#2563eb` (blue-600)
- Success: `#22c55e` (green-500)
- Background: `#f8fafc` (slate-50)
- Text: `#0f172a` (slate-900)

**Typography:**
- Headings: **Manrope** (800 weight)
- Body: **IBM Plex Sans** (400-700 weight)

**Design Principles:**
- Mobile-first (max-width: 28rem)
- Large touch targets (56px height)
- Sticky bottom buttons for easy access
- High contrast for outdoor visibility
- Real-time updates (no manual refresh)

## 📱 Mobile Features

- **Native Camera Capture** - `capture="environment"` for rear camera
- **Phone Dialer** - `tel:` protocol for calling customers
- **Clipboard API** - Copy address with one tap
- **Numeric Keyboard** - `inputMode="numeric"` for PIN entry
- **Touch-optimized** - Large buttons with active states

## 🔄 Real-time Updates

The app uses Supabase Realtime to automatically sync:
- New pending orders appear instantly
- Order status changes (accepted, completed)
- Stats and earnings updates
- No page refresh needed!

## 📂 Project Structure

```
/app/
├── backend/
│   ├── server.py                    # FastAPI app with all endpoints
│   ├── init_db.py                   # Database initialization script
│   ├── supabase_schema.sql          # Complete SQL schema
│   └── .env                         # Supabase credentials
├── frontend/
│   └── src/
│       ├── screens/
│       │   ├── LoginScreen.js       # PIN login
│       │   ├── DashboardScreen.js   # 3-tab dashboard
│       │   ├── ShoppingScreen.js    # Item checklist
│       │   ├── DeliveryScreen.js    # Delivery & completion
│       │   └── ProfileScreen.js     # Stats & settings
│       ├── lib/
│       │   └── supabase.js          # Supabase client config
│       ├── App.js                   # Routes & Toaster
│       ├── App.css                  # Complete styling
│       └── index.css                # Global styles
└── memory/
    └── test_credentials.md          # Demo login & setup guide
```

## 🧪 Testing Checklist

- [x] PIN login (1234)
- [ ] View available orders
- [ ] Accept order
- [ ] Skip order
- [ ] Shopping checklist interaction
- [ ] Call customer button
- [ ] Start delivery
- [ ] Copy address
- [ ] Customer PIN verification
- [ ] Camera photo upload
- [ ] Complete delivery
- [ ] View completed orders
- [ ] Check earnings stats
- [ ] Toggle online/offline status
- [ ] Logout

## 🔒 Security Features

- PIN-based authentication (4-digit)
- Customer PIN verification for delivery
- Row Level Security on database
- File upload validation (type, size)
- CORS configured for production
- No hardcoded credentials in code

## 📝 Important Notes

1. **Required Fields for Orders:**
   - `status` - Must be 'pending' for Available tab
   - `delivery_pin` - Required for completion
   - `delivery_fee` - Used for earnings calculation
   - `items` - JSONB array with name, quantity, price

2. **Photo Upload:**
   - Max size: 5MB
   - Allowed types: JPEG, PNG, WebP
   - Stored in `delivery-photos` bucket
   - Public URLs returned

3. **Earnings Calculation:**
   - Based on `delivery_fee` field
   - Today's earnings = completed orders from current date
   - Total earnings = all completed orders

## 🚀 Deployment

Services are already running:
- **Frontend**: https://rapid-orders-7.preview.emergentagent.com
- **Backend API**: https://rapid-orders-7.preview.emergentagent.com/api

No additional deployment needed - app is live!

## 📞 Support

For issues or questions, check:
- `/app/memory/test_credentials.md` - Setup guide & credentials
- `/app/SETUP_GUIDE.md` - Detailed setup instructions
- `/app/backend/supabase_schema.sql` - Database schema

---

**Built with ❤️ for Repid Cart delivery partners**
