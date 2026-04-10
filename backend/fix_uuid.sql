-- Fix for UUID delivery_partner_id compatibility
-- Run this in your Supabase SQL Editor

-- First, drop the existing foreign key constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_delivery_partner_id_fkey;

-- Change delivery_partners id to UUID to match your orders table
ALTER TABLE public.delivery_partners 
DROP CONSTRAINT IF EXISTS delivery_partners_pkey;

ALTER TABLE public.delivery_partners 
ALTER COLUMN id TYPE UUID USING gen_random_uuid(),
ALTER COLUMN id SET DEFAULT gen_random_uuid(),
ADD PRIMARY KEY (id);

-- Re-add the foreign key constraint
ALTER TABLE public.orders 
ADD CONSTRAINT orders_delivery_partner_id_fkey 
FOREIGN KEY (delivery_partner_id) 
REFERENCES public.delivery_partners(id);

-- Update the demo partner to have a UUID
UPDATE public.delivery_partners 
SET id = gen_random_uuid() 
WHERE pin = '1234';

-- Show the partner ID (you'll need this)
SELECT id, name, pin FROM public.delivery_partners WHERE pin = '1234';
