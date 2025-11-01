angular.module('mechanicalCoreERP')
.controller('ItemsController', ['$scope', 'ItemsService', '$interval', '$timeout', function($scope, ItemsService, $interval, $timeout) {
    const vm = this;
    
    // Initialize variables
    vm.items = [];
    vm.currentItem = {};
    vm.modalTitle = '';
    vm.nonKitItems = [];
    vm.existingKitNames = [];
    vm.selectedComponentItem = null;
    vm.selectedKitName = '';
    vm.componentQuantity = 1;
    vm.loading = true;
    vm.saving = false;
    vm.apiOnline = false;
    vm.modal = null;
    vm.searchText = '';
    vm.hsnSearchTimeout = null;
    
    // Check API health
    vm.checkAPIHealth = function() {
        ItemsService.checkHealth().then(function(response) {
            vm.apiOnline = true;
            console.log('✅ API is online');
        }).catch(function(error) {
            vm.apiOnline = false;
            console.error('❌ API is offline:', error);
        });
    };
    
    // Load items from database
    vm.loadItems = function() {
        if (!vm.apiOnline) {
            console.warn('⚠️ Cannot load items - API is offline');
            return;
        }
        
        vm.loading = true;
        console.log('📥 Loading items...');
        
        ItemsService.getAllItems().then(function(response) {
            console.log('✅ Items loaded:', response.data);
            vm.items = response.data.items || [];
            
            // Process kit components
            vm.items.forEach(function(item) {
                if (item.is_kit && item.kit_components) {
                    if (typeof item.kit_components === 'string') {
                        try {
                            item.kit_components = JSON.parse(item.kit_components);
                        } catch (e) {
                            item.kit_components = [];
                        }
                    }
                }
            });
            
            vm.loading = false;
            console.log('📊 Total items:', vm.items.length);
        }).catch(function(error) {
            console.error('❌ Error loading items:', error);
            vm.loading = false;
            vm.items = [];
        });
    };
    
    // HSN auto-fill on item name change
    vm.onItemNameChange = function() {
        const itemName = vm.currentItem.name ? vm.currentItem.name.trim() : '';
        
        if (!itemName || itemName.length < 2) {
            vm.currentItem.hsn_code = '';
            vm.clearHsnError();
            return;
        }
        
        if (vm.hsnSearchTimeout) {
            $timeout.cancel(vm.hsnSearchTimeout);
        }
        
        vm.hsnSearchTimeout = $timeout(function() {
            console.log('🔍 Searching HSN for:', itemName);
            vm.clearHsnError();
            
            ItemsService.autoFillHsn(itemName).then(function(response) {
                if (response.data.success && response.data.hsn_code) {
                    console.log('✅ HSN found:', response.data.hsn_code);
                    vm.currentItem.hsn_code = response.data.hsn_code;
                    vm.showHsnSuccess(response.data.hsn_code, response.data.matched_description);
                } else {
                    console.log('❌ No HSN found');
                    vm.currentItem.hsn_code = '';
                    vm.showHsnWarning(itemName);
                }
            }).catch(function(error) {
                console.error('❌ HSN search error:', error);
                vm.currentItem.hsn_code = '';
                vm.showHsnError();
            });
        }, 800);
    };

    // HSN UI feedback functions
    vm.clearHsnError = function() {
        const hsnField = document.getElementById('hsnCodeField');
        const hsnMessage = document.getElementById('hsnMessage');
        
        if (hsnField) {
            hsnField.classList.remove('is-valid', 'is-invalid');
            hsnField.style.backgroundColor = '#f8f9fa';
        }
        
        if (hsnMessage) {
            hsnMessage.innerHTML = '<i class="fas fa-magic me-1 text-info"></i>Auto-fills from item name, or type manually';
            hsnMessage.className = 'form-text text-info';
        }
    };

    vm.showHsnSuccess = function(hsnCode, description) {
        const hsnField = document.getElementById('hsnCodeField');
        const hsnMessage = document.getElementById('hsnMessage');
        
        if (hsnField) {
            hsnField.classList.add('is-valid');
            hsnField.style.backgroundColor = '#d4edda';
        }
        
        if (hsnMessage) {
            hsnMessage.innerHTML = `<i class="fas fa-check-circle me-1 text-success"></i><strong>Auto-filled:</strong> ${hsnCode} <small>(${description})</small>`;
            hsnMessage.className = 'form-text text-success';
        }
        
        $timeout(function() {
            if (hsnField) {
                hsnField.classList.remove('is-valid');
                hsnField.style.backgroundColor = '#f8f9fa';
            }
        }, 3000);
    };

    vm.showHsnWarning = function(itemName) {
        const hsnMessage = document.getElementById('hsnMessage');
        if (hsnMessage) {
            hsnMessage.innerHTML = `<i class="fas fa-exclamation-triangle me-1 text-warning"></i>No HSN found for "${itemName}"`;
            hsnMessage.className = 'form-text text-warning';
        }
    };

    vm.showHsnError = function() {
        const hsnMessage = document.getElementById('hsnMessage');
        if (hsnMessage) {
            hsnMessage.innerHTML = '<i class="fas fa-times-circle me-1 text-danger"></i>Error searching HSN';
            hsnMessage.className = 'form-text text-danger';
        }
    };
    
    // Load non-kit items
    vm.loadNonKitItems = function() {
        ItemsService.getNonKitItems().then(function(response) {
            vm.nonKitItems = response.data.items || [];
            console.log('✅ Non-kit items loaded:', vm.nonKitItems.length);
        }).catch(function(error) {
            console.error('❌ Error loading non-kit items:', error);
            vm.nonKitItems = [];
        });
    };
    
    // Load kit names
    vm.loadKitNames = function() {
        ItemsService.getKitNames().then(function(response) {
            vm.existingKitNames = response.data.kit_names || [];
            console.log('✅ Kit names loaded:', vm.existingKitNames);
        }).catch(function(error) {
            console.error('❌ Error loading kit names:', error);
            vm.existingKitNames = [];
        });
    };
    
    // Show add modal
    vm.showAddModal = function() {
        console.log('➕ Opening Add modal');
        
        vm.modalTitle = 'Add New Item';
        vm.currentItem = {
            code: '',
            name: '',
            description: '',
            unit_price: 0,
            stock: 0,
            min_stock: 0,
            hsn_code: '',
            is_kit: false,
            kit_name: '',
            status: 'Active',
            kit_items: []
        };
        vm.selectedComponentItem = null;
        vm.selectedKitName = '';
        vm.componentQuantity = 1;
        
        vm.loadNonKitItems();
        vm.loadKitNames();
        
        setTimeout(function() {
            var modalElement = document.getElementById('itemModal');
            if (modalElement) {
                vm.modal = new bootstrap.Modal(modalElement);
                vm.modal.show();
            }
        }, 100);
    };
    
    // CORRECTED editItem function
vm.editItem = function(item) {
    console.log('✏️ EDITING ITEM:', item);
    
    vm.modalTitle = 'Edit Item - ' + item.code;
    
    // Make a proper copy of the item with ALL fields
    vm.currentItem = {
        id: parseInt(item.id),  // 🔥 CRITICAL: Include the ID
        code: item.code || '',
        name: item.name || '',
        description: item.description || '',
        unit_price: parseFloat(item.unit_price) || 0,
        stock: parseInt(item.stock) || 0,
        min_stock: parseInt(item.min_stock) || 0,
        hsn_code: item.hsn_code || '',
        is_kit: Boolean(item.is_kit),
        kit_name: item.kit_name || '',
        status: item.status || 'Active',
        kit_items: []  // Initialize empty array
    };
    
    console.log('🔧 Current Item for editing:', vm.currentItem);
    
    vm.selectedComponentItem = null;
    vm.selectedKitName = '';
    vm.componentQuantity = 1;
    
    // Load kit components if it's a kit
    if (item.is_kit) {
        console.log('🔧 Loading kit components for item ID:', item.id);
        ItemsService.getItem(item.id).then(function(response) {
            const itemData = response.data.item;
            console.log('🔧 Full item data from API:', itemData);
            
            if (itemData.kit_components) {
                let kitComponents = itemData.kit_components;
                if (typeof kitComponents === 'string') {
                    try {
                        kitComponents = JSON.parse(kitComponents);
                    } catch (e) {
                        console.error('❌ Error parsing kit components:', e);
                        kitComponents = [];
                    }
                }
                
                console.log('🔧 Parsed kit components:', kitComponents);
                
                vm.currentItem.kit_items = kitComponents.map(function(comp) {
                    return {
                        item_id: parseInt(comp.item_id),
                        item_code: comp.item_code,
                        item_name: comp.item_name,
                        quantity: parseInt(comp.quantity),
                        unit_price: parseFloat(comp.unit_price)
                    };
                });
                
                console.log('🔧 Final kit items array:', vm.currentItem.kit_items);
            } else {
                console.log('🔧 No kit components found');
                vm.currentItem.kit_items = [];
            }
            
            // Load non-kit items and show modal
            vm.loadNonKitItems();
            vm.loadKitNames();
            vm.showEditModal();
            
        }).catch(function(error) {
            console.error('❌ Error loading kit components:', error);
            vm.currentItem.kit_items = [];
            vm.loadNonKitItems();
            vm.loadKitNames();
            vm.showEditModal();
        });
    } else {
        vm.currentItem.kit_items = [];
        vm.loadNonKitItems();
        vm.loadKitNames();
        vm.showEditModal();
    }
};

// NEW FUNCTION: Show modal for editing
vm.showEditModal = function() {
    setTimeout(function() {
        var modalElement = document.getElementById('itemModal');
        if (modalElement) {
            vm.modal = new bootstrap.Modal(modalElement);
            vm.modal.show();
            
            // Force Angular to update the view
            setTimeout(function() {
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            }, 100);
        }
    }, 100);
};
    // Kit toggle
    vm.onKitToggle = function() {
        if (!vm.currentItem.is_kit) {
            vm.currentItem.kit_name = '';
            vm.currentItem.kit_items = [];
            vm.selectedKitName = '';
        } else {
            vm.loadNonKitItems();
            vm.loadKitNames();
        }
    };
    
    // Kit name selection
    vm.onKitNameSelect = function() {
        if (vm.selectedKitName) {
            vm.currentItem.kit_name = vm.selectedKitName;
        }
    };
    
    // Update your addKitComponent function
vm.addKitComponent = function() {
    console.log('🔧 Adding kit component...');
    
    if (!vm.selectedComponentItem) {
        alert('Please select an item');
        return;
    }
    
    if (!vm.componentQuantity || vm.componentQuantity < 1) {
        alert('Please enter valid quantity (min 1)');
        return;
    }
    
    const selectedItem = vm.nonKitItems.find(function(item) {
        return item.id == vm.selectedComponentItem;
    });
    
    if (selectedItem) {
        console.log('🔧 Selected component:', selectedItem);
        
        // Check if item already exists in kit
        const existingIndex = vm.currentItem.kit_items.findIndex(function(item) {
            return item.item_id == selectedItem.id;
        });
        
        if (existingIndex > -1) {
            // Update quantity if already exists
            vm.currentItem.kit_items[existingIndex].quantity += parseInt(vm.componentQuantity);
            console.log('🔧 Updated existing component quantity');
        } else {
            // Add new component
            vm.currentItem.kit_items.push({
                item_id: parseInt(selectedItem.id),
                item_code: selectedItem.code,
                item_name: selectedItem.name,
                quantity: parseInt(vm.componentQuantity),
                unit_price: parseFloat(selectedItem.unit_price)
            });
            console.log('🔧 Added new component to kit');
        }
        
        // Reset form
        vm.selectedComponentItem = null;
        vm.componentQuantity = 1;
        
        console.log('🔧 Current kit items:', vm.currentItem.kit_items);
    } else {
        alert('Selected item not found!');
    }
};
// Add this function to debug kit creation
vm.debugKitCreation = function() {
    console.log('🐛 DEBUG KIT CREATION');
    console.log('Current Item:', vm.currentItem);
    console.log('Is Kit:', vm.currentItem.is_kit);
    console.log('Kit Name:', vm.currentItem.kit_name);
    console.log('Kit Items:', vm.currentItem.kit_items);
    console.log('Non-Kit Items Available:', vm.nonKitItems);
    
    // Test if we can create a kit manually
    const testKitData = {
        code: 'DEBUG_KIT_' + Date.now(),
        name: 'Debug Test Kit',
        description: 'Testing kit creation',
        unit_price: 150,
        stock: 25,
        min_stock: 5,
        hsn_code: 'DEBUG123',
        is_kit: true,
        kit_name: 'Debug Kit Package',
        status: 'Active',
        kit_items: [
            { item_id: 1, quantity: 2 }, // Using existing item ID 1 (Screw)
            { item_id: 3, quantity: 3 }  // Using existing item ID 3 (Nut)
        ]
    };
    
    console.log('🧪 Test Kit Data:', testKitData);
    
    ItemsService.createItem(testKitData).then(function(response) {
        console.log('✅ Debug Kit Save Response:', response.data);
        if (response.data.success) {
            alert('Debug kit saved! ID: ' + response.data.id);
            vm.loadItems();
        }
    }).catch(function(error) {
        console.error('❌ Debug Kit Save Failed:', error);
    });
};
// CORRECTED saveItem function
vm.saveItem = function() {
    console.log('🟢 SAVE ITEM - KIT VERSION');
    
    if (vm.saving) {
        console.log('⏳ Already saving...');
        return;
    }
    
    // Debug current state
    console.log('🔍 Current Item:', vm.currentItem);
    console.log('🔍 Is Kit:', vm.currentItem.is_kit);
    console.log('🔍 Kit Items:', vm.currentItem.kit_items);
    
    // Validate required fields
    const required = ['code', 'name', 'unit_price', 'stock', 'min_stock'];
    const missing = [];
    
    required.forEach(function(field) {
        const val = vm.currentItem[field];
        if (val === null || val === undefined || val === '' || 
            (typeof val === 'number' && isNaN(val))) {
            missing.push(field);
        }
    });
    
    if (missing.length > 0) {
        alert('Missing required fields: ' + missing.join(', '));
        return;
    }
    
    // Validate HSN code
    if (!vm.currentItem.hsn_code || vm.currentItem.hsn_code.trim() === '') {
        alert('HSN code is required. Please enter an HSN code.');
        return;
    }
    
    // Validate kit if it's a kit
    if (vm.currentItem.is_kit) {
        if (!vm.currentItem.kit_items || vm.currentItem.kit_items.length === 0) {
            alert('Kit must have at least one component!');
            return;
        }
        
        if (!vm.currentItem.kit_name || vm.currentItem.kit_name.trim() === '') {
            alert('Please enter a kit name');
            return;
        }
        
        console.log('🔧 Validating kit with', vm.currentItem.kit_items.length, 'components');
    }
    
    // Prepare API data - FIXED KIT ITEMS STRUCTURE
    const apiData = {
        code: String(vm.currentItem.code).trim(),
        name: String(vm.currentItem.name).trim(),
        description: String(vm.currentItem.description || '').trim(),
        unit_price: parseFloat(vm.currentItem.unit_price) || 0,
        stock: parseInt(vm.currentItem.stock) || 0,
        min_stock: parseInt(vm.currentItem.min_stock) || 0,
        hsn_code: String(vm.currentItem.hsn_code).trim(),
        is_kit: Boolean(vm.currentItem.is_kit),
        kit_name: String(vm.currentItem.kit_name || '').trim(),
        status: String(vm.currentItem.status || 'Active'),
        kit_items: []
    };
    
    // FIX: Add kit items data if it's a kit - CORRECT FORMAT
    if (vm.currentItem.is_kit && vm.currentItem.kit_items && vm.currentItem.kit_items.length > 0) {
        apiData.kit_items = vm.currentItem.kit_items.map(function(item) {
            console.log('🔧 Processing kit component:', item);
            return {
                item_id: parseInt(item.item_id),
                quantity: parseInt(item.quantity) || 1
            };
        });
        console.log('🔧 Sending kit items to backend:', apiData.kit_items);
    } else {
        console.log('🔧 No kit items to send');
    }
    
    console.log('🚀 FINAL API DATA:', apiData);
    
    vm.saving = true;
    
    // Make API call
    const request = vm.currentItem.id 
        ? ItemsService.updateItem(vm.currentItem.id, apiData)
        : ItemsService.createItem(apiData);
    
    request.then(function(response) {
        console.log('✅ BACKEND RESPONSE:', response.data);
        
        if (response.data && response.data.success) {
            const message = vm.currentItem.is_kit 
                ? `Kit saved successfully! ID: ${response.data.id} with ${vm.currentItem.kit_items.length} components`
                : `Item saved successfully! ID: ${response.data.id}`;
                
            alert(message);
            
            // Close modal and reload
            if (vm.modal) {
                vm.modal.hide();
            }
            
            setTimeout(function() {
                vm.loadItems();
                vm.loadKitNames();
            }, 1000);
            
            vm.resetForm();
        } else {
            alert('Error: ' + (response.data.message || 'Unknown error'));
        }
        
    }).catch(function(error) {
        console.error('💥 SAVE ERROR:', error);
        let errorMsg = 'Save failed: ';
        
        if (error.status === 0) {
            errorMsg += 'Cannot connect to backend';
        } else if (error.data && error.data.message) {
            errorMsg += error.data.message;
        } else {
            errorMsg += 'Unknown error';
        }
        
        alert(errorMsg);
    }).finally(function() {
        vm.saving = false;
    });
};
    
    // Delete item
    vm.deleteItem = function(id) {
        if (confirm('Are you sure you want to delete this item?')) {
            console.log('🗑️ Deleting item:', id);
            
            ItemsService.deleteItem(id).then(function(response) {
                if (response.data.success) {
                    alert('Item deleted successfully!');
                    vm.loadItems();
                    vm.loadKitNames();
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            }).catch(function(error) {
                console.error('❌ Delete error:', error);
                alert('Error deleting item');
            });
        }
    };
    
    // Statistics
    vm.getActiveItemsCount = function() {
        if (!vm.items) return 0;
        return vm.items.filter(function(i) { return i.status === 'Active'; }).length;
    };
    
    vm.getKitItemsCount = function() {
        if (!vm.items) return 0;
        return vm.items.filter(function(i) { return i.is_kit; }).length;
    };
    
    vm.getLowStockItemsCount = function() {
        if (!vm.items) return 0;
        return vm.items.filter(function(i) { return i.stock <= i.min_stock; }).length;
    };
    
    vm.calculateKitTotal = function() {
        if (!vm.currentItem.kit_items) return 0;
        return vm.currentItem.kit_items.reduce(function(total, comp) {
            return total + (comp.quantity * comp.unit_price);
        }, 0);
    };
    
    vm.getKitComponentsDisplay = function(item) {
        if (!item.is_kit) return '';
        
        if (item.kit_components && item.kit_components.length > 0) {
            let components = item.kit_components;
            if (typeof components === 'string') {
                try {
                    components = JSON.parse(components);
                } catch (e) {
                    return 'Error loading components';
                }
            }
            return components.map(function(c) {
                return c.item_code + ' (' + c.quantity + ')';
            }).join(', ');
        }
        return 'No components';
    };
    // Add this test function
vm.testSave = function() {
    console.log('🧪 TEST SAVE');
    
    const testData = {
        code: 'WEB_TEST_' + Date.now(),
        name: 'Web Test Item',
        description: 'Testing from web',
        unit_price: 99.99,
        stock: 25,
        min_stock: 5,
        hsn_code: 'TEST789',
        is_kit: false,
        kit_name: '',
        status: 'Active',
        kit_items: []
    };
    
    console.log('🧪 Test data:', testData);
    
    $http.post('http://localhost:5000/api/test-save', testData)
        .then(function(response) {
            console.log('🧪 Test save SUCCESS:', response.data);
            alert('Test save worked! ID: ' + response.data.id);
            vm.loadItems();
        })
        .catch(function(error) {
            console.error('🧪 Test save FAILED:', error);
            alert('Test save failed: ' + error.status);
        });
};
        // Add this function to your controller
    vm.validateHsnCode = function() {
        const hsnField = document.getElementById('hsnCodeField');
        const hsnError = document.getElementById('hsnError');
        
        if (!vm.currentItem.hsn_code || vm.currentItem.hsn_code.trim() === '') {
            if (hsnField) hsnField.classList.add('is-invalid');
            if (hsnError) hsnError.style.display = 'block';
            return false;
        } else {
            if (hsnField) hsnField.classList.remove('is-invalid');
            if (hsnError) hsnError.style.display = 'none';
            return true;
        }
    };
    // Initialize
    vm.init = function() {
        console.log('🚀 Initializing Items Controller...');
        vm.checkAPIHealth();
        
        setTimeout(function() {
            if (vm.apiOnline) {
                vm.loadItems();
            }
        }, 500);
    };
    
    // Check API every 10 seconds
    $interval(function() {
        vm.checkAPIHealth();
        if (vm.apiOnline && vm.items.length === 0 && !vm.loading) {
            vm.loadItems();
        }
    }, 10000);
    
    vm.init();
}]);