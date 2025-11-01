# backend/database.py - SIMPLIFIED
import pymysql
import logging
from backend.config import Config

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.config = {
            'user': Config.MYSQL_USER,
            'password': Config.MYSQL_PASSWORD,
            'database': Config.MYSQL_DATABASE,
            'charset': 'utf8mb4',
            'cursorclass': pymysql.cursors.DictCursor,
            'autocommit': True,
            'connect_timeout': 10
        }
        
    def get_connection(self):
        try:
            # Always try Cloud SQL connection
            self.config['unix_socket'] = f'/cloudsql/{Config.CLOUD_SQL_CONNECTION_NAME}'
            logger.info(f"🔗 Attempting Cloud SQL connection: {Config.CLOUD_SQL_CONNECTION_NAME}")
            
            conn = pymysql.connect(**self.config)
            logger.info("✅ Database connection established successfully")
            return conn
            
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            logger.info("💡 This is expected on Windows. It will work on App Engine.")
            return None

    def __enter__(self):
        self.conn = self.get_connection()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.close()
    def execute_query(self, query, params=None):
        """Execute a query and return results"""
        connection = None
        try:
            connection = self.get_connection()
            if not connection:
                logger.error("No database connection available")
                return None
                
            with connection.cursor() as cursor:
                cursor.execute(query, params or ())
                
                if query.strip().upper().startswith('SELECT'):
                    result = cursor.fetchall()
                else:
                    connection.commit()
                    result = cursor.lastrowid
                    
                logger.info(f"✅ Query executed successfully: {query[:50]}...")
                return result
                
        except pymysql.MySQLError as e:
            logger.error(f"❌ Error executing query: {e}")
            if connection:
                connection.rollback()
            return None
        finally:
            if connection:
                connection.close()
