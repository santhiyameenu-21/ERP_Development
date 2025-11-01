from flask_caching import Cache
from backend.config import Config

cache = Cache(config={
    'CACHE_TYPE': Config.CACHE_TYPE,
    'CACHE_DEFAULT_TIMEOUT': Config.CACHE_DEFAULT_TIMEOUT
})

class CacheManager:
    @staticmethod
    def get_items_cache_key():
        return 'all_items'
    
    @staticmethod
    def get_item_cache_key(item_id):
        return f'item_{item_id}'
    
    @staticmethod
    def get_kit_names_cache_key():
        return 'kit_names'
    
    @staticmethod
    def clear_items_cache():
        try:
            cache.delete(CacheManager.get_items_cache_key())
            cache.delete(CacheManager.get_kit_names_cache_key())
        except:
            pass  # Ignore cache errors