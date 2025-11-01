from datetime import datetime
from backend.database import Database

db = Database()

class HSN:
    def __init__(self, data):
        self.id = data.get('id')
        self.hsn_code = data.get('HSN_CODE')
        self.description = data.get('DESCRIPTION')
        self.gst_rate = data.get('GST_RATE')
    
    @staticmethod
    def get_by_item_name(item_name):
        """Get HSN code by matching item name with description"""
        if not item_name:
            return None
        
        print(f"🔍 Searching HSN for: '{item_name}'")
        
        # Clean the item name
        clean_item_name = item_name.strip().lower()
        
        # Try different matching strategies
        queries = [
            # Exact match
            ("SELECT * FROM hsn WHERE LOWER(DESCRIPTION) = %s LIMIT 1", [clean_item_name]),
            
            # Contains match
            ("SELECT * FROM hsn WHERE LOWER(DESCRIPTION) LIKE %s LIMIT 1", [f"%{clean_item_name}%"]),
            
            # Word boundary match
            ("SELECT * FROM hsn WHERE LOWER(DESCRIPTION) LIKE %s LIMIT 1", [f"% {clean_item_name} %"]),
            
            # Starts with
            ("SELECT * FROM hsn WHERE LOWER(DESCRIPTION) LIKE %s LIMIT 1", [f"{clean_item_name}%"]),
        ]
        
        for query, params in queries:
            try:
                result = db.execute_query(query, params)
                if result:
                    matched_item = result[0]
                    print(f"✅ HSN Match found: {matched_item['HSN_CODE']} -> {matched_item['DESCRIPTION']}")
                    return matched_item
            except Exception as e:
                print(f"❌ Query failed: {query} - Error: {e}")
                continue
        
        print(f"❌ No HSN match found for: '{item_name}'")
        return None
    
    @staticmethod
    def get_all_hsn_codes():
        """Get all HSN codes for dropdown"""
        try:
            query = "SELECT HSN_CODE, DESCRIPTION FROM hsn ORDER BY HSN_CODE LIMIT 100"
            result = db.execute_query(query)
            print(f"📊 Found {len(result) if result else 0} HSN codes")
            return result if result else []
        except Exception as e:
            print(f"❌ Error fetching HSN codes: {e}")
            return []
    
    @staticmethod
    def search_hsn_by_name(search_term):
        """Search HSN codes by item name"""
        if not search_term:
            return []
        
        try:
            query = """
                SELECT HSN_CODE, DESCRIPTION 
                FROM hsn 
                WHERE LOWER(DESCRIPTION) LIKE LOWER(%s)
                ORDER BY HSN_CODE
                LIMIT 10
            """
            params = (f"%{search_term}%",)
            result = db.execute_query(query, params)
            return result if result else []
        except Exception as e:
            print(f"❌ Error searching HSN: {e}")
            return []

