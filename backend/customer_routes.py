from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from backend.database import Database

customer_bp = Blueprint('customer_bp', __name__)
db = Database()

@customer_bp.route('/api/customers', methods=['GET'])
@cross_origin()
def get_customers():
    try:
        query = "SELECT * FROM customers ORDER BY created_date DESC"
        result = db.execute_query(query)
        return jsonify(result if result else []), 200
    except Exception as e:
        print("❌ Error loading customers:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@customer_bp.route('/api/customers', methods=['POST'])
@cross_origin()
def add_customer():
    try:
        data = request.json
        print("\n" + "="*50)
        print("💾 Creating customer from customer.html")
        print("="*50)
        print(f"Received data: {data}")
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({"error": "Customer name is required"}), 400
        
        if not data.get('phone'):
            return jsonify({"error": "Phone number is required"}), 400
            
        if not data.get('address'):
            return jsonify({"error": "Address is required"}), 400
        
        query = """
            INSERT INTO customers (name, email, phone, address, gstin, state_code, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            data.get('name'),
            data.get('email', ''),
            data.get('phone'),
            data.get('address'),
            data.get('gstin', ''),
            data.get('state_code', ''),
            data.get('status', 'Active')
        )
        
        print(f"Executing query with params: {params}")
        result = db.execute_query(query, params)
        
        if result:
            print(f"✅ Customer created with ID: {result}")
            return jsonify({
                "message": "Customer added successfully!",
                "customer_id": result,
                "success": True
            }), 201
        else:
            print("❌ Failed to create customer")
            return jsonify({"error": "Failed to create customer"}), 500
            
    except Exception as e:
        print(f"💥 Error adding customer: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
