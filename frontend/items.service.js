// items.service.js
angular.module('mechanicalCoreERP')
.factory('ItemsService', ['$http', '$q', function($http, $q) {
    const API_BASE = '/api';
    
    return {
        getAllItems: function() {
            return $http.get(API_BASE + '/items', { timeout: 5000 });
        },
        
        getItem: function(id) {
            return $http.get(API_BASE + '/items/' + id, { timeout: 5000 });
        },
        
        createItem: function(item) {
            return $http.post(API_BASE + '/items', item, { timeout: 10000 });
        },
        
        updateItem: function(id, item) {
            return $http.put(API_BASE + '/items/' + id, item, { timeout: 10000 });
        },
        
        deleteItem: function(id) {
            return $http.delete(API_BASE + '/items/' + id, { timeout: 5000 });
        },
        
        getKitNames: function() {
            return $http.get(API_BASE + '/kit-names', { timeout: 5000 });
        },
        
        getNonKitItems: function() {
            return $http.get(API_BASE + '/non-kit-items', { timeout: 5000 });
        },
        
        getKitComponents: function(kitId) {
            return $http.get(API_BASE + '/kit-components/' + kitId, { timeout: 5000 });
        },
        
        getKitTotalValue: function(kitId) {
            return $http.get(API_BASE + '/kit-total-value/' + kitId, { timeout: 5000 });
        },
        
        // HSN Services
        searchHsn: function(itemName) {
            return $http.get(API_BASE + '/hsn/search?item_name=' + encodeURIComponent(itemName), { timeout: 3000 });
        },
        
        autoFillHsn: function(itemName) {
            return $http.get(API_BASE + '/hsn/auto-fill?item_name=' + encodeURIComponent(itemName), { timeout: 3000 });
        },
        
        getAllHsn: function() {
            return $http.get(API_BASE + '/hsn/all', { timeout: 5000 });
        },
        
        checkHealth: function() {
            return $http.get(API_BASE + '/health', { timeout: 3000 });
        }
    };
}]);