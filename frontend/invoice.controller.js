// invoice.controller.js - COMPLETE FIXED VERSION
angular.module('mechanicalCoreERP')
.controller('InvoiceController', ['$scope', 'InvoiceService', 'CustomerService', 'ItemsService', '$timeout', '$interval', function($scope, InvoiceService, CustomerService, ItemsService, $timeout, $interval) {
    const vm = this;
    
    // Initialize variables
    vm.invoices = [];
    vm.currentInvoice = {};
    vm.selectedCustomer = {};
    vm.customerSuggestions = [];
    vm.itemSuggestions = [];
    vm.selectedItem = null;
    vm.showForm = false;
    vm.showPreview = false;
    vm.isEditing = false;
    vm.apiOnline = false;
    vm.loading = false;
    vm.stockWarnings = [];
    
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
    
    // Load invoices
    vm.loadInvoices = function() {
        if (!vm.apiOnline) {
            console.warn('⚠️ Cannot load invoices - API is offline');
            vm.loading = false;
            return;
        }
        
        vm.loading = true;
        InvoiceService.getAllInvoices().then(function(response) {
            vm.invoices = response.data.invoices || [];
            vm.loading = false;
            console.log('✅ Loaded', vm.invoices.length, 'invoices');
        }).catch(function(error) {
            console.error('❌ Error loading invoices:', error);
            vm.invoices = [];
            vm.loading = false;
        });
    };
    
    // Show new invoice form
    vm.showNewInvoiceModal = function() {
        console.log('➕ Opening New Invoice Form');
        vm.showForm = true;
        vm.isEditing = false;
        
        // Format dates properly for database (YYYY-MM-DD)
        const today = new Date();
        const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
        
        vm.currentInvoice = {
            invoice_number: 'INV-' + today.getFullYear() + '-' + (vm.invoices.length + 1).toString().padStart(3, '0'),
            invoice_date: today.toISOString().split('T')[0], // YYYY-MM-DD format
            due_date: dueDate.toISOString().split('T')[0],   // YYYY-MM-DD format
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
        vm.stockWarnings = [];
        
        // Reset new item form
        vm.newItem = {
            quantity: 1,
            unit_price: 0,
            discount: 0,
            tax_rate: 18
        };
        
        // Force Angular to update
        if (!$scope.$$phase) {
            $scope.$apply();
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
        }).catch(function(error) {
            console.error('Error searching customers:', error);
            vm.customerSuggestions = [];
        });
    };
    
    // Select customer
    vm.selectCustomer = function(customer) {
        vm.selectedCustomer = customer;
        vm.currentInvoice.customer_id = customer.id;
        vm.customerSearch = customer.name;
        vm.customerSuggestions = [];
    };
    
    // Search items
    vm.searchItems = function() {
        if (vm.itemSearch.length < 1) {
            vm.itemSuggestions = [];
            return;
        }
        
        ItemsService.getAllItems().then(function(response) {
            const searchTerm = vm.itemSearch.toLowerCase().trim();
            const allItems = response.data.items || [];
            
            vm.itemSuggestions = allItems.filter(function(item) {
                return (item.code && item.code.toLowerCase().includes(searchTerm)) ||
                       (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                       (item.hsn_code && item.hsn_code.toLowerCase().includes(searchTerm));
            }).slice(0, 10);
            
            // Force view update
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function(error) {
            console.error('Error searching items:', error);
            vm.itemSuggestions = [];
        });
    };
    
    // Select item - FIXED: Unit price auto-fill (read-only)
    vm.selectItem = function(item) {
        console.log('Selected item:', item);
        vm.selectedItem = item;
        
        // AUTO-FILL UNIT PRICE (read-only from database)
        vm.newItem.unit_price = parseFloat(item.unit_price) || 0;
        vm.newItem.item_id = item.id;
        vm.itemSearch = item.code + ' - ' + item.name;
        vm.itemSuggestions = [];
        
        console.log('Unit price auto-filled:', vm.newItem.unit_price);
        
        // Force Angular to update the view immediately
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    
    // Add item to invoice
    vm.addItem = function() {
        if (!vm.selectedItem) {
            alert('Please select an item first');
            return;
        }
        
        // Use the unit price from the selected item (read-only from database)
        const unitPriceToUse = parseFloat(vm.selectedItem.unit_price) || 0;
        
        const newItem = {
            item_id: vm.selectedItem.id,
            item_code: vm.selectedItem.code,
            item_name: vm.selectedItem.name,
            hsn_code: vm.selectedItem.hsn_code,
            quantity: vm.newItem.quantity || 1,
            unit_price: unitPriceToUse, // Always use database price
            discount: vm.newItem.discount || 0,
            tax_rate: vm.newItem.tax_rate || 18,
            total_price: 0,
            available_stock: vm.selectedItem.stock || 0
        };
        
        vm.calculateItemTotal(newItem);
        vm.currentInvoice.items.push(newItem);
        vm.calculateTotals();
        vm.checkStock();
        
        // Reset form
        vm.selectedItem = null;
        vm.itemSearch = '';
        vm.newItem = {
            quantity: 1,
            unit_price: 0, // Reset to 0 for next item
            discount: 0,
            tax_rate: 18
        };
        
        // Force view update
        if (!$scope.$$phase) {
            $scope.$apply();
        }
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
    
    // Calculate invoice totals
    vm.calculateTotals = function() {
        vm.currentInvoice.subtotal = vm.currentInvoice.items.reduce(function(sum, item) {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const discount = parseFloat(item.discount) || 0;
            const discountedPrice = unitPrice * (1 - discount / 100);
            return sum + (discountedPrice * quantity);
        }, 0);
        
        vm.currentInvoice.tax_amount = vm.currentInvoice.items.reduce(function(sum, item) {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const discount = parseFloat(item.discount) || 0;
            const taxRate = parseFloat(item.tax_rate) || 0;
            const discountedPrice = unitPrice * (1 - discount / 100);
            return sum + (discountedPrice * quantity * (taxRate / 100));
        }, 0);
        
        vm.currentInvoice.total_amount = vm.currentInvoice.subtotal + vm.currentInvoice.tax_amount;
    };
    
    // Check stock availability
    vm.checkStock = function() {
        vm.stockWarnings = [];
        vm.currentInvoice.items.forEach(function(item) {
            if (item.available_stock < item.quantity) {
                vm.stockWarnings.push({
                    item_code: item.item_code,
                    available_stock: item.available_stock,
                    required_stock: item.quantity
                });
            }
        });
    };
    
    // Remove item
    vm.removeItem = function(index) {
        vm.currentInvoice.items.splice(index, 1);
        vm.calculateTotals();
        vm.checkStock();
    };
    
    // Helper function to format dates for API - FIXED VERSION
vm.formatDateForAPI = function(dateString) {
    console.log('📅 formatDateForAPI input:', dateString, typeof dateString);
    
    if (!dateString) {
        console.log('❌ No date provided');
        return null;
    }
    
    // If it's already a Date object
    if (dateString instanceof Date) {
        console.log('✅ Input is Date object');
        return dateString.toISOString().split('T')[0];
    }
    
    // If it's already in YYYY-MM-DD format, return as is
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.log('✅ Input is already YYYY-MM-DD format');
        return dateString;
    }
    
    // If it's a string with slashes (MM/DD/YYYY)
    if (typeof dateString === 'string' && dateString.includes('/')) {
        console.log('✅ Input is MM/DD/YYYY format');
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
    }
    
    // Try to parse as Date object
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            console.log('✅ Successfully parsed as Date');
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error('❌ Date parsing failed:', e);
    }
    
    console.log('⚠️ Could not format date, returning original:', dateString);
    return dateString;
};
    
    // Download PDF function - FIXED: Direct download without print dialog
    vm.downloadPDF = function(invoice) {
        const invoiceToDownload = invoice || vm.currentInvoice;
        
        if (!invoiceToDownload.id && !invoiceToDownload.invoice_number) {
            alert('Please save the invoice first before downloading PDF');
            return;
        }
        
        console.log('📄 Generating PDF for:', invoiceToDownload.invoice_number);
        
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
                const element = document.getElementById('invoice-preview');
                
                if (!element) {
                    throw new Error('Invoice preview section not found');
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
                    pdf.save(`invoice-${invoiceToDownload.invoice_number}.pdf`);
                    
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
                    vm.fallbackPDFDownload(invoiceToDownload, originalShowPreview, event, originalText);
                });
                
            } catch (error) {
                console.error('❌ Error generating PDF:', error);
                vm.fallbackPDFDownload(invoiceToDownload, originalShowPreview, event, originalText);
            }
        }, 1000);
    };
    // Add this debug function to test stock reduction
vm.debugStockReduction = function() {
    console.log('🧪 DEBUG STOCK REDUCTION TEST');
    
    // Create a simple test invoice
    const testInvoice = {
        invoice_number: 'TEST-STOCK-' + Date.now(),
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customer_id: 1, // Use an existing customer
        subtotal: 100,
        tax_amount: 18,
        total_amount: 118,
        notes: 'Stock reduction test',
        status: 'Finalized', // This should trigger stock reduction
        items: [
            {
                item_id: 1, // Use an existing item ID
                item_name: 'Test Item',
                hsn_code: 'TEST123',
                quantity: 5, // Reduce stock by 5
                unit_price: 20,
                discount: 0,
                tax_rate: 18,
                total_price: 118
            }
        ]
    };
    
    console.log('🧪 Test Invoice Data:', testInvoice);
    
    InvoiceService.createInvoice(testInvoice)
    .then(function(response) {
        console.log('✅ Test Invoice Created:', response.data);
        alert('Test invoice created! Check item stock.');
        
        // Reload items to see updated stock
        setTimeout(function() {
            ItemsService.getAllItems().then(function(itemsResponse) {
                console.log('📦 Updated Items:', itemsResponse.data.items);
                vm.loadInvoices(); // Reload invoices list
            });
        }, 1000);
        
    })
    .catch(function(error) {
        console.error('❌ Test Failed:', error);
        alert('Test failed: ' + error.status);
    });
};
// Add this function to show current stock for items
vm.loadItemStock = function() {
    if (vm.currentInvoice.items && vm.currentInvoice.items.length > 0) {
        vm.currentInvoice.items.forEach(function(invoiceItem) {
            if (invoiceItem.item_id) {
                ItemsService.getItem(invoiceItem.item_id)
                .then(function(response) {
                    if (response.data.item) {
                        invoiceItem.available_stock = response.data.item.stock;
                        console.log(`📦 Stock for ${invoiceItem.item_code}: ${invoiceItem.available_stock}`);
                    }
                })
                .catch(function(error) {
                    console.error('Error loading stock:', error);
                    invoiceItem.available_stock = 0;
                });
            }
        });
    }
};

// Call this when viewing/editing an invoice
vm.viewInvoice = function(invoice) {
    InvoiceService.getInvoice(invoice.id).then(function(response) {
        vm.currentInvoice = response.data.invoice;
        vm.selectedCustomer = {
            name: vm.currentInvoice.customer_name,
            email: vm.currentInvoice.email,
            phone: vm.currentInvoice.phone,
            address: vm.currentInvoice.address,
            gstin: vm.currentInvoice.gstin
        };
        vm.showForm = true;
        vm.isEditing = true;
        
        // Load current stock for each item
        vm.loadItemStock();
        vm.checkStock();
    }).catch(function(error) {
        alert('Error loading invoice: ' + (error.data?.message || 'Unknown error'));
    });
};
    // Fallback PDF download method
    vm.fallbackPDFDownload = function(invoiceToDownload, originalShowPreview, event, originalText) {
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
            
            // Invoice Header
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('TAX INVOICE', 20, yPosition);
            yPosition += 10;
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Invoice #: ${invoiceToDownload.invoice_number}`, 20, yPosition);
            yPosition += 6;
            pdf.text(`Date: ${invoiceToDownload.invoice_date}`, 20, yPosition);
            yPosition += 6;
            pdf.text(`Due Date: ${invoiceToDownload.due_date}`, 20, yPosition);
            yPosition += 15;
            
            // Customer Information
            pdf.setFont('helvetica', 'bold');
            pdf.text('Bill To:', 20, yPosition);
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
            
            invoiceToDownload.items.forEach(item => {
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
            pdf.text(`₹${invoiceToDownload.subtotal}`, 170, yPosition);
            yPosition += 6;
            
            pdf.text('Tax Amount:', 140, yPosition);
            pdf.text(`₹${invoiceToDownload.tax_amount}`, 170, yPosition);
            yPosition += 6;
            
            pdf.text('Total Amount:', 140, yPosition);
            pdf.text(`₹${invoiceToDownload.total_amount}`, 170, yPosition);
            yPosition += 10;
            
            // Notes
            if (invoiceToDownload.notes) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('Notes:', 20, yPosition);
                yPosition += 6;
                
                pdf.setFont('helvetica', 'normal');
                const noteLines = pdf.splitTextToSize(invoiceToDownload.notes, 150);
                noteLines.forEach(line => {
                    pdf.text(line, 20, yPosition);
                    yPosition += 5;
                });
            }
            
            // Download PDF
            pdf.save(`invoice-${invoiceToDownload.invoice_number}.pdf`);
            
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
    
    // Save invoice (Draft)
    vm.saveInvoice = function() {
        if (!vm.currentInvoice.customer_id) {
            alert('Please select a customer');
            return;
        }
        
        if (vm.currentInvoice.items.length === 0) {
            alert('Please add at least one item');
            return;
        }
        
        // Validate and format dates before sending to API
        const invoiceToSave = angular.copy(vm.currentInvoice);
        
        // Ensure dates are in correct format (YYYY-MM-DD)
        if (invoiceToSave.invoice_date) {
            invoiceToSave.invoice_date = vm.formatDateForAPI(invoiceToSave.invoice_date);
        }
        if (invoiceToSave.due_date) {
            invoiceToSave.due_date = vm.formatDateForAPI(invoiceToSave.due_date);
        }
        
        // Ensure status is Draft
        invoiceToSave.status = 'Draft';
        
        console.log('💾 Saving invoice as draft:', invoiceToSave);
        
        const serviceCall = vm.isEditing ? 
            InvoiceService.updateInvoice(invoiceToSave.id, invoiceToSave) :
            InvoiceService.createInvoice(invoiceToSave);
            
        serviceCall.then(function(response) {
            console.log('✅ Invoice saved successfully:', response.data);
            alert('Invoice saved as draft successfully!');
            vm.cancelForm();
            vm.loadInvoices();
        }).catch(function(error) {
            console.error('❌ Error saving invoice:', error);
            alert('Error saving invoice: ' + (error.data?.message || 'Unknown error'));
        });
    };
    
    // Finalize current invoice - FIXED: Proper database saving
vm.finalizeCurrentInvoice = function() {
    if (!vm.currentInvoice.customer_id) {
        alert('Please select a customer');
        return;
    }
    
    if (vm.currentInvoice.items.length === 0) {
        alert('Please add at least one item');
        return;
    }
    
    console.log('💾 Finalizing invoice with data:', vm.currentInvoice);
    
    // Check stock before finalizing
    const outOfStockItems = vm.currentInvoice.items.filter(function(item) {
        return item.available_stock < 1;
    });
    
    const lowStockItems = vm.currentInvoice.items.filter(function(item) {
        return item.available_stock < item.quantity && item.available_stock > 0;
    });
    
    if (outOfStockItems.length > 0) {
        const outOfStockCodes = outOfStockItems.map(function(item) { 
            return item.item_code; 
        }).join(', ');
        alert('Cannot finalize invoice. Some items are out of stock: ' + outOfStockCodes);
        return;
    }
    
    if (lowStockItems.length > 0) {
        const lowStockCodes = lowStockItems.map(function(item) { 
            return `${item.item_code} (Available: ${item.available_stock}, Required: ${item.quantity})`; 
        }).join('\n');
        
        if (!confirm('Some items have low stock:\n' + lowStockCodes + '\n\nContinue anyway?')) {
            return;
        }
    }
    
    // Prepare invoice data for API
    const invoiceToFinalize = {
        invoice_number: vm.currentInvoice.invoice_number,
        invoice_date: vm.formatDateForAPI(vm.currentInvoice.invoice_date),
        due_date: vm.formatDateForAPI(vm.currentInvoice.due_date),
        customer_id: vm.currentInvoice.customer_id,
        subtotal: vm.currentInvoice.subtotal,
        tax_amount: vm.currentInvoice.tax_amount,
        total_amount: vm.currentInvoice.total_amount,
        notes: vm.currentInvoice.notes || '',
        status: 'Finalized', // Set status to Finalized
        items: vm.currentInvoice.items.map(function(item) {
            return {
                item_id: item.item_id,
                item_name: item.item_name, // ✅ CRITICAL: Add item_name
                hsn_code: item.hsn_code,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: item.discount,
                tax_rate: item.tax_rate,
                total_price: item.total_price
            };
        })
    };
    
    console.log('📤 Sending finalized invoice to API:', invoiceToFinalize);
    
    // ✅ FIXED: Use CREATE for new invoices, UPDATE for existing ones
    if (vm.currentInvoice.id) {
        // Update existing invoice to Finalized
        InvoiceService.updateInvoice(vm.currentInvoice.id, invoiceToFinalize).then(function(response) {
            console.log('✅ Invoice finalized successfully:', response.data);
            alert('Invoice finalized successfully! Stock has been updated.');
            vm.currentInvoice.status = 'Finalized';
            vm.cancelForm();
            vm.loadInvoices();
        }).catch(function(error) {
            console.error('❌ Error finalizing invoice:', error);
            alert('Error finalizing invoice: ' + (error.data?.message || 'Unknown error'));
        });
    } else {
        // Create new finalized invoice - THIS WAS MISSING!
        InvoiceService.createInvoice(invoiceToFinalize).then(function(response) {
            console.log('✅ Invoice created and finalized successfully:', response.data);
            alert('Invoice created and finalized successfully! Stock has been updated.');
            vm.cancelForm();
            vm.loadInvoices();
        }).catch(function(error) {
            console.error('❌ Error creating finalized invoice:', error);
            alert('Error creating invoice: ' + (error.data?.message || 'Unknown error'));
        });
    }
};
    
    // Finalize invoice from list
    vm.finalizeInvoice = function(invoiceId) {
        if (confirm('Finalizing this invoice will update stock levels. Continue?')) {
            InvoiceService.finalizeInvoice(invoiceId).then(function(response) {
                alert('Invoice finalized successfully! Stock has been updated.');
                vm.loadInvoices();
            }).catch(function(error) {
                alert('Error finalizing invoice: ' + (error.data?.message || 'Unknown error'));
            });
        }
    };
    
    // Preview invoice
    vm.previewInvoice = function() {
        if (!vm.currentInvoice.customer_id) {
            alert('Please select a customer');
            return;
        }
        
        if (vm.currentInvoice.items.length === 0) {
            alert('Please add at least one item');
            return;
        }
        
        vm.showPreview = true;
    };
    
    // Hide preview
    vm.hidePreview = function() {
        vm.showPreview = false;
    };
    
    // Print preview
    vm.printPreview = function() {
        window.print();
    };
    
    // View invoice
    vm.viewInvoice = function(invoice) {
        InvoiceService.getInvoice(invoice.id).then(function(response) {
            vm.currentInvoice = response.data.invoice;
            vm.selectedCustomer = {
                name: vm.currentInvoice.customer_name,
                email: vm.currentInvoice.email,
                phone: vm.currentInvoice.phone,
                address: vm.currentInvoice.address,
                gstin: vm.currentInvoice.gstin
            };
            vm.showForm = true;
            vm.isEditing = true;
            
            // Set available stock for each item
            vm.currentInvoice.items.forEach(function(item) {
                ItemsService.getItem(item.item_id).then(function(itemResponse) {
                    item.available_stock = itemResponse.data.item.stock;
                }).catch(function(error) {
                    item.available_stock = 0;
                });
            });
            
            vm.checkStock();
        }).catch(function(error) {
            alert('Error loading invoice: ' + (error.data?.message || 'Unknown error'));
        });
    };
    
    // Delete invoice
    vm.deleteInvoice = function(invoiceId) {
        if (confirm('Are you sure you want to delete this invoice?')) {
            InvoiceService.deleteInvoice(invoiceId).then(function(response) {
                alert('Invoice deleted successfully!');
                vm.loadInvoices();
            }).catch(function(error) {
                alert('Error deleting invoice: ' + (error.data?.message || 'Unknown error'));
            });
        }
    };
    
    // Cancel form
    vm.cancelForm = function() {
        vm.showForm = false;
        vm.showPreview = false;
        vm.currentInvoice = {};
        vm.selectedCustomer = {};
        vm.customerSearch = '';
        vm.itemSearch = '';
        vm.stockWarnings = [];
        vm.newItem = {
            quantity: 1,
            unit_price: 0,
            discount: 0,
            tax_rate: 18
        };
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
    
    // Save new customer
    vm.saveNewCustomer = function() {
        if (!vm.newCustomer.name) {
            alert('Please enter customer name');
            return;
        }
        
        CustomerService.createCustomer(vm.newCustomer).then(function(response) {
            alert('Customer created successfully!');
            vm.selectCustomer(response.data.customer);
            const modal = bootstrap.Modal.getInstance(document.getElementById('newCustomerModal'));
            modal.hide();
        }).catch(function(error) {
            alert('Error creating customer: ' + (error.data?.message || 'Unknown error'));
        });
    };
    
    // Initialize
    vm.init = function() {
        console.log('🚀 Initializing Invoice Controller...');
        vm.checkAPIHealth();
        
        // Load invoices after a short delay
        $timeout(function() {
            vm.loadInvoices();
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