from backend.database import Database
from flask import request

db = Database()

class Customer:
    def __init__(self, data):
        self.id = data.get('id')
        self.name = data.get('name')
        self.email = data.get('email')
        self.phone = data.get('phone')
        self.address = data.get('address')
        self.gstin = data.get('gstin')
        self.state_code = data.get('state_code')
        self.status = data.get('status', 'Active')
    
    @staticmethod
    def create_tables():
        """Create customers table"""
        print("📊 Creating customers table...")
        queries = [
            """
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(20),
                address TEXT,
                gstin VARCHAR(15),
                state_code VARCHAR(2),
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_name (name),
                INDEX idx_email (email),
                INDEX idx_phone (phone)
            )
            """
        ]
        
        for query in queries:
            try:
                result = db.execute_query(query)
                if result is None:
                    print(f"⚠️ Warning: Customer table creation query failed")
                else:
                    print(f"✅ Customers table created/verified")
            except Exception as e:
                print(f"❌ Error creating customers table: {e}")
    
    def save(self):
        """Save or update customer in database"""
        try:
            if self.id:
                # UPDATE existing customer
                query = """
                    UPDATE customers 
                    SET name=%s, email=%s, phone=%s, address=%s, 
                        gstin=%s, state_code=%s, status=%s 
                    WHERE id=%s
                """
                params = (
                    self.name, self.email, self.phone, self.address,
                    self.gstin, self.state_code, self.status, self.id
                )
                result = db.execute_query(query, params)
                return self.id if result else None
            else:
                # INSERT new customer
                query = """
                    INSERT INTO customers 
                    (name, email, phone, address, gstin, state_code, status) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    self.name, self.email, self.phone, self.address,
                    self.gstin, self.state_code, self.status
                )
                result = db.execute_query(query, params)
                if result:
                    self.id = result
                    return self.id
                return None
        except Exception as e:
            print(f"💥 Error in Customer.save(): {e}")
            return None
    
    @staticmethod
    def get_all():
        """Get all customers"""
        try:
            result = db.execute_query("SELECT * FROM customers ORDER BY name")
            return result if result else []
        except Exception as e:
            print(f"❌ Error in Customer.get_all(): {e}")
            return []
    
    @staticmethod
    def get_by_id(customer_id):
        """Get customer by ID"""
        try:
            result = db.execute_query("SELECT * FROM customers WHERE id = %s", (customer_id,))
            return result[0] if result else None
        except Exception as e:
            print(f"❌ Error in Customer.get_by_id(): {e}")
            return None
    
    @staticmethod
    def search_by_name(search_term):
        """Search customers by name"""
        try:
            query = """
                SELECT * FROM customers 
                WHERE name LIKE %s AND status = 'Active'
                ORDER BY name
                LIMIT 10
            """
            params = (f"%{search_term}%",)
            result = db.execute_query(query, params)
            return result if result else []
        except Exception as e:
            print(f"❌ Error in Customer.search_by_name(): {e}")
            return []
    
    @staticmethod
    def delete(customer_id):
        """Delete customer by ID"""
        try:
            return db.execute_query("DELETE FROM customers WHERE id = %s", (customer_id,))
        except Exception as e:
            print(f"❌ Error in Customer.delete(): {e}")
            return None