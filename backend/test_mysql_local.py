# backend/test_mysql_local.py
import pymysql

def test_local_mysql():
    print("🧪 Testing local MySQL connection...")
    
    # Try different common local MySQL configurations
    test_configs = [
        {'user': 'root', 'password': '', 'host': 'localhost'},
        {'user': 'root', 'password': 'root', 'host': 'localhost'},
        {'user': 'root', 'password': 'password', 'host': 'localhost'},
        {'user': 'root', 'password': 'Root@8.0', 'host': 'localhost'},
    ]
    
    for config in test_configs:
        try:
            conn = pymysql.connect(
                host=config['host'],
                user=config['user'],
                password=config['password'],
                connect_timeout=5
            )
            print(f"✅ SUCCESS with: {config['user']} / {config['password']}")
            conn.close()
            return config
        except Exception as e:
            print(f"❌ FAILED with: {config['user']} / {config['password']} - {e}")
    
    return None

if __name__ == '__main__':
    working_config = test_local_mysql()
    if working_config:
        print(f"\n🎯 Use these credentials in your config.py:")
        print(f"MYSQL_USER = '{working_config['user']}'")
        print(f"MYSQL_PASSWORD = '{working_config['password']}'")
    else:
        print("\n💡 No working MySQL configuration found.")
        print("Please check if MySQL is running on your system.")