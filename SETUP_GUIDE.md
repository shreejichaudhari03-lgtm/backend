# 🚀 Setup Guide - Repid Cart Delivery Partner App

Your delivery partner app is ready! Follow these steps to complete the setup.

## ⚠️ IMPORTANT: Complete These Steps Before Testing

### Step 1: Create Database Tables in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (spcqirimvqxgeyocysnt)
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste this SQL script:

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

-- Create policy to allow all operations
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

6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see: "Success. No rows returned"

### Step 2: Create Storage Bucket for Photos

1. In Supabase Dashboard, go to **Storage** (left sidebar)
2. Click **New bucket**
3. Enter bucket name: `delivery-photos`
4. **Important**: Toggle ON "Public bucket"
5. Click **Create bucket**

### Step 3: Enable Realtime for Orders Table

1. In Supabase Dashboard, go to **Database** → **Replication** (left sidebar)
2. Scroll down to find **Tables** section
3. Find the `orders` table
4. Click the toggle to **enable** replication
5. The toggle should turn green

## ✅ You're All Set!

Now you can test the app:

### Demo Login
- **URL**: https://rapid-orders-7.preview.emergentagent.com
- **PIN**: 1234

### Testing Flow

1. **Login Screen**
   - Enter PIN: `1234`
   - Click Login

2. **Available Orders Screen**
   - You'll see orders where `status = 'pending'`
   - Real-time updates work automatically
   - Click "Accept Order" on any order

3. **Shopping Screen**
   - Check off items as you collect them
   - All items must be checked before proceeding
   - Click "Start Delivery"

4. **Delivery Screen**
   - View customer address
   - Enter customer PIN (from order's `delivery_pin` field)
   - Take a photo using camera
   - Click "Complete Delivery"

## 📝 Important Notes

### For Testing
- Make sure your orders have a `delivery_pin` field set
- Example: Create an order with `delivery_pin: "5678"`
- The driver will need to enter this PIN to complete delivery

### Sample Test Order
You can create a test order in Supabase SQL Editor:

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
    'John Doe',
    '+1234567890',
    '123 Main St, San Francisco, CA 94102',
    '[
        {"name": "Milk", "quantity": 2, "price": 4.99},
        {"name": "Bread", "quantity": 1, "price": 3.49},
        {"name": "Eggs", "quantity": 1, "price": 5.99}
    ]'::jsonb,
    14.47,
    3.99,
    18.46,
    'pending',
    '5678'
);
```

## 🔄 Real-time Updates

The app uses Supabase Realtime to automatically update the orders list when:
- New orders are created
- Order status changes
- Orders are assigned to drivers

No page refresh needed!

## 📱 Mobile Testing

For best experience, test on a mobile device or use Chrome DevTools:
1. Open DevTools (F12)
2. Click the device toolbar icon (or Ctrl+Shift+M)
3. Select a mobile device (e.g., iPhone 12 Pro)

The camera feature works best on actual mobile devices.

## 🆘 Troubleshooting

**Q: "Could not find the table 'delivery_partners'"**
A: Run Step 1 above - the SQL script in Supabase

**Q: "No orders showing"**
A: Make sure you have orders with `status = 'pending'` in your orders table

**Q: "Photo upload failed"**
A: Complete Step 2 - create the `delivery-photos` storage bucket

**Q: "Orders not updating in real-time"**
A: Complete Step 3 - enable replication for the orders table

## 📞 Support

If you need help, check:
- `/app/README.md` - Full documentation
- `/app/memory/test_credentials.md` - Test credentials
- `/app/backend/supabase_schema.sql` - Complete SQL schema
