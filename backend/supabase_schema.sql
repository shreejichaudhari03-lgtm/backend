-- SQL Schema for Repid Cart Delivery Partner App
-- Run this in your Supabase SQL Editor

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

-- Create policy to allow all operations for now (adjust based on your security needs)
CREATE POLICY "Allow all operations on delivery_partners" 
ON public.delivery_partners 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure orders table has the required columns
-- (If you already have an orders table, just add missing columns)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_partner_id BIGINT REFERENCES public.delivery_partners(id),
ADD COLUMN IF NOT EXISTS delivery_pin TEXT,
ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;

-- Insert demo delivery partner
INSERT INTO public.delivery_partners (pin, name, phone, is_active)
VALUES ('1234', 'Test Driver', '+1234567890', true)
ON CONFLICT DO NOTHING;

-- Enable Realtime for orders table
-- (This is done in Supabase Dashboard > Database > Replication)
-- Make sure 'orders' table is enabled for replication

-- Create storage bucket for delivery photos
-- (This should be done in Supabase Dashboard > Storage)
-- Bucket name: delivery-photos
-- Make it public for easy access
