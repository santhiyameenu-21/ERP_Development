# backend/debug.py - SIMPLIFIED
import logging

# Setup basic logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_imports():
    logger.info("🧪 Testing imports...")
    
    try:
        from flask import Flask
        logger.info("✅ Flask import successful")
    except Exception as e:
        logger.error(f"❌ Flask import failed: {e}")
        return False
        
    try:
        import pymysql
        logger.info("✅ PyMySQL import successful")
    except Exception as e:
        logger.error(f"❌ PyMySQL import failed: {e}")
        return False
        
    try:
        from backend.config import Config
        logger.info("✅ Config import successful")
        # Test if attributes exist
        logger.info(f"📊 Database: {getattr(Config, 'MYSQL_DATABASE', 'NOT FOUND')}")
        logger.info(f"☁️ Cloud SQL: {getattr(Config, 'CLOUD_SQL_CONNECTION_NAME', 'NOT FOUND')}")
        logger.info(f"👤 User: {getattr(Config, 'MYSQL_USER', 'NOT FOUND')}")
    except Exception as e:
        logger.error(f"❌ Config import failed: {e}")
        return False
        
    try:
        from backend.database import Database
        logger.info("✅ Database import successful")
    except Exception as e:
        logger.error(f"❌ Database import failed: {e}")
        return False
        
    return True

def test_database():
    logger.info("🧪 Testing database connection...")
    try:
        from backend.database import Database
        db = Database()
        conn = db.get_connection()
        if conn:
            logger.info("✅ Database connection successful")
            conn.close()
            return True
        else:
            logger.info("❌ Database connection failed (expected on Windows)")
            return False
    except Exception as e:
        logger.error(f"❌ Database test failed: {e}")
        return False

if __name__ == '__main__':
    logger.info("🚀 Starting debug...")
    
    if test_imports():
        logger.info("✅ All imports passed!")
        test_database()
    else:
        logger.error("❌ Some imports failed!")
    
    logger.info("🏁 Debug completed")