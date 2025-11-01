// quotation.service.js
angular.module('mechanicalCoreERP')
.factory('QuotationService', ['$http', '$q', function($http, $q) {
    const API_BASE = '/api';
    
    return {
        getAllQuotations: function() {
            return $http.get(API_BASE + '/quotations', { timeout: 5000 });
        },
        
        getQuotation: function(id) {
            return $http.get(API_BASE + '/quotations/' + id, { timeout: 5000 });
        },
        
        createQuotation: function(quotation) {
            return $http.post(API_BASE + '/quotations', quotation, { timeout: 10000 });
        },
        
        updateQuotation: function(id, quotation) {
            return $http.put(API_BASE + '/quotations/' + id, quotation, { timeout: 10000 });
        },
        
        deleteQuotation: function(id) {
            return $http.delete(API_BASE + '/quotations/' + id, { timeout: 5000 });
        },
        
        finalizeQuotation: function(id) {
            return $http.post(API_BASE + '/quotations/' + id + '/finalize', {}, { timeout: 5000 });
        },
        
        // Health check
        checkHealth: function() {
            return $http.get(API_BASE + '/health', { timeout: 3000 });
        }
    };
}]);