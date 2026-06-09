from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
from pathlib import Path
import logging
from supabase import create_client, Client
import uuid
from datetime import datetime, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_KEY']
supabase: Client = create_client(supabase_url, supabase_key)

# Create the main app
app = FastAPI(title="Repid Cart Delivery API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class PinLoginRequest(BaseModel):
    pin: str

class PinLoginResponse(BaseModel):
    success: bool
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None
    partner_phone: Optional[str] = None
    message: Optional[str] = None

class OrderUpdateRequest(BaseModel):
    status: Optional[str] = None
    delivery_partner_id: Optional[str] = None
    items: Optional[List[dict]] = None

class SplitOrderRequest(BaseModel):
    splits: List[List[int]]  # List of item index groups, e.g. [[0,1],[2,3]]

class CompleteDeliveryRequest(BaseModel):
    customer_pin: str

class PartnerStatusUpdate(BaseModel):
    is_active: bool

# Routes
@api_router.post("/auth/pin-login", response_model=PinLoginResponse)
async def pin_login(request: PinLoginRequest):
    """Authenticate delivery partner with 4-digit PIN"""
    try:
        # Query delivery_partners table
        response = supabase.table("delivery_partners").select("*").eq(
            "pin", request.pin
        ).execute()
        
        if not response.data or len(response.data) == 0:
            return PinLoginResponse(
                success=False,
                message="Invalid PIN"
            )
        
        partner = response.data[0]
        return PinLoginResponse(
            success=True,
            partner_id=partner["id"],
            partner_name=partner["name"],
            partner_phone=partner.get("phone"),
            message="Login successful"
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders")
async def get_orders(
    status: Optional[str] = None,
    partner_id: Optional[str] = None,
    limit: Optional[int] = 100
):
    """Get orders with optional filters"""
    try:
        # Select specific columns, excluding delivery_photo_url to avoid huge base64 payloads
        query = supabase.table("orders").select(
            "id,order_number,customer_name,customer_phone,customer_address,items,subtotal,delivery_fee,total,status,delivery_partner_id,delivery_pin,created_at"
        )
        
        if status:
            query = query.eq("status", status)
        if partner_id:
            query = query.eq("delivery_partner_id", partner_id)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        return {"success": True, "orders": response.data}
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders/{order_id}")
async def get_order_details(order_id: str):
    """Get detailed information about a specific order"""
    try:
        response = supabase.table("orders").select("*").eq(
            "id", order_id
        ).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {"success": True, "order": response.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/orders/{order_id}")
async def update_order(order_id: str, request: OrderUpdateRequest):
    """Update order status and/or delivery partner"""
    try:
        update_data = {}
        if request.status:
            update_data["status"] = request.status
        if request.delivery_partner_id is not None:
            update_data["delivery_partner_id"] = request.delivery_partner_id
        if request.items is not None:
            update_data["items"] = request.items
        
        response = supabase.table("orders").update(
            update_data
        ).eq("id", order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {"success": True, "order": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str):
    """Reject/skip an order"""
    try:
        return {"success": True, "message": "Order skipped"}
    except Exception as e:
        logger.error(f"Error rejecting order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders/{order_id}/split")
async def split_order(order_id: str, request: SplitOrderRequest, table: Optional[str] = "orders"):
    """Split an order into multiple smaller orders"""
    try:
        target_table = "scheduled_orders" if table == "scheduled_orders" else "orders"
        
        # Fetch original order
        original = supabase.table(target_table).select("*").eq("id", order_id).single().execute()
        if not original.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = original.data
        items = order.get("items", [])
        
        created_orders = []
        for i, item_indices in enumerate(request.splits):
            split_items = [items[idx] for idx in item_indices if idx < len(items)]
            if not split_items:
                continue
            
            subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in split_items)
            delivery_fee = order.get("delivery_fee", 0)
            
            new_order = {
                "order_number": int(f"{order.get('order_number', 0)}{i+1}"),
                "customer_name": order.get("customer_name"),
                "customer_phone": order.get("customer_phone"),
                "customer_address": order.get("customer_address"),
                "items": split_items,
                "subtotal": round(subtotal, 2),
                "delivery_fee": round(delivery_fee, 2),
                "total": round(subtotal + delivery_fee, 2),
                "status": "placed",
                "delivery_partner_id": None,
                "delivery_pin": order.get("delivery_pin"),
                "delivery_photo_url": None,
            }
            
            # Add scheduled fields if applicable
            if target_table == "scheduled_orders":
                new_order["scheduled_date"] = order.get("scheduled_date")
                new_order["delivery_window"] = order.get("delivery_window")
            
            result = supabase.table(target_table).insert(new_order).execute()
            if result.data:
                created_orders.append(result.data[0])
        
        # Mark original order as split
        supabase.table(target_table).update({"status": "split"}).eq("id", order_id).execute()
        
        return {"success": True, "split_orders": created_orders, "count": len(created_orders)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error splitting order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders/{order_id}/complete")
async def complete_delivery(order_id: str, request: CompleteDeliveryRequest):
    """Complete delivery with PIN verification"""
    try:
        # Get order
        order_response = supabase.table("orders").select(
            "*"
        ).eq("id", order_id).execute()
        
        if not order_response.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = order_response.data[0]
        
        # Verify customer PIN
        if order.get("delivery_pin") != request.customer_pin:
            return {"success": False, "message": "Invalid customer PIN"}
        
        # Update status to completed
        update_response = supabase.table("orders").update({
            "status": "completed"
        }).eq("id", order_id).execute()
        
        return {"success": True, "order": update_response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing delivery: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/orders/{order_id}/upload-photo")
async def upload_delivery_photo(order_id: str, table: Optional[str] = "orders", file: UploadFile = File(...)):
    """Upload delivery proof photo to Supabase Storage"""
    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, and WebP allowed."
            )
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size (5MB max)
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds 5MB limit"
            )
        
        try:
            # Generate unique filename
            file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
            unique_filename = f"order_{order_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
            file_path = f"deliveries/{unique_filename}"
            
            # Upload to Supabase Storage
            storage_response = supabase.storage.from_("delivery-photos").upload(
                path=file_path,
                file=file_content,
                file_options={"content-type": file.content_type}
            )
            
            # Get public URL
            public_url = supabase.storage.from_("delivery-photos").get_public_url(file_path)
            
        except Exception as storage_error:
            logger.warning(f"Storage upload failed: {storage_error}")
            # Fallback: save as base64 in database if storage bucket doesn't exist
            import base64
            base64_image = base64.b64encode(file_content).decode('utf-8')
            public_url = f"data:{file.content_type};base64,{base64_image}"
            logger.info("Using base64 fallback for photo storage")
        
        # Update the correct table with photo URL
        target_table = "scheduled_orders" if table == "scheduled_orders" else "orders"
        update_response = supabase.table(target_table).update({
            "delivery_photo_url": public_url
        }).eq("id", order_id).execute()
        
        return {
            "success": True,
            "photo_url": public_url,
            "order": update_response.data[0] if update_response.data else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/partner/{partner_id}/stats")
async def get_partner_stats(partner_id: str):
    """Get partner statistics and earnings"""
    try:
        # Get all completed orders for this partner
        completed_orders = supabase.table("orders").select(
            "*"
        ).eq("delivery_partner_id", partner_id).eq(
            "status", "completed"
        ).execute()
        
        total_deliveries = len(completed_orders.data) if completed_orders.data else 0
        
        # Calculate total earnings (sum of delivery_fee)
        total_earnings = 0
        today_earnings = 0
        today = date.today().isoformat()
        
        if completed_orders.data:
            for order in completed_orders.data:
                delivery_fee = float(order.get("delivery_fee", 0))
                total_earnings += delivery_fee
                
                # Check if order was completed today
                order_date = order.get("created_at", "")[:10]
                if order_date == today:
                    today_earnings += delivery_fee
        
        # Get active orders count
        active_orders = supabase.table("orders").select(
            "id", count="exact"
        ).eq("delivery_partner_id", partner_id).in_(
            "status", ["shopping", "delivering"]
        ).execute()
        
        active_count = active_orders.count if active_orders.count else 0
        
        return {
            "success": True,
            "stats": {
                "total_deliveries": total_deliveries,
                "total_earnings": round(total_earnings, 2),
                "today_earnings": round(today_earnings, 2),
                "active_orders": active_count
            }
        }
    except Exception as e:
        logger.error(f"Error fetching partner stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/partner/{partner_id}")
async def get_partner_profile(partner_id: str):
    """Get partner profile information"""
    try:
        response = supabase.table("delivery_partners").select(
            "*"
        ).eq("id", partner_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        return {"success": True, "partner": response.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching partner profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/partner/{partner_id}/status")
async def update_partner_status(partner_id: str, request: PartnerStatusUpdate):
    """Update partner online/offline status"""
    try:
        response = supabase.table("delivery_partners").update({
            "is_active": request.is_active
        }).eq("id", partner_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Partner not found")
        
        return {"success": True, "partner": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating partner status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scheduled-orders")
async def get_scheduled_orders(
    date: Optional[str] = None,
    status: Optional[str] = None,
    partner_id: Optional[str] = None
):
    """Get scheduled orders from today onwards"""
    try:
        query = supabase.table("scheduled_orders").select(
            "id,order_number,customer_name,customer_phone,customer_address,items,subtotal,delivery_fee,total,scheduled_date,delivery_window,status,delivery_partner_id,delivery_pin,created_at,delivered_at"
        )
        
        # Show today and future scheduled orders (gte = greater than or equal)
        if date:
            query = query.gte("scheduled_date", date)
        if status:
            query = query.eq("status", status)
        if partner_id:
            query = query.eq("delivery_partner_id", partner_id)
        
        response = query.order("created_at", desc=True).execute()
        return {"success": True, "orders": response.data}
    except Exception as e:
        logger.error(f"Error fetching scheduled orders: {e}")
        # Return empty if table doesn't exist yet
        return {"success": True, "orders": []}

@api_router.patch("/scheduled-orders/{order_id}")
async def update_scheduled_order(order_id: str, request: OrderUpdateRequest):
    """Update scheduled order status and/or delivery partner"""
    try:
        update_data = {}
        if request.status:
            update_data["status"] = request.status
        if request.delivery_partner_id is not None:
            update_data["delivery_partner_id"] = request.delivery_partner_id
        if request.items is not None:
            update_data["items"] = request.items
        
        response = supabase.table("scheduled_orders").update(
            update_data
        ).eq("id", order_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scheduled order not found")
        
        return {"success": True, "order": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scheduled order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scheduled-orders/{order_id}")
async def get_scheduled_order_details(order_id: str):
    """Get detailed information about a specific scheduled order"""
    try:
        response = supabase.table("scheduled_orders").select("*").eq(
            "id", order_id
        ).maybe_single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Scheduled order not found")
        
        return {"success": True, "order": response.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching scheduled order details: {e}")
        raise HTTPException(status_code=404, detail="Scheduled order not found")


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Repid Cart Delivery API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)