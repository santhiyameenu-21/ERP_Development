from backend.database import Database

db = Database()

class QuotationInvoiceModels:
    @staticmethod
    def create_tables():
        """Create quotation and invoice related tables"""
        print("📊 Creating quotation and invoice tables...")
        
        queries = [
            # Quotations table
            """
            CREATE TABLE IF NOT EXISTS quotations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quotation_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id INT,
                quotation_date DATE NOT NULL,
                valid_until DATE,
                subtotal DECIMAL(15,2) DEFAULT 0,
                tax_amount DECIMAL(15,2) DEFAULT 0,
                total_amount DECIMAL(15,2) DEFAULT 0,
                notes TEXT,
                status ENUM('Draft', 'Finalized', 'Cancelled') DEFAULT 'Draft',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                INDEX idx_quotation_number (quotation_number),
                INDEX idx_customer_id (customer_id),
                INDEX idx_date (quotation_date)
            )
            """,
            # Quotation items table
            """
            CREATE TABLE IF NOT EXISTS quotation_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quotation_id INT NOT NULL,
                item_id INT,
                item_name VARCHAR(255) NOT NULL,
                hsn_code VARCHAR(50),
                quantity INT NOT NULL DEFAULT 1,
                unit_price DECIMAL(15,2) DEFAULT 0,
                discount DECIMAL(15,2) DEFAULT 0,
                tax_rate DECIMAL(5,2) DEFAULT 0,
                total_price DECIMAL(15,2) DEFAULT 0,
                FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
                INDEX idx_quotation_id (quotation_id)
            )
            """,
            # Invoices table
            """
            CREATE TABLE IF NOT EXISTS invoices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                customer_id INT,
                invoice_date DATE NOT NULL,
                due_date DATE,
                subtotal DECIMAL(15,2) DEFAULT 0,
                tax_amount DECIMAL(15,2) DEFAULT 0,
                total_amount DECIMAL(15,2) DEFAULT 0,
                notes TEXT,
                status ENUM('Draft', 'Finalized', 'Paid', 'Cancelled') DEFAULT 'Draft',
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
                INDEX idx_invoice_number (invoice_number),
                INDEX idx_customer_id (customer_id),
                INDEX idx_date (invoice_date)
            )
            """,
            # Invoice items table
            """
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                item_id INT,
                item_name VARCHAR(255) NOT NULL,
                hsn_code VARCHAR(50),
                quantity INT NOT NULL DEFAULT 1,
                unit_price DECIMAL(15,2) DEFAULT 0,
                discount DECIMAL(15,2) DEFAULT 0,
                tax_rate DECIMAL(5,2) DEFAULT 0,
                total_price DECIMAL(15,2) DEFAULT 0,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL,
                INDEX idx_invoice_id (invoice_id)
            )
            """
        ]
        
        for i, query in enumerate(queries):
            try:
                result = db.execute_query(query)
                if result is None:
                    print(f"⚠️ Warning: Table creation query {i+1} failed")
                else:
                    table_name = query.split('CREATE TABLE IF NOT EXISTS ')[1].split(' (')[0]
                    print(f"✅ Table {table_name} created/verified")
            except Exception as e:
                print(f"❌ Error creating table {i+1}: {e}")