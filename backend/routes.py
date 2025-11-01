# File: backend/routes.py

from flask import Blueprint, request, jsonify
from backend.models import Item, KitItem, HSN
from backend.cache_manager import cache, CacheManager
from backend.database import Database
from datetime import datetime
import logging
import traceback

api = Blueprint('api', __name__)
logger = logging.getLogger(__name__)
db = Database()

# ============================
# 📦 ITEMS ENDPOINTS
# ============================
@api.route('/items', methods=['GET', 'POST', 'OPTIONS'])
def handle_items():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    if request.method == 'GET':
        try:
            items = Item.get_items_with_kit_info()
            print(f"✅ GET /items - Returning {len(items)} items")
            return jsonify({
                'items': items,
                'count': len(items),
                'success': True
            }), 200
        except Exception as e:
            logger.error(f"Error fetching items: {e}")
            traceback.print_exc()
            return jsonify({'message': 'Error fetching items', 'success': False}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json()
            print("\n" + "=" * 80)
            print("📦 POST /items - CREATE NEW ITEM")
            print("=" * 80)
            print(f"Received data: {data}")
            print("=" * 80)

            if not data:
                print("❌ No data provided")
                return jsonify({'message': 'No data provided', 'success': False}), 400

            # Validate required fields
            required_fields = ['code', 'name', 'unit_price', 'stock', 'min_stock']
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
                elif data[field] is None or data[field] == '':
                    missing_fields.append(field)

            if missing_fields:
                error_msg = f'Missing required fields: {", ".join(missing_fields)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            # Convert data types
            try:
                data['unit_price'] = float(data['unit_price'])
                data['stock'] = int(data['stock'])
                data['min_stock'] = int(data['min_stock'])
                data['is_kit'] = bool(data.get('is_kit', False))
                print(f"✅ Data types converted successfully")
            except (ValueError, TypeError) as e:
                error_msg = f'Invalid data type: {str(e)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            # Handle HSN code
            if not data.get('hsn_code') or data.get('hsn_code', '').strip() == '':
                if data.get('name'):
                    print(f"🔍 Attempting HSN auto-fill for: {data['name']}")
                    hsn_data = HSN.get_by_item_name(data['name'])
                    if hsn_data:
                        data['hsn_code'] = hsn_data['HSN_CODE']
                        print(f"✅ Auto-filled HSN: {data['hsn_code']}")
                    else:
                        data['hsn_code'] = 'DEFAULT_HSN'
                        print(f"⚠️ Using default HSN code")
                else:
                    data['hsn_code'] = 'DEFAULT_HSN'
                    print(f"⚠️ No name provided, using default HSN")

            # Create item first
            print(f"💾 Creating item: {data['code']}")
            item = Item(data)
            item_id = item.save()

            if not item_id:
                print("❌ Failed to create item - save() returned None")
                return jsonify({'message': 'Error creating item in database', 'success': False}), 500

            print(f"✅ Item created successfully with ID: {item_id}")

            # Handle kit items if it's a kit
            # In your POST /items route - enhance the kit section:
            # In your POST /items route - enhance the kit section:
            if data.get('is_kit') and data.get('kit_items'):
                kit_items = data['kit_items']
                print(f"📦 KIT DETECTED - Processing {len(kit_items)} components for kit_id: {item_id}")
                
                success_count = 0
                for idx, kit_item_data in enumerate(kit_items):
                    try:
                        print(f"🔧 Kit Component {idx+1}: {kit_item_data}")
                        
                        if not kit_item_data.get('item_id'):
                            print(f"⚠️ Skipping - No item_id in component {idx+1}")
                            continue
                        
                        kit_item = KitItem({
                            'kit_id': item_id,
                            'item_id': int(kit_item_data['item_id']),
                            'quantity': int(kit_item_data.get('quantity', 1))
                        })
                        
                        print(f"💾 Saving to kit_items: kit_id={kit_item.kit_id}, item_id={kit_item.item_id}, quantity={kit_item.quantity}")
                        result = kit_item.save()
                        
                        if result:
                            success_count += 1
                            print(f"✅ Component {idx+1} saved to kit_items table with ID: {result}")
                        else:
                            print(f"❌ FAILED to save component {idx+1} to kit_items")
                            
                    except Exception as e:
                        print(f"💥 ERROR saving component {idx+1}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue
                
                print(f"🎯 KIT SAVE SUMMARY: {success_count}/{len(kit_items)} components saved to kit_items table")
            CacheManager.clear_items_cache()
            
            print("=" * 80)
            print(f"🎉 SUCCESS - Item {data['code']} created with ID: {item_id}")
            print("=" * 80 + "\n")
            
            return jsonify({
                'message': 'Item created successfully',
                'id': item_id,
                'success': True
            }), 201

        except Exception as e:
            logger.error(f"Error creating item: {e}")
            print(f"💥 EXCEPTION in POST /items:")
            traceback.print_exc()
            return jsonify({'message': f'Server error: {str(e)}', 'success': False}), 500
@api.route('/test-save', methods=['POST'])
def test_save():
    """Simple test endpoint"""
    try:
        data = request.get_json()
        print("🎯 TEST ENDPOINT - Received data:", data)
        
        # Simple save without validation
        query = """
            INSERT INTO items 
            (code, name, description, unit_price, stock, min_stock, hsn_code, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            data.get('code', 'TEST'), 
            data.get('name', 'Test'),
            data.get('description', ''),
            float(data.get('unit_price', 0)),
            int(data.get('stock', 0)),
            int(data.get('min_stock', 0)),
            data.get('hsn_code', 'DEFAULT'),
            'Active'
        )
        
        result = db.execute_query(query, params)
        print("✅ TEST SAVE RESULT:", result)
        
        return jsonify({
            'message': 'Test save successful',
            'id': result,
            'success': True
        }), 201
        
    except Exception as e:
        print("❌ TEST SAVE ERROR:", e)
        return jsonify({'message': str(e), 'success': False}), 500
# ============================
# 🧩 SINGLE ITEM ENDPOINT
# ============================
@api.route('/items/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_item(item_id):
    if request.method == 'GET':
        try:
            print(f"📥 GET /items/{item_id}")
            item = Item.get_by_id(item_id)
            if item:
                if item.get('is_kit'):
                    kit_items = KitItem.get_kit_items(item_id)
                    item['kit_components'] = kit_items
                    print(f"✅ Item {item_id} retrieved with {len(kit_items)} components")
                else:
                    print(f"✅ Item {item_id} retrieved")
                return jsonify({'item': item, 'success': True}), 200
            else:
                print(f"❌ Item {item_id} not found")
                return jsonify({'message': 'Item not found', 'success': False}), 404
        except Exception as e:
            logger.error(f"Error fetching item: {e}")
            traceback.print_exc()
            return jsonify({'message': 'Error fetching item', 'success': False}), 500

    elif request.method == 'PUT':
        try:
            data = request.get_json()
            data['id'] = item_id
            
            print("\n" + "=" * 80)
            print(f"📝 PUT /items/{item_id} - UPDATE ITEM")
            print("=" * 80)
            print(f"Received data: {data}")
            print("=" * 80)

            # Validate required fields
            required_fields = ['code', 'name', 'unit_price', 'stock', 'min_stock']
            missing_fields = []
            
            for field in required_fields:
                if field not in data or data[field] is None or data[field] == '':
                    missing_fields.append(field)

            if missing_fields:
                error_msg = f'Missing required fields: {", ".join(missing_fields)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            # Convert data types
            try:
                data['unit_price'] = float(data['unit_price'])
                data['stock'] = int(data['stock'])
                data['min_stock'] = int(data['min_stock'])
                data['is_kit'] = bool(data.get('is_kit', False))
            except (ValueError, TypeError) as e:
                error_msg = f'Invalid data type: {str(e)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            # Handle HSN code
            if not data.get('hsn_code') or data.get('hsn_code', '').strip() == '':
                if data.get('name'):
                    hsn_data = HSN.get_by_item_name(data['name'])
                    if hsn_data:
                        data['hsn_code'] = hsn_data['HSN_CODE']
                        print(f"✅ Auto-filled HSN: {data['hsn_code']}")
                    else:
                        data['hsn_code'] = 'DEFAULT_HSN'
                else:
                    data['hsn_code'] = 'DEFAULT_HSN'

            # Validate kit items if it's a kit
            if data.get('is_kit'):
                kit_items = data.get('kit_items', [])
                if not kit_items or len(kit_items) == 0:
                    error_msg = 'Kit must have at least one component'
                    print(f"❌ {error_msg}")
                    return jsonify({'message': error_msg, 'success': False}), 400

            print(f"💾 Updating item: {data['code']}")
            item = Item(data)
            result = item.save()

            if result is not None:
                print(f"✅ Item updated successfully")
                
                # Update kit items if it's a kit
                if data.get('is_kit') and 'kit_items' in data:
                    print(f"🔄 Updating kit components for item {item_id}")
                    KitItem.delete_kit_items(item_id)
                    
                    kit_items = data['kit_items']
                    success_count = 0
                    for kit_item_data in kit_items:
                        try:
                            kit_item = KitItem({
                                'kit_id': item_id,
                                'item_id': int(kit_item_data['item_id']),
                                'quantity': int(kit_item_data.get('quantity', 1))
                            })
                            if kit_item.save():
                                success_count += 1
                        except Exception as e:
                            print(f"⚠️ Error saving component: {e}")
                            continue
                    
                    print(f"✅ Updated {success_count}/{len(kit_items)} components")
                elif not data.get('is_kit'):
                    KitItem.delete_kit_items(item_id)
                    print(f"✅ Removed kit components (item is no longer a kit)")

                CacheManager.clear_items_cache()
                
                print("=" * 80)
                print(f"🎉 SUCCESS - Item {item_id} updated")
                print("=" * 80 + "\n")
                
                return jsonify({'message': 'Item updated successfully', 'success': True}), 200
            else:
                print("❌ Failed to update item")
                return jsonify({'message': 'Error updating item', 'success': False}), 500

        except Exception as e:
            logger.error(f"Error updating item: {e}")
            print(f"💥 EXCEPTION in PUT /items/{item_id}:")
            traceback.print_exc()
            return jsonify({'message': 'Error updating item', 'success': False}), 500

    elif request.method == 'DELETE':
        try:
            print(f"🗑️ DELETE /items/{item_id}")
            item = Item.get_by_id(item_id)
            if not item:
                print(f"❌ Item {item_id} not found")
                return jsonify({'message': 'Item not found', 'success': False}), 404

            result = Item.delete(item_id)
            if result is not None:
                CacheManager.clear_items_cache()
                print(f"✅ Item {item_id} deleted successfully")
                return jsonify({'message': 'Item deleted successfully', 'success': True}), 200
            else:
                print(f"❌ Failed to delete item {item_id}")
                return jsonify({'message': 'Error deleting item', 'success': False}), 500
        except Exception as e:
            logger.error(f"Error deleting item: {e}")
            traceback.print_exc()
            return jsonify({'message': 'Error deleting item', 'success': False}), 500

# ============================
# 🔍 HSN ENDPOINTS
# ============================
@api.route('/hsn/search', methods=['GET'])
def search_hsn():
    try:
        item_name = request.args.get('item_name', '')
        if not item_name:
            return jsonify({'hsn_codes': [], 'success': True}), 200
        
        hsn_codes = HSN.search_hsn_by_name(item_name)
        return jsonify({'hsn_codes': hsn_codes, 'success': True}), 200
    except Exception as e:
        logger.error(f"Error searching HSN: {e}")
        return jsonify({'message': 'Error searching HSN codes', 'success': False}), 500

@api.route('/hsn/auto-fill', methods=['GET'])
def auto_fill_hsn():
    try:
        item_name = request.args.get('item_name', '').strip()
        print(f"🔍 HSN Auto-fill for: '{item_name}'")
        
        if not item_name:
            return jsonify({'hsn_code': None, 'success': True}), 200
        
        hsn_data = HSN.get_by_item_name(item_name)
        if hsn_data:
            print(f"✅ HSN Found: {hsn_data['HSN_CODE']}")
            return jsonify({
                'hsn_code': hsn_data['HSN_CODE'],
                'description': hsn_data['DESCRIPTION'],
                'matched_description': hsn_data['DESCRIPTION'],
                'success': True
            }), 200
        else:
            print(f"❌ No HSN found")
            return jsonify({
                'hsn_code': None, 
                'description': None,
                'matched_description': None,
                'success': True
            }), 200
    except Exception as e:
        print(f"🚨 Error in HSN auto-fill: {e}")
        return jsonify({'message': 'Error auto-filling HSN code', 'success': False}), 500

@api.route('/hsn/all', methods=['GET'])
def get_all_hsn():
    try:
        hsn_codes = HSN.get_all_hsn_codes()
        return jsonify({'hsn_codes': hsn_codes, 'success': True}), 200
    except Exception as e:
        logger.error(f"Error fetching HSN codes: {e}")
        return jsonify({'message': 'Error fetching HSN codes', 'success': False}), 500

# ============================
# ⚙️ KIT + HEALTH ENDPOINTS
# ============================
@api.route('/kit-names', methods=['GET'])
def get_kit_names():
    try:
        kit_names = Item.get_kit_names()
        return jsonify({
            'kit_names': [kn['kit_name'] for kn in kit_names if kn['kit_name']],
            'success': True
        }), 200
    except Exception as e:
        logger.error(f"Error fetching kit names: {e}")
        return jsonify({'message': 'Error fetching kit names', 'success': False}), 500

@api.route('/non-kit-items', methods=['GET'])
def get_non_kit_items():
    try:
        items = db.execute_query("SELECT id, code, name, unit_price FROM items WHERE is_kit = FALSE AND status = 'Active'")
        return jsonify({'items': items if items else [], 'success': True}), 200
    except Exception as e:
        logger.error(f"Error fetching non-kit items: {e}")
        return jsonify({'message': 'Error fetching non-kit items', 'success': False}), 500

@api.route('/kit-components/<int:kit_id>', methods=['GET'])
def get_kit_components(kit_id):
    try:
        kit_items = KitItem.get_kit_items(kit_id)
        return jsonify({'kit_components': kit_items, 'success': True}), 200
    except Exception as e:
        logger.error(f"Error fetching kit components: {e}")
        return jsonify({'message': 'Error fetching kit components', 'success': False}), 500

@api.route('/kit-total-value/<int:kit_id>', methods=['GET'])
def get_kit_total_value(kit_id):
    try:
        total_value = KitItem.get_kit_total_value(kit_id)
        return jsonify({'total_value': float(total_value) if total_value else 0, 'success': True}), 200
    except Exception as e:
        logger.error(f"Error calculating kit total value: {e}")
        return jsonify({'message': 'Error calculating kit total value', 'success': False}), 500

@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Mechanical Core ERP API is running',
        'timestamp': datetime.now().isoformat(),
        'success': True
    }), 200

@api.route('/')
def api_root():
    return jsonify({
        'message': 'Mechanical Core ERP API',
        'version': '1.0',
        'endpoints': {
            'items': '/api/items',
            'single_item': '/api/items/<id>',
            'kit_names': '/api/kit-names',
            'non_kit_items': '/api/non-kit-items',
            'kit_components': '/api/kit-components/<kit_id>',
            'kit_total_value': '/api/kit-total-value/<kit_id>',
            'hsn_search': '/api/hsn/search?item_name=<name>',
            'hsn_auto_fill': '/api/hsn/auto-fill?item_name=<name>',
            'hsn_all': '/api/hsn/all',
            'health': '/api/health'
        },
        'success': True
    }), 200

def register_routes(app):
    """Registers all API routes with the Flask app."""
    app.register_blueprint(api, url_prefix='/api')
    print("✅ API routes registered successfully")