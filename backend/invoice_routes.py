from flask import Blueprint, request, jsonify
from backend.database import Database
from datetime import datetime
import logging
import traceback

invoice_bp = Blueprint('invoice', __name__)
logger = logging.getLogger(__name__)
db = Database()



from flask import Blueprint, request, jsonify


@invoice_bp.route('/save_invoice', methods=['POST'])
def save_invoice():
    data = request.json
    conn = Database()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1️⃣ Save invoice header
        cursor.execute("""
            INSERT INTO invoices (invoice_no, customer_id, date, due_date, total_amount, status)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data['invoice_no'],
            data['customer_id'],
            data['date'],
            data['due_date'],
            data['total_amount'],
            data['status']
        ))
        invoice_id = cursor.lastrowid

        # 2️⃣ Save invoice items and reduce stock
        for item in data['items']:
            item_code = item['item_code']
            qty = int(item['quantity'])
            price = float(item['price'])

            # Insert invoice line
            cursor.execute("""
                INSERT INTO invoice_items (invoice_id, item_code, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (invoice_id, item_code, qty, price))

            # Reduce stock in items table
            cursor.execute("""
                UPDATE items
                SET stock = stock - %s
                WHERE code = %s
            """, (qty, item_code))

        conn.commit()
        return jsonify({"message": "Invoice saved successfully and stock updated"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()

@invoice_bp.route('/invoices', methods=['GET', 'POST', 'OPTIONS'])
def handle_invoices():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    if request.method == 'GET':
        try:
            query = """
                SELECT i.*, c.name as customer_name, c.email, c.phone 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                ORDER BY i.created_date DESC
            """
            invoices = db.execute_query(query)
            return jsonify({
                'invoices': invoices or [],
                'count': len(invoices) if invoices else 0,
                'success': True
            }), 200
        except Exception as e:
            logger.error(f"Error fetching invoices: {e}")
            return jsonify({'message': 'Error fetching invoices', 'success': False}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json()
            print("\n" + "=" * 80)
            print("🧾 POST /invoices - CREATE NEW INVOICE")
            print("=" * 80)
            print(f"Received data: {data}")
            print("=" * 80)

            # Validate required fields
            required_fields = ['invoice_number', 'customer_id', 'invoice_date', 'items']
            missing_fields = [field for field in required_fields if field not in data or not data[field]]
            
            if missing_fields:
                error_msg = f'Missing required fields: {", ".join(missing_fields)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            try:
                # Insert invoice
                invoice_query = """
                    INSERT INTO invoices 
                    (invoice_number, customer_id, invoice_date, due_date,
                     subtotal, tax_amount, total_amount, notes, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                invoice_params = (
                    data['invoice_number'],
                    data['customer_id'],
                    data['invoice_date'],
                    data.get('due_date'),
                    data.get('subtotal', 0),
                    data.get('tax_amount', 0),
                    data.get('total_amount', 0),
                    data.get('notes', ''),
                    data.get('status', 'Draft')
                )
                
                cursor.execute(invoice_query, invoice_params)
                invoice_id = cursor.lastrowid
                
                # Insert invoice items and update stock if finalized
                stock_updates = []
                if data['items']:
                    for item in data['items']:
                        # Insert invoice item
                        item_query = """
                            INSERT INTO invoice_items 
                            (invoice_id, item_id, item_name, hsn_code, quantity, 
                             unit_price, discount, tax_rate, total_price)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        item_params = (
                            invoice_id,
                            item.get('item_id'),
                            item.get('item_name', 'Unknown Item'),
                            item.get('hsn_code', ''),
                            item.get('quantity', 1),
                            item.get('unit_price', 0),
                            item.get('discount', 0),
                            item.get('tax_rate', 0),
                            item.get('total_price', 0)
                        )
                        cursor.execute(item_query, item_params)
                        
                        # Store stock updates if invoice is finalized
                        if data.get('status') == 'Finalized' and item.get('item_id'):
                            stock_updates.append({
                                'item_id': item['item_id'],
                                'quantity': item['quantity'],
                                'item_name': item.get('item_name', 'Unknown Item')
                            })
                
                # Process stock updates for finalized invoices
                if data.get('status') == 'Finalized' and stock_updates:
                    print(f"📦 Processing stock reduction for {len(stock_updates)} items")
                    for stock_update in stock_updates:
                        try:
                            # Check current stock first
                            cursor.execute("SELECT stock, name FROM items WHERE id = %s", (stock_update['item_id'],))
                            item_data = cursor.fetchone()
                            
                            if item_data:
                                current_stock = item_data['stock']
                                new_stock = current_stock - stock_update['quantity']
                                
                                if new_stock < 0:
                                    print(f"⚠️ Warning: Stock would go negative for item {stock_update['item_id']}. Setting to 0.")
                                    new_stock = 0
                                
                                # Update stock
                                update_stock_query = """
                                    UPDATE items 
                                    SET stock = %s 
                                    WHERE id = %s
                                """
                                cursor.execute(update_stock_query, (new_stock, stock_update['item_id']))
                                
                                print(f"✅ Stock updated: {item_data['name']} ({stock_update['item_id']}) - {current_stock} → {new_stock} (reduced by {stock_update['quantity']})")
                            else:
                                print(f"❌ Item not found for stock update: {stock_update['item_id']}")
                                
                        except Exception as stock_error:
                            print(f"⚠️ Stock update failed for item {stock_update['item_id']}: {stock_error}")
                            # Continue with other stock updates even if one fails
                
                connection.commit()
                print(f"✅ Invoice created successfully with ID: {invoice_id}")
                
                return jsonify({
                    'message': 'Invoice created successfully',
                    'id': invoice_id,
                    'success': True,
                    'stock_updated': len(stock_updates) if data.get('status') == 'Finalized' else 0
                }), 201
                
            except Exception as e:
                connection.rollback()
                print(f"💥 Database error: {e}")
                raise e
            finally:
                cursor.close()
                connection.close()
                
        except Exception as e:
            logger.error(f"Error creating invoice: {e}")
            print(f"💥 EXCEPTION in POST /invoices:")
            traceback.print_exc()
            return jsonify({'message': f'Server error: {str(e)}', 'success': False}), 500

@invoice_bp.route('/invoices/<int:invoice_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_invoice(invoice_id):
    if request.method == 'GET':
        try:
            # Get invoice details
            invoice_query = """
                SELECT i.*, c.name as customer_name, c.email, c.phone, 
                       c.address, c.gstin, c.state_code
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.id = %s
            """
            invoice = db.execute_query(invoice_query, (invoice_id,))
            
            if not invoice:
                return jsonify({'message': 'Invoice not found', 'success': False}), 404
            
            # Get invoice items
            items_query = """
                SELECT ii.*, i.code as item_code, i.description, i.stock as available_stock
                FROM invoice_items ii
                LEFT JOIN items i ON ii.item_id = i.id
                WHERE ii.invoice_id = %s
            """
            items = db.execute_query(items_query, (invoice_id,))
            
            invoice[0]['items'] = items or []
            
            return jsonify({'invoice': invoice[0], 'success': True}), 200
            
        except Exception as e:
            logger.error(f"Error fetching invoice: {e}")
            return jsonify({'message': 'Error fetching invoice', 'success': False}), 500

    elif request.method == 'PUT':
        try:
            data = request.get_json()
            print(f"📝 PUT /invoices/{invoice_id} - UPDATE INVOICE")
            print(f"Received data: {data}")

            # Validate required fields
            required_fields = ['invoice_number', 'customer_id', 'invoice_date', 'items']
            missing_fields = [field for field in required_fields if field not in data or not data[field]]
            
            if missing_fields:
                error_msg = f'Missing required fields: {", ".join(missing_fields)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            try:
                # First check if invoice exists and get current status
                cursor.execute("SELECT status FROM invoices WHERE id = %s", (invoice_id,))
                existing_invoice = cursor.fetchone()
                
                if not existing_invoice:
                    return jsonify({'message': 'Invoice not found', 'success': False}), 404
                
                previous_status = existing_invoice['status']
                new_status = data.get('status', 'Draft')
                
                # Update invoice
                invoice_query = """
                    UPDATE invoices 
                    SET invoice_number=%s, customer_id=%s, invoice_date=%s, due_date=%s,
                        subtotal=%s, tax_amount=%s, total_amount=%s, notes=%s, status=%s
                    WHERE id=%s
                """
                invoice_params = (
                    data['invoice_number'],
                    data['customer_id'],
                    data['invoice_date'],
                    data.get('due_date'),
                    data.get('subtotal', 0),
                    data.get('tax_amount', 0),
                    data.get('total_amount', 0),
                    data.get('notes', ''),
                    new_status,
                    invoice_id
                )
                
                cursor.execute(invoice_query, invoice_params)
                
                # Delete existing items and insert new ones
                cursor.execute("DELETE FROM invoice_items WHERE invoice_id = %s", (invoice_id,))
                
                # Insert invoice items and handle stock updates
                stock_updates = []
                if data['items']:
                    for item in data['items']:
                        # Insert invoice item
                        item_query = """
                            INSERT INTO invoice_items 
                            (invoice_id, item_id, item_name, hsn_code, quantity, 
                             unit_price, discount, tax_rate, total_price)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        item_params = (
                            invoice_id,
                            item.get('item_id'),
                            item.get('item_name', 'Unknown Item'),
                            item.get('hsn_code', ''),
                            item.get('quantity', 1),
                            item.get('unit_price', 0),
                            item.get('discount', 0),
                            item.get('tax_rate', 0),
                            item.get('total_price', 0)
                        )
                        cursor.execute(item_query, item_params)
                        
                        # Store stock updates if changing from Draft to Finalized
                        if previous_status != 'Finalized' and new_status == 'Finalized' and item.get('item_id'):
                            stock_updates.append({
                                'item_id': item['item_id'],
                                'quantity': item['quantity'],
                                'item_name': item.get('item_name', 'Unknown Item')
                            })
                
                # Process stock updates for status change to Finalized
                if previous_status != 'Finalized' and new_status == 'Finalized' and stock_updates:
                    print(f"📦 Processing stock reduction for {len(stock_updates)} items")
                    for stock_update in stock_updates:
                        try:
                            # Check current stock first
                            cursor.execute("SELECT stock, name FROM items WHERE id = %s", (stock_update['item_id'],))
                            item_data = cursor.fetchone()
                            
                            if item_data:
                                current_stock = item_data['stock']
                                new_stock = current_stock - stock_update['quantity']
                                
                                if new_stock < 0:
                                    print(f"⚠️ Warning: Stock would go negative for item {stock_update['item_id']}. Setting to 0.")
                                    new_stock = 0
                                
                                # Update stock
                                update_stock_query = """
                                    UPDATE items 
                                    SET stock = %s 
                                    WHERE id = %s
                                """
                                cursor.execute(update_stock_query, (new_stock, stock_update['item_id']))
                                
                                print(f"✅ Stock updated: {item_data['name']} ({stock_update['item_id']}) - {current_stock} → {new_stock} (reduced by {stock_update['quantity']})")
                            else:
                                print(f"❌ Item not found for stock update: {stock_update['item_id']}")
                                
                        except Exception as stock_error:
                            print(f"⚠️ Stock update failed for item {stock_update['item_id']}: {stock_error}")
                            # Continue with other stock updates even if one fails
                
                connection.commit()
                print(f"✅ Invoice {invoice_id} updated successfully")
                
                return jsonify({
                    'message': 'Invoice updated successfully',
                    'id': invoice_id,
                    'success': True,
                    'stock_updated': len(stock_updates) if previous_status != 'Finalized' and new_status == 'Finalized' else 0
                }), 200
                
            except Exception as e:
                connection.rollback()
                print(f"💥 Database error in PUT: {e}")
                raise e
            finally:
                cursor.close()
                connection.close()
                
        except Exception as e:
            logger.error(f"Error updating invoice: {e}")
            print(f"💥 EXCEPTION in PUT /invoices/{invoice_id}:")
            traceback.print_exc()
            return jsonify({'message': f'Server error: {str(e)}', 'success': False}), 500

    elif request.method == 'DELETE':
        try:
            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            try:
                # Get invoice details to restore stock if finalized
                cursor.execute("SELECT status FROM invoices WHERE id = %s", (invoice_id,))
                invoice = cursor.fetchone()
                
                stock_restored = 0
                if invoice and invoice['status'] == 'Finalized':
                    # Get invoice items to restore stock
                    cursor.execute("""
                        SELECT item_id, quantity FROM invoice_items 
                        WHERE invoice_id = %s
                    """, (invoice_id,))
                    items = cursor.fetchall()
                    
                    for item in items:
                        try:
                            # Check current stock
                            cursor.execute("SELECT stock, name FROM items WHERE id = %s", (item['item_id'],))
                            item_data = cursor.fetchone()
                            
                            if item_data:
                                current_stock = item_data['stock']
                                new_stock = current_stock + item['quantity']
                                
                                # Restore stock
                                cursor.execute("""
                                    UPDATE items SET stock = %s WHERE id = %s
                                """, (new_stock, item['item_id']))
                                
                                print(f"✅ Stock restored: {item_data['name']} ({item['item_id']}) - {current_stock} → {new_stock} (added {item['quantity']})")
                                stock_restored += 1
                                
                        except Exception as stock_error:
                            print(f"⚠️ Stock restoration failed for item {item['item_id']}: {stock_error}")
                            continue
                
                # Delete invoice items and invoice
                cursor.execute("DELETE FROM invoice_items WHERE invoice_id = %s", (invoice_id,))
                cursor.execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))
                
                connection.commit()
                
                message = 'Invoice deleted successfully'
                if stock_restored > 0:
                    message += f' and stock restored for {stock_restored} items'
                
                return jsonify({
                    'message': message,
                    'success': True,
                    'stock_restored': stock_restored
                }), 200
                
            except Exception as e:
                connection.rollback()
                raise e
            finally:
                cursor.close()
                connection.close()
                
        except Exception as e:
            logger.error(f"Error deleting invoice: {e}")
            return jsonify({'message': 'Error deleting invoice', 'success': False}), 500

@invoice_bp.route('/invoices/<int:invoice_id>/finalize', methods=['POST'])
def finalize_invoice(invoice_id):
    try:
        connection = db.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        try:
            # First check if invoice exists and get current status
            cursor.execute("SELECT status FROM invoices WHERE id = %s", (invoice_id,))
            invoice = cursor.fetchone()
            
            if not invoice:
                return jsonify({'message': 'Invoice not found', 'success': False}), 404
            
            # Only update if not already finalized
            if invoice['status'] != 'Finalized':
                # Update invoice status to Finalized
                cursor.execute("UPDATE invoices SET status = 'Finalized' WHERE id = %s", (invoice_id,))
                
                # Get invoice items to update stock
                cursor.execute("""
                    SELECT item_id, quantity FROM invoice_items 
                    WHERE invoice_id = %s
                """, (invoice_id,))
                items = cursor.fetchall()
                
                stock_updated = 0
                for item in items:
                    try:
                        # Check current stock first
                        cursor.execute("SELECT stock, name, code FROM items WHERE id = %s", (item['item_id'],))
                        item_data = cursor.fetchone()
                        
                        if item_data:
                            current_stock = item_data['stock']
                            new_stock = current_stock - item['quantity']
                            
                            # Prevent negative stock
                            if new_stock < 0:
                                print(f"⚠️ Warning: Stock would go negative for {item_data['name']}. Setting to 0.")
                                new_stock = 0
                            
                            # Update stock
                            cursor.execute("""
                                UPDATE items 
                                SET stock = %s 
                                WHERE id = %s
                            """, (new_stock, item['item_id']))
                            
                            print(f"✅ Stock reduced: {item_data['code']} - {item_data['name']} - {current_stock} → {new_stock} (reduced by {item['quantity']})")
                            stock_updated += 1
                        else:
                            print(f"❌ Item not found for stock update: {item['item_id']}")
                            
                    except Exception as stock_error:
                        print(f"⚠️ Stock update failed for item {item['item_id']}: {stock_error}")
                        # Continue with other stock updates even if one fails
                
                connection.commit()
                return jsonify({
                    'message': f'Invoice finalized and stock updated for {stock_updated} items',
                    'success': True,
                    'stock_updated': stock_updated
                }), 200
            else:
                return jsonify({'message': 'Invoice is already finalized', 'success': True}), 200
            
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()
            connection.close()
            
    except Exception as e:
        logger.error(f"Error finalizing invoice: {e}")
        return jsonify({'message': 'Error finalizing invoice', 'success': False}), 500

# Stock checking endpoint
@invoice_bp.route('/invoices/check-stock', methods=['POST'])
def check_stock_availability():
    """Check if sufficient stock is available for invoice items"""
    try:
        data = request.get_json()
        items = data.get('items', [])
        
        stock_issues = []
        sufficient_stock = True
        
        for item in items:
            if item.get('item_id'):
                # Check current stock
                query = "SELECT id, code, name, stock FROM items WHERE id = %s"
                result = db.execute_query(query, (item['item_id'],))
                
                if result:
                    current_stock = result[0]['stock']
                    required_quantity = item.get('quantity', 0)
                    
                    if current_stock < required_quantity:
                        sufficient_stock = False
                        stock_issues.append({
                            'item_id': item['item_id'],
                            'item_code': result[0]['code'],
                            'item_name': result[0]['name'],
                            'available_stock': current_stock,
                            'required_quantity': required_quantity,
                            'shortage': required_quantity - current_stock
                        })
        
        return jsonify({
            'sufficient_stock': sufficient_stock,
            'stock_issues': stock_issues,
            'success': True
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking stock: {e}")
        return jsonify({'message': 'Error checking stock availability', 'success': False}), 500

# ✅ ADD THIS FUNCTION TO REGISTER ROUTES
def register_invoice_routes(app):
    """Registers invoice routes with the Flask app."""
    app.register_blueprint(invoice_bp, url_prefix='/api')
    print("✅ Invoice routes registered successfully")