const db = require('better-sqlite3')('ims-pro.db');
console.log('REVENUE INVOICES:');
console.log(db.prepare('SELECT * FROM revenue_invoices LIMIT 2;').all());
console.log('PURCHASE INVOICES:');
console.log(db.prepare('SELECT * FROM purchase_invoices LIMIT 2;').all());
console.log('WAREHOUS EXPENSES:');
console.log(db.prepare('SELECT * FROM warehouse_expenses LIMIT 2;').all());
