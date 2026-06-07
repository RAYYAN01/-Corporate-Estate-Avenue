const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dbHelpers = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists (use /tmp on Vercel's read-only filesystem)
const UPLOADS_DIR = process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        console.log('Created uploads directory:', UPLOADS_DIR);
    }
} catch (err) {
    console.error('Could not create uploads directory:', err.message);
}

// Configure Multer for property image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `property-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));
// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

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
            // Clean up any uploaded files if validation fails
            if (req.files) {
                req.files.forEach(file => fs.unlinkSync(file.path));
            }
            return res.status(400).json({ success: false, message: 'All required property fields must be filled.' });
        }

        // Extract filenames
        const imagePaths = req.files ? req.files.map(file => `uploads/${file.filename}`) : [];

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
            images: imagePaths
        });

        res.status(200).json({ success: true, message: 'Your property has been successfully uploaded for review.' });
    } catch (error) {
        console.error('Error saving property upload:', error);
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (e) {
                    console.error('Failed to delete file on error cleanup:', e.message);
                }
            });
        }
        res.status(500).json({ success: false, message: 'An error occurred while uploading your property. Please try again.' });
    }
});

// Admin credentials (standard configuration)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// Simple Authorization Middleware (in a real production app, session/JWT should be used)
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader === 'Bearer cea-token-auth-2026') {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized access.' });
    }
};

// 3. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Return dummy token
        res.json({ success: true, token: 'cea-token-auth-2026' });
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
            // Clean up the actual files on disk
            if (result.images && Array.isArray(result.images)) {
                result.images.forEach(imgRelativePath => {
                    const fullPath = path.join(__dirname, imgRelativePath);
                    if (fs.existsSync(fullPath)) {
                        try {
                            fs.unlinkSync(fullPath);
                            console.log('Deleted image file from disk:', fullPath);
                        } catch (e) {
                            console.error('Failed to delete file:', fullPath, e.message);
                        }
                    }
                });
            }
            res.json({ success: true, message: 'Property deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Property not found.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
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
