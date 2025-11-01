// quotation.controller.js - FIXED PDF DOWNLOAD (Direct Download)
angular.module('mechanicalCoreERP')
.controller('QuotationController', ['$scope', 'QuotationService', 'CustomerService', 'ItemsService', '$timeout', '$interval', function($scope, QuotationService, CustomerService, ItemsService, $timeout, $interval) {
    const vm = this;
    
    // Initialize variables
    vm.quotations = [];
    vm.currentQuotation = {};
    vm.selectedCustomer = {};
    vm.customerSuggestions = [];
    vm.itemSuggestions = [];
    vm.selectedItem = null;
    vm.showForm = false;
    vm.showPreview = false;
    vm.isEditing = false;
    vm.apiOnline = false;
    vm.loading = false;
    
    // Search variables
    vm.customerSearch = '';
    vm.itemSearch = '';
    
    // New item template
    vm.newItem = {
        quantity: 1,
        unit_price: 0,
        discount: 0,
        tax_rate: 18
    };
    
    // New customer template
    vm.newCustomer = {
        name: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        state_code: '',
        status: 'Active'
    };
    
    // Format date for MySQL (YYYY-MM-DD)
    vm.formatDateForMySQL = function(dateString) {
        if (!dateString) return null;
        
        // If already in YYYY-MM-DD format, return as is
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        
        // Convert from mm/dd/yyyy to YYYY-MM-DD
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        
        return dateString;
    };
    
    // Convert YYYY-MM-DD to mm/dd/yyyy for display
    vm.formatDateForDisplay = function(dateString) {
        if (!dateString) return '';
        
        // If already in mm/dd/yyyy format, return as is
        if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return dateString;
        }
        
        // Convert from YYYY-MM-DD to mm/dd/yyyy
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        
        return dateString;
    };
    
    // Download PDF function - FIXED: Direct download without print dialog
    vm.downloadPDF = function(quotation) {
        const quotationToDownload = quotation || vm.currentQuotation;
        
        if (!quotationToDownload.id && !quotationToDownload.quotation_number) {
            alert('Please save the quotation first before downloading PDF');
            return;
        }
        
        console.log('📄 Generating PDF for:', quotationToDownload.quotation_number);
        
        // Show loading state
        const originalText = event?.target?.innerHTML;
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating PDF...';
            event.target.disabled = true;
        }
        
        // Store current state
        const originalShowPreview = vm.showPreview;
        
        // Show preview for PDF generation
        vm.showPreview = true;
        
        // Wait for DOM to update
        $timeout(function() {
            try {
                const element = document.querySelector('.preview-section');
                
                if (!element) {
                    throw new Error('Preview section not found');
                }
                
                // Use html2canvas to capture the element as image
                html2canvas(element, {
                    scale: 2, // Higher quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                }).then(function(canvas) {
                    // Create PDF
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
                    
                    const imgWidth = 190; // A4 width in mm
                    const pageHeight = 280; // A4 height in mm
                    const imgHeight = canvas.height * imgWidth / canvas.width;
                    let heightLeft = imgHeight;
                    
                    let position = 10;
                    
                    // Add first page
                    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                    
                    // Add additional pages if content is too long
                    while (heightLeft >= 0) {
                        position = heightLeft - imgHeight + 10;
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                    
                    // Download the PDF
                    pdf.save(`quotation-${quotationToDownload.quotation_number}.pdf`);
                    
                    // Restore original state
                    vm.showPreview = originalShowPreview;
                    
                    // Restore button state
                    if (event && event.target) {
                        event.target.innerHTML = originalText;
                        event.target.disabled = false;
                    }
                    
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                    
                    console.log('✅ PDF downloaded successfully');
                    
                }).catch(function(error) {
                    console.error('❌ Error in html2canvas:', error);
                    vm.fallbackPDFDownload(quotationToDownload, originalShowPreview, event, originalText);
                });
                
            } catch (error) {
                console.error('❌ Error generating PDF:', error);
                vm.fallbackPDFDownload(quotationToDownload, originalShowPreview, event, originalText);
            }
        }, 1000);
    };
    
    // Fallback PDF download method
    vm.fallbackPDFDownload = function(quotationToDownload, originalShowPreview, event, originalText) {
        console.log('🔄 Using fallback PDF method');
        
        try {
            // Create a simple PDF using text content
            const pdf = new jspdf.jsPDF();
            
            // Add content to PDF
            let yPosition = 20;
            
            // Company Header
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Mechanical Core', 20, yPosition);
            yPosition += 10;
            
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text('ERP System', 20, yPosition);
            yPosition += 20;
            
            // Quotation Header
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('QUOTATION', 20, yPosition);
            yPosition += 10;
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Quotation #: ${quotationToDownload.quotation_number}`, 20, yPosition);
            yPosition += 6;
            pdf.text(`Date: ${quotationToDownload.quotation_date_display || quotationToDownload.quotation_date}`, 20, yPosition);
            yPosition += 15;
            
            // Customer Information
            pdf.setFont('helvetica', 'bold');
            pdf.text('To:', 20, yPosition);
            yPosition += 6;
            
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${vm.selectedCustomer.name || 'Customer'}`, 20, yPosition);
            yPosition += 5;
            
            if (vm.selectedCustomer.address) {
                const addressLines = pdf.splitTextToSize(vm.selectedCustomer.address, 150);
                addressLines.forEach(line => {
                    pdf.text(line, 20, yPosition);
                    yPosition += 5;
                });
            }
            
            if (vm.selectedCustomer.email) {
                pdf.text(`Email: ${vm.selectedCustomer.email}`, 20, yPosition);
                yPosition += 5;
            }
            
            if (vm.selectedCustomer.phone) {
                pdf.text(`Phone: ${vm.selectedCustomer.phone}`, 20, yPosition);
                yPosition += 5;
            }
            
            if (vm.selectedCustomer.gstin) {
                pdf.text(`GSTIN: ${vm.selectedCustomer.gstin}`, 20, yPosition);
                yPosition += 10;
            }
            
            // Items Table Header
            yPosition += 5;
            pdf.setFont('helvetica', 'bold');
            pdf.text('#', 20, yPosition);
            pdf.text('Item Description', 30, yPosition);
            pdf.text('Qty', 120, yPosition);
            pdf.text('Unit Price', 140, yPosition);
            pdf.text('Amount', 170, yPosition);
            yPosition += 6;
            
            // Draw line
            pdf.line(20, yPosition, 190, yPosition);
            yPosition += 5;
            
            // Items
            pdf.setFont('helvetica', 'normal');
            let itemNumber = 1;
            
            quotationToDownload.items.forEach(item => {
                if (yPosition > 250) {
                    pdf.addPage();
                    yPosition = 20;
                }
                
                pdf.text(itemNumber.toString(), 20, yPosition);
                pdf.text(`${item.item_name} (${item.item_code})`, 30, yPosition);
                pdf.text(item.quantity.toString(), 120, yPosition);
                pdf.text(`₹${item.unit_price}`, 140, yPosition);
                pdf.text(`₹${item.total_price}`, 170, yPosition);
                yPosition += 8;
                itemNumber++;
            });
            
            yPosition += 10;
            
            // Totals
            pdf.setFont('helvetica', 'bold');
            pdf.text('Subtotal:', 140, yPosition);
            pdf.text(`₹${quotationToDownload.subtotal}`, 170, yPosition);
            yPosition += 6;
            
            pdf.text('Tax Amount:', 140, yPosition);
            pdf.text(`₹${quotationToDownload.tax_amount}`, 170, yPosition);
            yPosition += 6;
            
            pdf.text('Total Amount:', 140, yPosition);
            pdf.text(`₹${quotationToDownload.total_amount}`, 170, yPosition);
            yPosition += 10;
            
            // Notes
            if (quotationToDownload.notes) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('Notes:', 20, yPosition);
                yPosition += 6;
                
                pdf.setFont('helvetica', 'normal');
                const noteLines = pdf.splitTextToSize(quotationToDownload.notes, 150);
                noteLines.forEach(line => {
                    pdf.text(line, 20, yPosition);
                    yPosition += 5;
                });
            }
            
            // Validity
            if (quotationToDownload.valid_until) {
                yPosition += 5;
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Valid Until: ${quotationToDownload.valid_until_display || quotationToDownload.valid_until}`, 20, yPosition);
            }
            
            // Download PDF
            pdf.save(`quotation-${quotationToDownload.quotation_number}.pdf`);
            
        } catch (fallbackError) {
            console.error('❌ Fallback PDF also failed:', fallbackError);
            alert('Error generating PDF. Please try the print function instead.');
        }
        
        // Restore states
        vm.showPreview = originalShowPreview;
        if (event && event.target) {
            event.target.innerHTML = originalText;
            event.target.disabled = false;
        }
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    
    // Print function (separate from download)
    vm.printPreview = function() {
        window.print();
    };
    
    // Check API health
    vm.checkAPIHealth = function() {
        ItemsService.checkHealth().then(function(response) {
            vm.apiOnline = true;
            console.log('✅ API is online');
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function(error) {
            vm.apiOnline = false;
            console.error('❌ API is offline:', error);
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        });
    };
    
    // Load quotations
    vm.loadQuotations = function() {
        if (!vm.apiOnline) {
            console.warn('⚠️ Cannot load quotations - API is offline');
            vm.loading = false;
            return;
        }
        
        vm.loading = true;
        QuotationService.getAllQuotations().then(function(response) {
            vm.quotations = response.data.quotations || [];
            
            // Format dates for display in loaded quotations
            vm.quotations.forEach(function(quotation) {
                quotation.quotation_date_display = vm.formatDateForDisplay(quotation.quotation_date);
                quotation.valid_until_display = vm.formatDateForDisplay(quotation.valid_until);
            });
            
            vm.loading = false;
            console.log('✅ Loaded', vm.quotations.length, 'quotations');
        }).catch(function(error) {
            console.error('❌ Error loading quotations:', error);
            vm.quotations = [];
            vm.loading = false;
        });
    };
    
    // Show new quotation form
    vm.showNewQuotationModal = function() {
        console.log('➕ Opening New Quotation Form');
        vm.showForm = true;
        vm.isEditing = false;
        
        const today = new Date();
        const validUntil = new Date();
        validUntil.setDate(today.getDate() + 30);
        
        vm.currentQuotation = {
            quotation_number: 'QTN-' + new Date().getFullYear() + '-' + (vm.quotations.length + 1).toString().padStart(3, '0'),
            quotation_date: today.toISOString().split('T')[0],
            quotation_date_display: vm.formatDateForDisplay(today.toISOString().split('T')[0]),
            valid_until: validUntil.toISOString().split('T')[0],
            valid_until_display: vm.formatDateForDisplay(validUntil.toISOString().split('T')[0]),
            customer_id: null,
            subtotal: 0,
            tax_amount: 0,
            total_amount: 0,
            notes: '',
            status: 'Draft',
            items: []
        };
        vm.selectedCustomer = {};
        vm.customerSearch = '';
        
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    
    // Watch for date changes and convert formats
    vm.onDateChange = function() {
        if (vm.currentQuotation.quotation_date_display) {
            vm.currentQuotation.quotation_date = vm.formatDateForMySQL(vm.currentQuotation.quotation_date_display);
        }
        if (vm.currentQuotation.valid_until_display) {
            vm.currentQuotation.valid_until = vm.formatDateForMySQL(vm.currentQuotation.valid_until_display);
        }
    };
    
    // Search customers
    vm.searchCustomers = function() {
        if (vm.customerSearch.length < 2) {
            vm.customerSuggestions = [];
            return;
        }
        
        CustomerService.searchCustomers(vm.customerSearch).then(function(response) {
            vm.customerSuggestions = response.data.customers || [];
            console.log('🔍 Found', vm.customerSuggestions.length, 'customers');
        }).catch(function(error) {
            console.error('❌ Error searching customers:', error);
            vm.customerSuggestions = [];
        });
    };
    
    // Select customer
    vm.selectCustomer = function(customer) {
        vm.selectedCustomer = customer;
        vm.currentQuotation.customer_id = customer.id;
        vm.customerSearch = customer.name;
        vm.customerSuggestions = [];
        console.log('✅ Selected customer:', customer.name);
    };
    
    // Search items
    vm.searchItems = function() {
        if (vm.itemSearch.length < 2) {
            vm.itemSuggestions = [];
            return;
        }
        
        ItemsService.getAllItems().then(function(response) {
            const searchTerm = vm.itemSearch.toLowerCase();
            vm.itemSuggestions = (response.data.items || []).filter(function(item) {
                return item.code.toLowerCase().includes(searchTerm) ||
                       item.name.toLowerCase().includes(searchTerm) ||
                       (item.hsn_code && item.hsn_code.toLowerCase().includes(searchTerm));
            }).slice(0, 10);
            console.log('🔍 Found', vm.itemSuggestions.length, 'items');
        }).catch(function(error) {
            console.error('❌ Error searching items:', error);
            vm.itemSuggestions = [];
        });
    };
    
    // Select item
    vm.selectItem = function(item) {
        vm.selectedItem = item;
        vm.newItem.unit_price = parseFloat(item.unit_price) || 0;
        vm.newItem.item_id = item.id;
        vm.itemSearch = item.code + ' - ' + item.name;
        vm.itemSuggestions = [];
        console.log('✅ Selected item:', item.code, 'Unit Price:', vm.newItem.unit_price);
        
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    
    // Add item to quotation
    vm.addItem = function() {
        if (!vm.selectedItem) {
            alert('Please select an item first');
            return;
        }
        
        const newItem = {
            item_id: vm.selectedItem.id,
            item_code: vm.selectedItem.code,
            item_name: vm.selectedItem.name,
            hsn_code: vm.selectedItem.hsn_code,
            quantity: vm.newItem.quantity || 1,
            unit_price: vm.newItem.unit_price || 0,
            discount: vm.newItem.discount || 0,
            tax_rate: vm.newItem.tax_rate || 18,
            total_price: 0
        };
        
        vm.calculateItemTotal(newItem);
        vm.currentQuotation.items.push(newItem);
        vm.calculateTotals();
        
        // Reset form
        vm.selectedItem = null;
        vm.itemSearch = '';
        vm.newItem = {
            quantity: 1,
            unit_price: 0,
            discount: 0,
            tax_rate: 18
        };
        
        console.log('✅ Added item to quotation');
    };
    
    // Calculate item total
    vm.calculateItemTotal = function(item) {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const discount = parseFloat(item.discount) || 0;
        const taxRate = parseFloat(item.tax_rate) || 0;
        
        const discountedPrice = unitPrice * (1 - discount / 100);
        const taxAmount = discountedPrice * quantity * (taxRate / 100);
        item.total_price = (discountedPrice * quantity) + taxAmount;
        vm.calculateTotals();
    };
    
    // Calculate quotation totals
    vm.calculateTotals = function() {
        vm.currentQuotation.subtotal = vm.currentQuotation.items.reduce(function(sum, item) {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const discount = parseFloat(item.discount) || 0;
            const discountedPrice = unitPrice * (1 - discount / 100);
            return sum + (discountedPrice * quantity);
        }, 0);
        
        vm.currentQuotation.tax_amount = vm.currentQuotation.items.reduce(function(sum, item) {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const discount = parseFloat(item.discount) || 0;
            const taxRate = parseFloat(item.tax_rate) || 0;
            const discountedPrice = unitPrice * (1 - discount / 100);
            return sum + (discountedPrice * quantity * (taxRate / 100));
        }, 0);
        
        vm.currentQuotation.total_amount = vm.currentQuotation.subtotal + vm.currentQuotation.tax_amount;
    };
    
    // Remove item
    vm.removeItem = function(index) {
        vm.currentQuotation.items.splice(index, 1);
        vm.calculateTotals();
        console.log('🗑️ Removed item from quotation');
    };
    
    // Save quotation
    vm.saveQuotation = function() {
        if (!vm.currentQuotation.customer_id) {
            alert('Please select a customer');
            return;
        }
        
        if (vm.currentQuotation.items.length === 0) {
            alert('Please add at least one item');
            return;
        }
        
        const quotationData = {
            quotation_number: vm.currentQuotation.quotation_number,
            quotation_date: vm.formatDateForMySQL(vm.currentQuotation.quotation_date_display || vm.currentQuotation.quotation_date),
            valid_until: vm.formatDateForMySQL(vm.currentQuotation.valid_until_display || vm.currentQuotation.valid_until),
            customer_id: vm.currentQuotation.customer_id,
            subtotal: vm.currentQuotation.subtotal,
            tax_amount: vm.currentQuotation.tax_amount,
            total_amount: vm.currentQuotation.total_amount,
            notes: vm.currentQuotation.notes,
            status: vm.currentQuotation.status,
            items: vm.currentQuotation.items
        };
        
        console.log('💾 Saving quotation with dates:', {
            display: {
                quotation_date: vm.currentQuotation.quotation_date_display,
                valid_until: vm.currentQuotation.valid_until_display
            },
            storage: {
                quotation_date: quotationData.quotation_date,
                valid_until: quotationData.valid_until
            }
        });
        
        const serviceCall = vm.isEditing ? 
            QuotationService.updateQuotation(vm.currentQuotation.id, quotationData) :
            QuotationService.createQuotation(quotationData);
            
        serviceCall.then(function(response) {
            alert('Quotation saved successfully!');
            vm.cancelForm();
            vm.loadQuotations();
        }).catch(function(error) {
            alert('Error saving quotation: ' + (error.data?.message || 'Unknown error'));
        });
    };
    
    // Preview quotation
    vm.previewQuotation = function() {
        if (!vm.currentQuotation.customer_id) {
            alert('Please select a customer');
            return;
        }
        
        if (vm.currentQuotation.items.length === 0) {
            alert('Please add at least one item');
            return;
        }
        
        vm.showPreview = true;
    };
    
    // Hide preview
    vm.hidePreview = function() {
        vm.showPreview = false;
    };
    
    // View quotation
    vm.viewQuotation = function(quotation) {
        QuotationService.getQuotation(quotation.id).then(function(response) {
            vm.currentQuotation = response.data.quotation;
            vm.currentQuotation.quotation_date_display = vm.formatDateForDisplay(vm.currentQuotation.quotation_date);
            vm.currentQuotation.valid_until_display = vm.formatDateForDisplay(vm.currentQuotation.valid_until);
            
            vm.selectedCustomer = {
                name: vm.currentQuotation.customer_name,
                email: vm.currentQuotation.email,
                phone: vm.currentQuotation.phone,
                address: vm.currentQuotation.address,
                gstin: vm.currentQuotation.gstin
            };
            vm.showForm = true;
            vm.isEditing = true;
        }).catch(function(error) {
            alert('Error loading quotation: ' + (error.data?.message || 'Unknown error'));
        });
    };
    
    // Delete quotation
    vm.deleteQuotation = function(quotationId) {
        if (confirm('Are you sure you want to delete this quotation?')) {
            QuotationService.deleteQuotation(quotationId).then(function(response) {
                alert('Quotation deleted successfully!');
                vm.loadQuotations();
            }).catch(function(error) {
                alert('Error deleting quotation: ' + (error.data?.message || 'Unknown error'));
            });
        }
    };
    
    // Cancel form
    vm.cancelForm = function() {
        vm.showForm = false;
        vm.showPreview = false;
        vm.currentQuotation = {};
        vm.selectedCustomer = {};
        vm.customerSearch = '';
        vm.itemSearch = '';
    };
    
    // Show new customer modal
    vm.showNewCustomerModal = function() {
        vm.newCustomer = {
            name: '',
            email: '',
            phone: '',
            address: '',
            gstin: '',
            state_code: '',
            status: 'Active'
        };
        const modal = new bootstrap.Modal(document.getElementById('newCustomerModal'));
        modal.show();
    };
    
    // Save new customer function
    vm.saveNewCustomer = function() {
        console.log('💾 Saving new customer:', vm.newCustomer);
        
        if (!vm.newCustomer.name || vm.newCustomer.name.trim() === '') {
            alert('Please enter customer name');
            return;
        }
        
        const customerData = {
            name: vm.newCustomer.name.trim(),
            email: vm.newCustomer.email || '',
            phone: vm.newCustomer.phone || '',
            address: vm.newCustomer.address || '',
            gstin: vm.newCustomer.gstin || '',
            state_code: vm.newCustomer.state_code || '',
            status: 'Active'
        };
        
        console.log('📤 Sending customer data:', customerData);
        
        CustomerService.createCustomer(customerData).then(function(response) {
            console.log('✅ Customer creation response:', response.data);
            
            if (response.data.success) {
                const createdCustomer = {
                    id: response.data.id || response.data.customer_id,
                    name: customerData.name,
                    email: customerData.email,
                    phone: customerData.phone,
                    address: customerData.address,
                    gstin: customerData.gstin,
                    state_code: customerData.state_code
                };
                
                vm.selectCustomer(createdCustomer);
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('newCustomerModal'));
                if (modal) {
                    modal.hide();
                }
                
                alert('Customer created successfully!');
                
                vm.newCustomer = {
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                    gstin: '',
                    state_code: '',
                    status: 'Active'
                };
            } else {
                alert('Error: ' + (response.data.message || 'Unknown error occurred'));
            }
        }).catch(function(error) {
            console.error('❌ Error creating customer:', error);
            
            let errorMessage = 'Error creating customer';
            
            if (error.data) {
                if (error.data.message) {
                    errorMessage = error.data.message;
                } else if (error.data.error) {
                    errorMessage = error.data.error;
                }
            } else if (error.statusText) {
                errorMessage = error.statusText;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            alert(errorMessage);
        });
    };
    
    // Initialize
    vm.init = function() {
        console.log('🚀 Initializing Quotation Controller...');
        vm.checkAPIHealth();
        
        $timeout(function() {
            vm.loadQuotations();
        }, 500);
    };
    
    // Check API every 5 seconds
    $interval(function() {
        if (!vm.apiOnline) {
            vm.checkAPIHealth();
        }
    }, 5000);
    
    vm.init();
}]);