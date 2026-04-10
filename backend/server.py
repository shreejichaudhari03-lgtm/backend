from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
from pathlib import Path
import logging
from supabase import create_client, Client
import uuid
from datetime import datetime

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
    partner_id: Optional[int] = None
    partner_name: Optional[str] = None
    message: Optional[str] = None

class OrderUpdateRequest(BaseModel):
    status: Optional[str] = None
    delivery_partner_id: Optional[int] = None

class CompleteDeliveryRequest(BaseModel):
    customer_pin: str

# Routes
@api_router.post("/auth/pin-login", response_model=PinLoginResponse)
async def pin_login(request: PinLoginRequest):
    """Authenticate delivery partner with 4-digit PIN"""
    try:
        # Query delivery_partners table
        response = supabase.table("delivery_partners").select("*").eq(
            "pin", request.pin
        ).eq("is_active", True).execute()
        
        if not response.data or len(response.data) == 0:
            return PinLoginResponse(
                success=False,
                message="Invalid PIN or inactive account"
            )
        
        partner = response.data[0]
        return PinLoginResponse(
            success=True,
            partner_id=partner["id"],
            partner_name=partner["name"],
            message="Login successful"
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/orders")
async def get_orders(status: Optional[str] = None, partner_id: Optional[int] = None):
    """Get orders with optional filters"""
    try:
        query = supabase.table("orders").select("*")
        
        if status:
            query = query.eq("status", status)
        if partner_id:
            query = query.eq("delivery_partner_id", partner_id)
        
        response = query.order("created_at", desc=True).execute()
        return {"success": True, "orders": response.data}
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/orders/{order_id}")
async def update_order(order_id: int, request: OrderUpdateRequest):
    """Update order status and/or delivery partner"""
    try:
        update_data = {}
        if request.status:
            update_data["status"] = request.status
        if request.delivery_partner_id is not None:
            update_data["delivery_partner_id"] = request.delivery_partner_id
        
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

@api_router.post("/orders/{order_id}/complete")
async def complete_delivery(order_id: int, request: CompleteDeliveryRequest):
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
        if order["delivery_pin"] != request.customer_pin:
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
async def upload_delivery_photo(order_id: int, file: UploadFile = File(...)):
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
        
        # Update order with photo URL
        update_response = supabase.table("orders").update({
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