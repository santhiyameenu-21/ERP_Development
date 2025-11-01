// customer.service.js - FIXED VERSION
angular.module('mechanicalCoreERP')
.factory('CustomerService', ['$http', '$q', function($http, $q) {
    const API_BASE = '/api';
    
    return {
        // Get all customers
        getAllCustomers: function() {
            return $http.get(API_BASE + '/customers', { timeout: 5000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Error fetching customers:', error);
                    return $q.reject(error);
                });
        },
        
        // Search customers by name
        searchCustomers: function(searchTerm) {
            return $http.get(API_BASE + '/customers/search?name=' + encodeURIComponent(searchTerm), { timeout: 5000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Error searching customers:', error);
                    return $q.reject(error);
                });
        },
        
        // ✅ FIXED: Create new customer with better error handling
        createCustomer: function(customer) {
            console.log('📤 Creating customer:', customer);
            
            return $http({
                method: 'POST',
                url: API_BASE + '/customers',
                data: customer,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(function(response) {
                console.log('✅ Customer creation successful:', response.data);
                return response;
            })
            .catch(function(error) {
                console.error('❌ Customer creation failed:', error);
                
                // Enhanced error information
                let errorInfo = {
                    status: error.status,
                    statusText: error.statusText,
                    data: error.data,
                    message: 'Unknown error occurred'
                };
                
                if (error.data && error.data.message) {
                    errorInfo.message = error.data.message;
                } else if (error.statusText) {
                    errorInfo.message = error.statusText;
                }
                
                return $q.reject(errorInfo);
            });
        },
        
        // Get customer by ID
        getCustomer: function(id) {
            return $http.get(API_BASE + '/customers/' + id, { timeout: 5000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Error fetching customer:', error);
                    return $q.reject(error);
                });
        },
        
        // Update customer
        updateCustomer: function(id, customer) {
            return $http.put(API_BASE + '/customers/' + id, customer, { timeout: 10000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Error updating customer:', error);
                    return $q.reject(error);
                });
        },
        
        // Delete customer
        deleteCustomer: function(id) {
            return $http.delete(API_BASE + '/customers/' + id, { timeout: 5000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Error deleting customer:', error);
                    return $q.reject(error);
                });
        },
        
        // Health check
        checkHealth: function() {
            return $http.get(API_BASE + '/health', { timeout: 3000 })
                .then(function(response) {
                    return response;
                })
                .catch(function(error) {
                    console.error('❌ Health check failed:', error);
                    return $q.reject(error);
                });
        }
    };
}]);