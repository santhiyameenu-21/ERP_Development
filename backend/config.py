# backend/config.py - SIMPLE FIXED VERSION
import os
from datetime import timedelta

class Config:
    # Basic Flask config
    SECRET_KEY = os.environ.get('SECRET_KEY', 'mechanical-core-secret-key-2024')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-string')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # Database configuration - SIMPLE AND DIRECT
    CLOUD_SQL_CONNECTION_NAME = "erp-deploy:us-central1:erp-mysql-db"
    MYSQL_USER = "root"
    MYSQL_PASSWORD = "Root@8.0"
    MYSQL_DATABASE = "proj_auth_system"
    
    # Cache config
    CACHE_TYPE = 'simple'
    CACHE_DEFAULT_TIMEOUT = 300