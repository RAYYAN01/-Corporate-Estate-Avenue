const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Create inquiries table
        db.run(`
            CREATE TABLE IF NOT EXISTS inquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                service TEXT,
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating inquiries table:', err.message);
        });

        // Create properties table
        db.run(`
            CREATE TABLE IF NOT EXISTS properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                property_type TEXT NOT NULL,
                property_name TEXT NOT NULL,
                property_location TEXT NOT NULL,
                property_bhk TEXT NOT NULL,
                property_price TEXT NOT NULL,
                property_description TEXT,
                images TEXT, -- JSON array of file paths
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating properties table:', err.message);
        });
    });
}

// Database helper functions
const dbHelpers = {
    // Save inquiry
    saveInquiry: (inquiry) => {
        return new Promise((resolve, reject) => {
            const { name, email, phone, service, message } = inquiry;
            const query = `INSERT INTO inquiries (name, email, phone, service, message) VALUES (?, ?, ?, ?, ?)`;
            db.run(query, [name, email, phone, service, message], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    },

    // Get all inquiries (sorted by latest)
    getInquiries: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM inquiries ORDER BY created_at DESC`;
            db.all(query, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    },

    // Delete inquiry
    deleteInquiry: (id) => {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM inquiries WHERE id = ?`;
            db.run(query, [id], function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });
    },

    // Save property listing
    saveProperty: (property) => {
        return new Promise((resolve, reject) => {
            const { name, phone, email, property_type, property_name, property_location, property_bhk, property_price, property_description, images } = property;
            const query = `
                INSERT INTO properties (name, phone, email, property_type, property_name, property_location, property_bhk, property_price, property_description, images)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(
                query,
                [name, phone, email, property_type, property_name, property_location, property_bhk, property_price, property_description, JSON.stringify(images)],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    },

    // Get all properties (sorted by latest)
    getProperties: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM properties ORDER BY created_at DESC`;
            db.all(query, [], (err, rows) => {
                if (err) return reject(err);
                // Parse images JSON string back into array
                const parsedRows = rows.map(row => ({
                    ...row,
                    images: row.images ? JSON.parse(row.images) : []
                }));
                resolve(parsedRows);
            });
        });
    },

    // Delete property listing
    deleteProperty: (id) => {
        return new Promise((resolve, reject) => {
            // First fetch the property to get image paths so they can be cleaned up later if needed
            const getQuery = `SELECT images FROM properties WHERE id = ?`;
            db.get(getQuery, [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(0);

                const deleteQuery = `DELETE FROM properties WHERE id = ?`;
                db.run(deleteQuery, [id], function(deleteErr) {
                    if (deleteErr) return reject(deleteErr);
                    resolve({ changes: this.changes, images: row.images ? JSON.parse(row.images) : [] });
                });
            });
        });
    }
};

module.exports = dbHelpers;
