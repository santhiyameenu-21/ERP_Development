// invoice.service.js
angular.module('mechanicalCoreERP')
.factory('InvoiceService', ['$http', '$q', 'ItemsService', function($http, $q, ItemsService) {
    const API_BASE = '/api';
    
    return {
        getAllInvoices: function() {
            return $http.get(API_BASE + '/invoices', { timeout: 5000 });
        },
        
        getInvoice: function(id) {
            return $http.get(API_BASE + '/invoices/' + id, { timeout: 5000 });
        },
        
        // ✅ Updated function to also refresh item stocks after invoice save
        createInvoice: function(invoice) {
            const deferred = $q.defer();
            
            $http.post(API_BASE + '/invoices', invoice, { timeout: 10000 })
                .then(function(response) {
                    // After successful invoice save, update item stocks
                    if (response.status === 200 || response.status === 201) {
                        // Refresh items from backend
                        if (ItemsService && typeof ItemsService.refreshItems === 'function') {
                            ItemsService.refreshItems();
                        }
                    }
                    deferred.resolve(response.data);
                })
                .catch(function(error) {
                    deferred.reject(error);
                });
            
            return deferred.promise;
        },
        
        updateInvoice: function(id, invoice) {
            return $http.put(API_BASE + '/invoices/' + id, invoice, { timeout: 10000 });
        },
        
        deleteInvoice: function(id) {
            return $http.delete(API_BASE + '/invoices/' + id, { timeout: 5000 });
        },
        
        finalizeInvoice: function(id) {
            return $http.post(API_BASE + '/invoices/' + id + '/finalize', {}, { timeout: 5000 });
        },
        
        // Health check
        checkHealth: function() {
            return $http.get(API_BASE + '/health', { timeout: 3000 });
        }
    };
}]);
