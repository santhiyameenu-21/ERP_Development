from flask import Blueprint, request, jsonify
from backend.database import Database
from datetime import datetime
import logging
import traceback

quotation_bp = Blueprint('quotation', __name__)
logger = logging.getLogger(__name__)
db = Database()

@quotation_bp.route('/quotations', methods=['GET', 'POST', 'OPTIONS'])
def handle_quotations():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    if request.method == 'GET':
        try:
            query = """
                SELECT q.*, c.name as customer_name, c.email, c.phone 
                FROM quotations q 
                LEFT JOIN customers c ON q.customer_id = c.id 
                ORDER BY q.created_date DESC
            """
            quotations = db.execute_query(query)
            return jsonify({
                'quotations': quotations or [],
                'count': len(quotations) if quotations else 0,
                'success': True
            }), 200
        except Exception as e:
            logger.error(f"Error fetching quotations: {e}")
            return jsonify({'message': 'Error fetching quotations', 'success': False}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json()
            print("\n" + "=" * 80)
            print("📄 POST /quotations - CREATE NEW QUOTATION")
            print("=" * 80)
            print(f"Received data: {data}")
            print("=" * 80)

            # Validate required fields
            required_fields = ['quotation_number', 'customer_id', 'quotation_date', 'items']
            missing_fields = [field for field in required_fields if field not in data or not data[field]]
            
            if missing_fields:
                error_msg = f'Missing required fields: {", ".join(missing_fields)}'
                print(f"❌ {error_msg}")
                return jsonify({'message': error_msg, 'success': False}), 400

            # Start transaction
            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            try:
                # Insert quotation
                quotation_query = """
                    INSERT INTO quotations 
                    (quotation_number, customer_id, quotation_date, valid_until, 
                     subtotal, tax_amount, total_amount, notes, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                quotation_params = (
                    data['quotation_number'],
                    data['customer_id'],
                    data['quotation_date'],
                    data.get('valid_until'),
                    data.get('subtotal', 0),
                    data.get('tax_amount', 0),
                    data.get('total_amount', 0),
                    data.get('notes', ''),
                    'Draft'
                )
                
                cursor.execute(quotation_query, quotation_params)
                quotation_id = cursor.lastrowid
                
                # Insert quotation items
                if data['items']:
                    for item in data['items']:
                        item_query = """
                            INSERT INTO quotation_items 
                            (quotation_id, item_id, item_name, hsn_code, quantity, 
                             unit_price, discount, tax_rate, total_price)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        item_params = (
                            quotation_id,
                            item.get('item_id'),
                            item.get('item_name'),
                            item.get('hsn_code'),
                            item.get('quantity', 1),
                            item.get('unit_price', 0),
                            item.get('discount', 0),
                            item.get('tax_rate', 0),
                            item.get('total_price', 0)
                        )
                        cursor.execute(item_query, item_params)
                
                connection.commit()
                print(f"✅ Quotation created successfully with ID: {quotation_id}")
                
                return jsonify({
                    'message': 'Quotation created successfully',
                    'id': quotation_id,
                    'success': True
                }), 201
                
            except Exception as e:
                connection.rollback()
                raise e
            finally:
                cursor.close()
                connection.close()
                
        except Exception as e:
            logger.error(f"Error creating quotation: {e}")
            print(f"💥 EXCEPTION in POST /quotations:")
            traceback.print_exc()
            return jsonify({'message': f'Server error: {str(e)}', 'success': False}), 500

@quotation_bp.route('/quotations/<int:quotation_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_quotation(quotation_id):
    if request.method == 'GET':
        try:
            # Get quotation details
            quotation_query = """
                SELECT q.*, c.name as customer_name, c.email, c.phone, 
                       c.address, c.gstin, c.state_code
                FROM quotations q 
                LEFT JOIN customers c ON q.customer_id = c.id 
                WHERE q.id = %s
            """
            quotation = db.execute_query(quotation_query, (quotation_id,))
            
            if not quotation:
                return jsonify({'message': 'Quotation not found', 'success': False}), 404
            
            # Get quotation items
            items_query = """
                SELECT qi.*, i.code as item_code, i.description
                FROM quotation_items qi
                LEFT JOIN items i ON qi.item_id = i.id
                WHERE qi.quotation_id = %s
            """
            items = db.execute_query(items_query, (quotation_id,))
            
            quotation[0]['items'] = items or []
            
            return jsonify({'quotation': quotation[0], 'success': True}), 200
            
        except Exception as e:
            logger.error(f"Error fetching quotation: {e}")
            return jsonify({'message': 'Error fetching quotation', 'success': False}), 500

    elif request.method == 'DELETE':
        try:
            # Delete quotation and related items
            connection = db.get_connection()
            cursor = connection.cursor()
            
            cursor.execute("DELETE FROM quotation_items WHERE quotation_id = %s", (quotation_id,))
            cursor.execute("DELETE FROM quotations WHERE id = %s", (quotation_id,))
            
            connection.commit()
            cursor.close()
            connection.close()
            
            return jsonify({'message': 'Quotation deleted successfully', 'success': True}), 200
        except Exception as e:
            logger.error(f"Error deleting quotation: {e}")
            return jsonify({'message': 'Error deleting quotation', 'success': False}), 500

@quotation_bp.route('/quotations/<int:quotation_id>/finalize', methods=['POST'])
def finalize_quotation(quotation_id):
    try:
        # Update quotation status to Finalized
        query = "UPDATE quotations SET status = 'Finalized' WHERE id = %s"
        result = db.execute_query(query, (quotation_id,))
        
        if result:
            return jsonify({'message': 'Quotation finalized successfully', 'success': True}), 200
        else:
            return jsonify({'message': 'Error finalizing quotation', 'success': False}), 500
            
    except Exception as e:
        logger.error(f"Error finalizing quotation: {e}")
        return jsonify({'message': 'Error finalizing quotation', 'success': False}), 500

def register_quotation_routes(app):
    """Registers quotation routes with the Flask app."""
    app.register_blueprint(quotation_bp, url_prefix='/api')
    print("✅ Quotation routes registered successfully")