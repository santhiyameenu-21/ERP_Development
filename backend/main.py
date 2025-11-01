import os
import logging
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Configure logging first
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS globally

# Serve frontend files - ADD THESE ROUTES FIRST
@app.route('/')
def serve_index():
    """Serve the main frontend page"""
    try:
        return send_from_directory('../frontend', 'index.html')
    except Exception as e:
        logger.error(f"Error serving index.html: {e}")
        return jsonify({"error": "Frontend not available", "success": False}), 500

@app.route('/<path:path>')
def serve_static(path):
    """Serve all frontend static files"""
    try:
        return send_from_directory('../frontend', path)
    except Exception as e:
        logger.error(f"Error serving static file {path}: {e}")
        return jsonify({"error": "File not found", "success": False}), 404

# Initialize database connection
try:
    from backend.database import Database
    from backend.config import Config
    logger.info("✅ Database modules imported successfully")
except ImportError as e:
    logger.error(f"❌ Database modules import failed: {e}")

# Safely import and register all modules
try:
    from backend.customer_routes import customer_bp
    app.register_blueprint(customer_bp)
    logger.info("✅ Customer routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Customer routes not available: {e}")

try:
    from backend.routes import register_routes
    register_routes(app)
    logger.info("✅ Main routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Main routes not available: {e}")

try:
    from backend.quotation_routes import register_quotation_routes
    register_quotation_routes(app)
    logger.info("✅ Quotation routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Quotation routes not available: {e}")

try:
    from backend.invoice_routes import register_invoice_routes
    register_invoice_routes(app)
    logger.info("✅ Invoice routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Invoice routes not available: {e}")

# Safe table initialization
def initialize_database_tables():
    """Initialize database tables safely"""
    try:
        from backend.models import Item
        from backend.customer_model import Customer
        from backend.quotation_invoice_models import QuotationInvoiceModels
        
        logger.info("🔄 Initializing database tables...")
        Customer.create_tables()
        Item.create_tables()
        QuotationInvoiceModels.create_tables()
        logger.info("✅ All tables initialized successfully")
    except Exception as e:
        logger.error(f"❌ Table initialization failed: {e}")

# Initialize tables when app starts
initialize_database_tables()

# Your existing API routes
@app.route('/api/')
def api_root():
    """API root endpoint"""
    return jsonify({
        "message": "Mechanical ERP Backend API",
        "version": "1.0",
        "endpoints": {
            "customers": "/api/customers",
            "items": "/api/items", 
            "quotations": "/api/quotations",
            "invoices": "/api/invoices",
            "health": "/api/health"
        }
    })

@app.route('/api/debug/customer-test', methods=['POST'])
def debug_customer_test():
    """Debug: insert a test customer into Cloud SQL"""
    try:
        data = request.get_json()
        from backend.database import Database
        db = Database()
        query = """
            INSERT INTO customers (name, email, phone, address, gstin, state_code, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            data.get('name', 'Cloud SQL Test Customer'),
            data.get('email', ''),
            data.get('phone', ''),
            data.get('address', ''),
            data.get('gstin', ''),
            data.get('state_code', ''),
            'Active'
        )
        result = db.execute_query(query, params)
        if result is not None:
            return jsonify({
                "message": "Customer inserted into Cloud SQL",
                "id": result,
                "success": True
            })
        else:
            return jsonify({"error": "Failed to insert customer.", "success": False}), 500
    except Exception as e:
        logger.error(f"Error inserting test customer: {e}")
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check to test DB connection"""
    try:
        from backend.database import Database
        db = Database()
        conn = db.get_connection()
        if conn:
            conn.close()
            return jsonify({
                "status": "healthy", 
                "cloud_sql": True, 
                "connection_method": "Unix Socket (App Engine)" if os.getenv("CLOUD_SQL_CONNECTION_NAME") else "Host/IP"
            }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
    
    return jsonify({
        "status": "unhealthy", 
        "cloud_sql": False, 
        "connection_method": "Unix Socket (App Engine)" if os.getenv("CLOUD_SQL_CONNECTION_NAME") else "Host/IP"
    }), 500

# Debug endpoints
@app.route('/api/debug/loaded-modules')
def debug_loaded_modules():
    """Debug endpoint to see what modules loaded"""
    return jsonify({
        "message": "Debug endpoint - check logs for module loading status",
        "success": True
    })

@app.route('/api/debug/simple-test')
def debug_simple_test():
    """Simple database test"""
    try:
        from backend.database import Database
        db = Database()
        conn = db.get_connection()
        
        if conn:
            conn.close()
            return jsonify({"success": True, "connected": True})
        else:
            return jsonify({"success": False, "connected": False})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting backend for local development...")
    app.run(host='0.0.0.0', port=8080, debug=True)