class Item:
    def __init__(self, data):
        self.id = data.get('id')
        self.code = data.get('code')
        self.name = data.get('name')
        self.description = data.get('description', '')  # ✅ Default to empty string
        self.unit_price = data.get('unit_price')
        self.stock = data.get('stock')
        self.min_stock = data.get('min_stock')
        self.hsn_code = data.get('hsn_code')
        self.is_kit = data.get('is_kit', False)
        self.kit_name = data.get('kit_name', '')  # ✅ Default to empty string
        self.status = data.get('status', 'Active')
        self.created_date = data.get('created_date', datetime.now())
    
    @staticmethod
    def create_tables():
        """Create necessary tables"""
        queries = [
            """
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                unit_price DECIMAL(15,2) NOT NULL,
                stock INT NOT NULL DEFAULT 0,
                min_stock INT NOT NULL DEFAULT 0,
                hsn_code VARCHAR(50),
                is_kit BOOLEAN DEFAULT FALSE,
                kit_name VARCHAR(255),
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_code (code),
                INDEX idx_status (status),
                INDEX idx_kit (is_kit)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS kit_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kit_id INT NOT NULL,
                item_id INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kit_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                INDEX idx_kit_id (kit_id),
                INDEX idx_item_id (item_id)
            )
            """
        ]
        
        for query in queries:
            result = db.execute_query(query)
            if result is None:
                print(f"⚠️ Warning: Table creation query failed")
            else:
                print(f"✅ Table created/verified")
    
    def save(self):
        """Save or update item in database"""
        try:
            # Auto-fill HSN code if not provided
            if not self.hsn_code and self.name:
                print(f"🔍 Attempting to auto-fill HSN for: {self.name}")
                hsn_data = HSN.get_by_item_name(self.name)
                if hsn_data:
                    self.hsn_code = hsn_data['HSN_CODE']
                    print(f"✅ Auto-filled HSN code: {self.hsn_code}")
                else:
                    self.hsn_code = 'DEFAULT_HSN'
                    print(f"⚠️ Using default HSN code")
            
            # Ensure HSN code exists
            if not self.hsn_code:
                self.hsn_code = 'DEFAULT_HSN'
                print(f"⚠️ No HSN code provided, using DEFAULT_HSN")
            
            if self.id:
                # UPDATE existing item
                query = """
                    UPDATE items 
                    SET code=%s, name=%s, description=%s, unit_price=%s, 
                        stock=%s, min_stock=%s, hsn_code=%s, is_kit=%s, 
                        kit_name=%s, status=%s 
                    WHERE id=%s
                """
                params = (
                    self.code, self.name, self.description, self.unit_price, 
                    self.stock, self.min_stock, self.hsn_code, self.is_kit, 
                    self.kit_name, self.status, self.id
                )
                print(f"📝 Updating item {self.id}: {self.code}")
                
            else:
                # INSERT new item
                query = """
                    INSERT INTO items 
                    (code, name, description, unit_price, stock, min_stock, 
                     hsn_code, is_kit, kit_name, status) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                params = (
                    self.code, self.name, self.description, self.unit_price, 
                    self.stock, self.min_stock, self.hsn_code, self.is_kit, 
                    self.kit_name, self.status
                )
                print(f"💾 Inserting new item: {self.code}")
            
            # Execute query
            print(f"🔧 Executing query with params: {params}")
            result = db.execute_query(query, params)
            
            # Handle result
            if result is None:
                print(f"❌ Query returned None - Save failed!")
                return None
            
            if not self.id:
                # For INSERT, result is the new ID
                self.id = result
                print(f"✅ Item saved with new ID: {self.id}")
            else:
                # For UPDATE, result is row count
                print(f"✅ Item {self.id} updated successfully")
            
            return self.id
            
        except Exception as e:
            print(f"💥 Error in Item.save(): {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_all():
        """Get all items"""
        try:
            result = db.execute_query("SELECT * FROM items ORDER BY created_date DESC")
            return result if result else []
        except Exception as e:
            print(f"❌ Error in get_all(): {e}")
            return []
    
    @staticmethod
    def get_by_id(item_id):
        """Get item by ID"""
        try:
            result = db.execute_query("SELECT * FROM items WHERE id = %s", (item_id,))
            return result[0] if result else None
        except Exception as e:
            print(f"❌ Error in get_by_id(): {e}")
            return None
    
    @staticmethod
    def delete(item_id):
        """Delete item by ID"""
        try:
            return db.execute_query("DELETE FROM items WHERE id = %s", (item_id,))
        except Exception as e:
            print(f"❌ Error in delete(): {e}")
            return None
    
    @staticmethod
    def get_kit_names():
        """Get all unique kit names"""
        try:
            result = db.execute_query(
                "SELECT DISTINCT kit_name FROM items WHERE is_kit = TRUE AND kit_name IS NOT NULL AND kit_name != ''"
            )
            return result if result else []
        except Exception as e:
            print(f"❌ Error in get_kit_names(): {e}")
            return []
    
    @staticmethod
    def get_items_with_kit_info():
        """Get all items with kit component information"""
        try:
            query = """
                SELECT 
                    i.*,
                    IF(i.is_kit = TRUE, 
                       (SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'item_id', ki.item_id,
                                'item_name', it.name,
                                'item_code', it.code,
                                'quantity', ki.quantity,
                                'unit_price', it.unit_price
                            )
                        ) 
                        FROM kit_items ki 
                        JOIN items it ON ki.item_id = it.id 
                        WHERE ki.kit_id = i.id),
                       NULL
                    ) as kit_components
                FROM items i
                ORDER BY i.created_date DESC
            """
            result = db.execute_query(query)
            return result if result else []
        except Exception as e:
            print(f"❌ Error in get_items_with_kit_info(): {e}")
            return []

class KitItem:
    def __init__(self, data):
        self.id = data.get('id')
        self.kit_id = data.get('kit_id')
        self.item_id = data.get('item_id')
        self.quantity = data.get('quantity', 1)
    def save(self):
        """Save kit item to database"""
        try:
            query = "INSERT INTO kit_items (kit_id, item_id, quantity) VALUES (%s, %s, %s)"
            params = (self.kit_id, self.item_id, self.quantity)
            print(f"💾 Saving kit item: kit_id={self.kit_id}, item_id={self.item_id}, qty={self.quantity}")
            
            result = db.execute_query(query, params)
            
            if result:
                print(f"✅ Kit item saved with ID: {result}")
                return result
            else:
                print(f"❌ Failed to save kit item")
                return None
                
        except Exception as e:
            print(f"💥 Error in KitItem.save(): {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_kit_items(kit_id):
        """Get all items in a kit"""
        try:
            query = """
                SELECT ki.*, i.name as item_name, i.code as item_code, i.unit_price
                FROM kit_items ki
                JOIN items i ON ki.item_id = i.id
                WHERE ki.kit_id = %s
            """
            result = db.execute_query(query, (kit_id,))
            return result if result else []
        except Exception as e:
            print(f"❌ Error in get_kit_items(): {e}")
            return []
    
    @staticmethod
    def delete_kit_items(kit_id):
        """Delete all kit items for a kit"""
        try:
            print(f"🗑️ Deleting kit items for kit_id: {kit_id}")
            return db.execute_query("DELETE FROM kit_items WHERE kit_id = %s", (kit_id,))
        except Exception as e:
            print(f"❌ Error in delete_kit_items(): {e}")
            return None
    
    @staticmethod
    def get_kit_total_value(kit_id):
        """Calculate total value of a kit"""
        try:
            query = """
                SELECT SUM(ki.quantity * i.unit_price) as total_value
                FROM kit_items ki
                JOIN items i ON ki.item_id = i.id
                WHERE ki.kit_id = %s
            """
            result = db.execute_query(query, (kit_id,))
            return result[0]['total_value'] if result and result[0]['total_value'] else 0
        except Exception as e:
            print(f"❌ Error in get_kit_total_value(): {e}")
            return 0