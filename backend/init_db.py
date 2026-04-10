"""Initialize Supabase database tables and demo data"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

supabase_url = os.environ['SUPABASE_URL']
supabase_key = os.environ['SUPABASE_KEY']
supabase: Client = create_client(supabase_url, supabase_key)

def init_database():
    """Create delivery_partners table and demo partner"""
    
    # Note: Table creation should be done via Supabase SQL editor
    # This script only inserts demo data
    
    # Check if demo partner already exists
    existing = supabase.table("delivery_partners").select(
        "*"
    ).eq("pin", "1234").execute()
    
    if not existing.data:
        # Create demo partner
        demo_partner = {
            "pin": "1234",
            "name": "Test Driver",
            "phone": "+1234567890",
            "is_active": True
        }
        
        result = supabase.table("delivery_partners").insert(demo_partner).execute()
        print(f"Created demo partner: {result.data}")
    else:
        print("Demo partner already exists")
    
    # Check if delivery-photos bucket exists and is public
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        
        if "delivery-photos" not in bucket_names:
            print("Creating delivery-photos bucket...")
            supabase.storage.create_bucket(
                "delivery-photos",
                options={"public": True}
            )
            print("Bucket created successfully")
        else:
            print("delivery-photos bucket already exists")
    except Exception as e:
        print(f"Note: {e}")
        print("Please create 'delivery-photos' bucket manually in Supabase dashboard")

if __name__ == "__main__":
    print("Initializing database...")
    init_database()
    print("Database initialization complete!")
