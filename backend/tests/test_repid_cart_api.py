"""
Repid Cart Delivery Partner API Tests
Tests for PIN login, orders, scheduled orders, and photo upload endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_PIN = "1234"
TEST_SCHEDULED_ORDER_ID = "88061a94-352c-4dd8-b806-d20a0c747125"
TEST_PARTNER_ID = None  # Will be set after login


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Repid Cart Delivery API"
        print("✓ Health check passed")


class TestPinLogin:
    """PIN authentication tests"""
    
    def test_login_with_valid_pin(self):
        """Test login with valid PIN 1234"""
        response = requests.post(
            f"{BASE_URL}/api/auth/pin-login",
            json={"pin": TEST_PIN}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "partner_id" in data
        assert data["partner_name"] == "Test Driver"
        assert data["message"] == "Login successful"
        print(f"✓ Login successful - Partner ID: {data['partner_id']}")
        return data["partner_id"]
    
    def test_login_with_invalid_pin(self):
        """Test login with invalid PIN"""
        response = requests.post(
            f"{BASE_URL}/api/auth/pin-login",
            json={"pin": "9999"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert data["message"] == "Invalid PIN"
        print("✓ Invalid PIN rejected correctly")


class TestOrdersEndpoint:
    """Orders endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get partner ID for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/pin-login",
            json={"pin": TEST_PIN}
        )
        self.partner_id = response.json()["partner_id"]
    
    def test_get_pending_orders(self):
        """Test GET /api/orders?status=pending - should NOT include delivery_photo_url"""
        response = requests.get(f"{BASE_URL}/api/orders?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "orders" in data
        # Verify response is lightweight (no delivery_photo_url in list)
        for order in data["orders"]:
            assert "delivery_photo_url" not in order, "delivery_photo_url should not be in list response"
        print(f"✓ Pending orders fetched: {len(data['orders'])} orders (lightweight response)")
    
    def test_get_completed_orders(self):
        """Test GET /api/orders?status=completed with partner_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/orders?status=completed&partner_id={self.partner_id}&limit=50"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "orders" in data
        # Verify all returned orders are completed
        for order in data["orders"]:
            assert order["status"] == "completed"
        print(f"✓ Completed orders fetched: {len(data['orders'])} orders")
    
    def test_get_skipped_orders(self):
        """Test GET /api/orders?status=skipped"""
        response = requests.get(
            f"{BASE_URL}/api/orders?status=skipped&partner_id={self.partner_id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "orders" in data
        print(f"✓ Skipped orders fetched: {len(data['orders'])} orders")


class TestScheduledOrdersEndpoint:
    """Scheduled orders endpoint tests"""
    
    def test_get_scheduled_orders_with_date_filter(self):
        """Test GET /api/scheduled-orders?date=2026-04-11 - gte filter"""
        response = requests.get(f"{BASE_URL}/api/scheduled-orders?date=2026-04-11")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "orders" in data
        # Should include the test scheduled order
        order_ids = [o["id"] for o in data["orders"]]
        assert TEST_SCHEDULED_ORDER_ID in order_ids, "Test scheduled order should be in results"
        print(f"✓ Scheduled orders fetched with date filter: {len(data['orders'])} orders")
    
    def test_get_single_scheduled_order(self):
        """Test GET /api/scheduled-orders/{id} - returns full order details"""
        response = requests.get(f"{BASE_URL}/api/scheduled-orders/{TEST_SCHEDULED_ORDER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "order" in data
        order = data["order"]
        assert order["id"] == TEST_SCHEDULED_ORDER_ID
        assert order["order_number"] == 1
        assert order["customer_name"] == "Shreeji "
        assert order["status"] == "completed"
        # Single order should include delivery_photo_url
        assert "delivery_photo_url" in order
        print(f"✓ Single scheduled order fetched: Order #{order['order_number']}")
    
    def test_get_nonexistent_scheduled_order(self):
        """Test GET /api/scheduled-orders/{id} with invalid ID"""
        response = requests.get(f"{BASE_URL}/api/scheduled-orders/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        print("✓ Nonexistent scheduled order returns 404")


class TestScheduledOrderUpdate:
    """Scheduled order update tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get partner ID for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/pin-login",
            json={"pin": TEST_PIN}
        )
        self.partner_id = response.json()["partner_id"]
    
    def test_patch_scheduled_order_status(self):
        """Test PATCH /api/scheduled-orders/{id} - update status"""
        # First get current status
        get_response = requests.get(f"{BASE_URL}/api/scheduled-orders/{TEST_SCHEDULED_ORDER_ID}")
        original_status = get_response.json()["order"]["status"]
        
        # Update to a different status
        new_status = "delivering" if original_status == "completed" else "completed"
        patch_response = requests.patch(
            f"{BASE_URL}/api/scheduled-orders/{TEST_SCHEDULED_ORDER_ID}",
            json={"status": new_status}
        )
        assert patch_response.status_code == 200
        data = patch_response.json()
        assert data["success"] == True
        assert data["order"]["status"] == new_status
        
        # Restore original status
        requests.patch(
            f"{BASE_URL}/api/scheduled-orders/{TEST_SCHEDULED_ORDER_ID}",
            json={"status": original_status}
        )
        print(f"✓ Scheduled order status updated and restored")


class TestPartnerStats:
    """Partner statistics tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get partner ID for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/pin-login",
            json={"pin": TEST_PIN}
        )
        self.partner_id = response.json()["partner_id"]
    
    def test_get_partner_stats(self):
        """Test GET /api/partner/{id}/stats"""
        response = requests.get(f"{BASE_URL}/api/partner/{self.partner_id}/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "stats" in data
        stats = data["stats"]
        assert "total_deliveries" in stats
        assert "total_earnings" in stats
        assert "today_earnings" in stats
        assert "active_orders" in stats
        print(f"✓ Partner stats fetched: {stats['total_deliveries']} deliveries, ${stats['total_earnings']} total")
    
    def test_get_partner_profile(self):
        """Test GET /api/partner/{id}"""
        response = requests.get(f"{BASE_URL}/api/partner/{self.partner_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "partner" in data
        assert data["partner"]["name"] == "Test Driver"
        print("✓ Partner profile fetched")


class TestPhotoUploadEndpoint:
    """Photo upload endpoint tests - validates table parameter routing"""
    
    def test_photo_upload_endpoint_exists(self):
        """Test that photo upload endpoint exists and validates file type"""
        # Test without file - should fail with 422 (validation error)
        response = requests.post(
            f"{BASE_URL}/api/orders/{TEST_SCHEDULED_ORDER_ID}/upload-photo?table=scheduled_orders"
        )
        # 422 means endpoint exists but requires file
        assert response.status_code == 422
        print("✓ Photo upload endpoint exists and requires file")


class TestResponsePerformance:
    """Response size and performance tests"""
    
    def test_orders_list_response_size(self):
        """Verify orders list response is lightweight (no base64 photos)"""
        response = requests.get(f"{BASE_URL}/api/orders?status=completed&limit=10")
        assert response.status_code == 200
        
        # Check response size is reasonable (should be < 100KB for 10 orders)
        response_size = len(response.content)
        assert response_size < 100 * 1024, f"Response too large: {response_size} bytes"
        
        # Verify no base64 data in response
        response_text = response.text
        assert "data:image" not in response_text, "Response should not contain base64 images"
        print(f"✓ Orders list response is lightweight: {response_size} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
