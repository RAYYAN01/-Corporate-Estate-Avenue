require('dotenv').config({ quiet: true });

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dbHelpers = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase config for Storage (REST API)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = 'property-images';
const STORAGE_URL = supabaseUrl ? `${supabaseUrl}/storage/v1` : null;

// Ensure local uploads directory exists (for local development)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        console.log('Created uploads directory:', UPLOADS_DIR);
    }
} catch (err) {
    console.error('Could not create uploads directory:', err.message);
}

// Configure Multer with memory storage (works on Vercel)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

async function uploadToSupabase(file) {
    if (!STORAGE_URL || !supabaseServiceKey) return null;
    const ext = path.extname(file.originalname);
    const fileName = `property-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    const res = await fetch(`${STORAGE_URL}/object/${STORAGE_BUCKET}/${fileName}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': file.mimetype,
        },
        body: file.buffer,
    });
    if (!res.ok) {
        const text = await res.text();
        console.error('Supabase storage upload error:', res.status, text);
        return null;
    }
    return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));

// 1. Submit Inquiry (Contact Form)
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required.' });
        }
        
        await dbHelpers.saveInquiry({ name, email, phone, service, message });
        res.status(200).json({ success: true, message: 'Your inquiry has been successfully sent!' });
    } catch (error) {
        console.error('Error saving contact inquiry:', error);
        res.status(500).json({ success: false, message: 'An error occurred while saving your inquiry. Please try again.' });
    }
});

// 2. Upload Property Listing (Form Data with Multiple Images)
app.post('/api/upload', upload.array('images', 5), async (req, res) => {
    try {
        const { name, phone, email, 'property-type': type, 'property-name': pName, 'property-location': location, 'property-bhk': bhk, 'property-price': price, 'property-description': description } = req.body;

        if (!name || !phone || !email || !type || !pName || !location || !bhk || !price) {
            return res.status(400).json({ success: false, message: 'All required property fields must be filled.' });
        }

        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            if (supabase) {
                const uploads = req.files.map(f => uploadToSupabase(f));
                imageUrls = (await Promise.all(uploads)).filter(Boolean);
            } else {
                // Fallback: save locally
                for (const file of req.files) {
                    const fileName = `property-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
                    const filePath = path.join(UPLOADS_DIR, fileName);
                    fs.writeFileSync(filePath, file.buffer);
                    imageUrls.push(`/uploads/${fileName}`);
                }
            }
        }

        await dbHelpers.saveProperty({
            name,
            phone,
            email,
            property_type: type,
            property_name: pName,
            property_location: location,
            property_bhk: bhk,
            property_price: price,
            property_description: description || '',
            images: imageUrls
        });

        res.status(200).json({ success: true, message: 'Your property has been successfully uploaded for review.' });
    } catch (error) {
        console.error('Error saving property upload:', error);
        res.status(500).json({ success: false, message: 'An error occurred while uploading your property. Please try again.' });
    }
});

// Admin credentials (loaded from environment variables, see .env.example).
// Strip a leading BOM (﻿) — some tools/editors inject one into env values.
const BOM = String.fromCharCode(0xFEFF);
const stripBOM = (s) => (typeof s === 'string' ? (s.startsWith(BOM) ? s.slice(1) : s).trim() : s);
const ADMIN_USER = stripBOM(process.env.ADMIN_USER) || 'admin';
const ADMIN_PASS = stripBOM(process.env.ADMIN_PASS) || 'admin123';
const ADMIN_TOKEN = stripBOM(process.env.ADMIN_TOKEN) || 'cea-token-auth-2026';

// Simple Authorization Middleware (in a real production app, session/JWT should be used)
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader === `Bearer ${ADMIN_TOKEN}`) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized access.' });
    }
};

// 3. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.json({ success: true, token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});

// 4. Get all Inquiries
app.get('/api/admin/inquiries', authenticateAdmin, async (req, res) => {
    try {
        const inquiries = await dbHelpers.getInquiries();
        res.json({ success: true, data: inquiries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. Get all Properties
app.get('/api/admin/properties', authenticateAdmin, async (req, res) => {
    try {
        const properties = await dbHelpers.getProperties();
        res.json({ success: true, data: properties });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. Delete Inquiry
app.delete('/api/admin/inquiries/:id', authenticateAdmin, async (req, res) => {
    try {
        const changes = await dbHelpers.deleteInquiry(req.params.id);
        if (changes > 0) {
            res.json({ success: true, message: 'Inquiry deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Inquiry not found.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. Delete Property
app.delete('/api/admin/properties/:id', authenticateAdmin, async (req, res) => {
    try {
        const result = await dbHelpers.deleteProperty(req.params.id);
        if (result && result.changes > 0) {
            // Clean up images from Supabase Storage
            if (STORAGE_URL && supabaseServiceKey && result.images && Array.isArray(result.images)) {
                for (const url of result.images) {
                    const fileName = url.split('/').pop();
                    if (fileName) {
                        await fetch(`${STORAGE_URL}/object/${STORAGE_BUCKET}/${fileName}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${supabaseServiceKey}` },
                        });
                    }
                }
            }
            res.json({ success: true, message: 'Property deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Property not found.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Debug health check
app.get('/api/health', async (req, res) => {
    let dbStatus = 'unknown';
    try {
        await dbHelpers.getInquiries();
        dbStatus = 'connected';
    } catch (e) {
        dbStatus = `error: ${e.message}`;
    }
    res.json({ status: 'ok', database: dbStatus });
});

// Fallback: Send main index.html for undefined routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Corporate Estate Avenue Backend running at http://localhost:${PORT}`);
    });
}

module.exports = app;
