// app.js - Mechanical Core ERP AngularJS Module

// Try loading without ui.bootstrap first (it might be causing issues)
try {
    angular.module('mechanicalCoreERP', []);
    console.log('✅ mechanicalCoreERP module created successfully');
} catch (e) {
    console.error('❌ Failed to create module:', e);
}

// Debug: Log when this file loads
console.log('✅ app.js loaded');