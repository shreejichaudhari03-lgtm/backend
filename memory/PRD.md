# Repid Cart Delivery Partner App - PRD

## Problem Statement
Build a delivery partner app for Repid Cart that connects to an existing Supabase project. The app allows delivery drivers to manage orders through PIN-based authentication, view available and scheduled orders, process deliveries with a shopping checklist, upload proof photos, and track completed deliveries.

## Core Screens
1. **Login** - 4-digit PIN authentication
2. **Dashboard** - 4 tabs: Available, Schedules, Skipped, Completed
3. **Shopping Checklist** - Mark items as collected, cancel unavailable items
4. **Delivery** - View address, upload proof photo, complete delivery

## Tech Stack
- **Frontend**: React (CRA), Supabase JS for Realtime
- **Backend**: FastAPI, Supabase Python SDK for REST
- **Database**: User's external Supabase (PostgreSQL)
- **Storage**: Supabase Storage (delivery-photos bucket) with base64 fallback

## Key Tables
- `delivery_partners`: id (UUID), pin, name, phone, is_active
- `orders`: id, order_number, customer_name, customer_address, items (JSONB), total, status, delivery_partner_id (UUID), delivery_photo_url
- `scheduled_orders`: id, order_number, scheduled_date, delivery_window, status, items, customer_name, customer_address, total, delivery_photo_url

## What's Been Implemented
- [x] PIN Login flow
- [x] Dashboard with 4 tabs (Available, Schedules, Skipped, Completed)
- [x] Realtime WebSocket subscriptions for both `orders` and `scheduled_orders` tables
- [x] **Auto-refresh polling every 15 seconds** — orders appear without manual refresh
- [x] Shopping checklist with item cancellation and undo
- [x] Delivery screen with proof photo upload
- [x] Completed orders (24-hour persistence)
- [x] Product image thumbnails and full-size modal
- [x] Skeleton loaders and API caching
- [x] **Schedules tab**: Fetches from `scheduled_orders` table (date >= today, non-completed)
- [x] **Completed tab**: Merges completed orders from BOTH `orders` and `scheduled_orders` tables
- [x] **Photo upload for scheduled orders**: Uses `?table=scheduled_orders` param to save to correct table
- [x] **Performance fix**: Excluded `delivery_photo_url` from list API responses (reduced 27MB -> 10KB)
- [x] Accept/Skip buttons on scheduled orders
- [x] View Details fallback for completed scheduled orders

## Known Limitations
- Supabase Storage `delivery-photos` bucket not created - falls back to base64 encoding
- Base64 photos in DB can grow large over time

## Backlog
- P1: Create Supabase Storage bucket `delivery-photos` for proper photo storage
- P2: Add order status transitions (pending -> shopping -> delivering -> completed)
- P3: Push notifications for new orders
