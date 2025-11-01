"""
Complete diagnostic script to find why items aren't saving from frontend
Run: python debug_save.py
"""

import sys
sys.path.insert(0, '.')

from flask import Flask
from flask_cors import CORS
from backend.routes import register_routes
from backend.models import Item
import json

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})

# Register routes
register_routes(app)

print("\n" + "=" * 80)
print("🧪 COMPREHENSIVE SAVE DIAGNOSTIC TEST")
print("=" * 80)

# Test 1: Check current items
print("\n1️⃣ Current items in database:")
items = Item.get_all()
print(f"   Found {len(items)} items:")
for item in items:
    print(f"   - {item['code']}: {item['name']}")

# Test 2: Simulate a POST request
print("\n2️⃣ Simulating API POST request...")

test_payload = {
    "code": "ITEM004",
    "name": "Bolt",
    "description": "Test bolt",
    "unit_price": 50,
    "stock": 100,
    "min_stock": 20,
    "hsn_code": "TEST123",
    "is_kit": False,
    "kit_name": "",
    "status": "Active",
    "kit_items": []
}

print(f"   Payload: {json.dumps(test_payload, indent=2)}")

with app.test_client() as client:
    print("\n3️⃣ Sending POST request to /api/items...")
    response = client.post(
        '/api/items',
        data=json.dumps(test_payload),
        content_type='application/json'
    )
    
    print(f"\n4️⃣ Response received:")
    print(f"   Status Code: {response.status_code}")
    print(f"   Response Data: {response.get_json()}")
    
    if response.status_code == 201:
        print("\n   ✅ SUCCESS! Item was created")
    else:
        print(f"\n   ❌ FAILED! Status: {response.status_code}")

# Test 3: Check if item was saved
print("\n5️⃣ Verifying item in database...")
items_after = Item.get_all()
print(f"   Now have {len(items_after)} items:")
for item in items_after:
    print(f"   - {item['code']}: {item['name']}")

if len(items_after) > len(items):
    print("\n   ✅ Item was successfully saved to database!")
    
    # Find the new item
    new_item = None
    for item in items_after:
        if item['code'] == 'ITEM004':
            new_item = item
            break
    
    if new_item:
        print(f"\n   📦 New item details:")
        print(f"      ID: {new_item['id']}")
        print(f"      Code: {new_item['code']}")
        print(f"      Name: {new_item['name']}")
        print(f"      Price: {new_item['unit_price']}")
        print(f"      Stock: {new_item['stock']}")
        print(f"      HSN: {new_item['hsn_code']}")
        
        # Clean up
        print(f"\n   🗑️ Cleaning up test item...")
        Item.delete(new_item['id'])
        print(f"   ✅ Test item deleted")
else:
    print("\n   ❌ Item was NOT saved to database!")
    print("\n   Possible issues:")
    print("   1. Database connection problem")
    print("   2. Query execution failure")
    print("   3. Data validation error")
    print("   4. CORS issue (but unlikely since test client bypasses it)")

# Test 4: Check CORS configuration
print("\n6️⃣ Testing CORS configuration...")
with app.test_client() as client:
    response = client.options('/api/items')
    print(f"   OPTIONS request status: {response.status_code}")
    print(f"   CORS headers: {dict(response.headers)}")

# Test 5: Test direct database insert
print("\n7️⃣ Testing direct database insert...")
from backend.database import Database
db = Database()

test_query = """
    INSERT INTO items (code, name, description, unit_price, stock, min_stock, hsn_code, status)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
"""
test_params = ('DIRECT_TEST', 'Direct Test', 'Testing', 75.0, 50, 10, 'HSN_TEST', 'Active')

result = db.execute_query(test_query, test_params)
if result:
    print(f"   ✅ Direct insert worked! ID: {result}")
    # Clean up
    db.execute_query("DELETE FROM items WHERE code = 'DIRECT_TEST'")
    print(f"   ✅ Test item cleaned up")
else:
    print(f"   ❌ Direct insert failed!")

print("\n" + "=" * 80)
print("🏁 DIAGNOSTIC COMPLETE")
print("=" * 80)

print("\n📋 SUMMARY:")
print("If the API test succeeded but frontend still fails:")
print("  1. Check browser console for JavaScript errors")
print("  2. Check Network tab for the actual request being sent")
print("  3. Verify frontend is sending to http://localhost:5000/api/items")
print("  4. Make sure HSN code field is not empty")
print("  5. Check if there's a CORS error in browser console")

print("\nIf the API test failed:")
print("  1. Check the error message above")
print("  2. Verify database connection in config.py")
print("  3. Check if all required fields are present")
print("  4. Look for validation errors in routes.py")