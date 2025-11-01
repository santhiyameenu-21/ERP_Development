import sys
sys.path.insert(0, '.')

from backend.database import Database

db = Database()

print("🔍 Testing FIXED Database...")

# Test 1: Insert a test item
print("\n1️⃣ Testing INSERT...")
test_data = {
    'code': 'FIXED_TEST_001',
    'name': 'Fixed Test Item', 
    'description': 'Testing the fixed database',
    'unit_price': 199.99,
    'stock': 50,
    'min_stock': 5,
    'hsn_code': 'FIXED123',
    'is_kit': False,
    'kit_name': '',
    'status': 'Active'
}

insert_query = """
    INSERT INTO items 
    (code, name, description, unit_price, stock, min_stock, hsn_code, is_kit, kit_name, status) 
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""
params = (
    test_data['code'], test_data['name'], test_data['description'], 
    test_data['unit_price'], test_data['stock'], test_data['min_stock'],
    test_data['hsn_code'], test_data['is_kit'], test_data['kit_name'], 
    test_data['status']
)

result = db.execute_query(insert_query, params)
print(f"📝 Insert result: {result}")

# Test 2: Verify the item exists
print("\n2️⃣ Verifying INSERT...")
items = db.execute_query("SELECT * FROM items WHERE code = 'FIXED_TEST_001'")
if items and len(items) > 0:
    print(f"✅ VERIFIED! Item found in database:")
    print(f"   ID: {items[0]['id']}")
    print(f"   Code: {items[0]['code']}")
    print(f"   Name: {items[0]['name']}")
else:
    print("❌ Item NOT found in database!")

# Test 3: Show all items
print("\n3️⃣ All items in database:")
all_items = db.execute_query("SELECT id, code, name FROM items ORDER BY id DESC LIMIT 10")
if all_items:
    for item in all_items:
        print(f"   ID: {item['id']}, Code: {item['code']}, Name: {item['name']}")
else:
    print("   No items found")

print("\n🏁 Fixed database test complete")