// config/seed.js - Auto-seed default admin account on startup
const bcrypt = require('bcryptjs');
const pool = require('./db');

const DEFAULT_ADMIN = {
    username: 'admin_mumbai',
    email: 'admin@municipality.com',
    password: 'Admin@123',
    city: 'Mumbai',
    role: 'admin'
};

const DEFAULT_SUPERADMIN = {
    username: 'superadmin',
    email: 'superadmin@municipality.com',
    password: 'Admin@123',
    city: 'Mumbai',
    role: 'superadmin'
};

async function seedAdmin(admin) {
    try {
        const [existing] = await pool.query('SELECT id, password FROM admins WHERE email = ?', [admin.email]);

        if (existing.length === 0) {
            // Admin doesn't exist - create it
            const hashedPassword = await bcrypt.hash(admin.password, 10);
            await pool.query(
                'INSERT INTO admins (username, email, password, city, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
                [admin.username, admin.email, hashedPassword, admin.city, admin.role]
            );
            console.log(`✅ Default ${admin.role} account created: ${admin.email}`);
        } else {
            // Admin exists - verify password hash is valid
            const isValid = await bcrypt.compare(admin.password, existing[0].password);
            if (!isValid) {
                // Hash is invalid/placeholder - fix it
                const hashedPassword = await bcrypt.hash(admin.password, 10);
                await pool.query('UPDATE admins SET password = ?, is_active = 1 WHERE email = ?', [hashedPassword, admin.email]);
                console.log(`🔧 Fixed password hash for ${admin.role}: ${admin.email}`);
            } else {
                console.log(`✅ ${admin.role} account OK: ${admin.email}`);
            }
        }
    } catch (error) {
        console.error(`❌ Failed to seed ${admin.role}:`, error.message);
    }
}

async function seedDefaults() {
    try {
        await seedAdmin(DEFAULT_ADMIN);
        await seedAdmin(DEFAULT_SUPERADMIN);
        console.log('🌱 Database seeding complete');
    } catch (error) {
        console.error('❌ Seeding error:', error.message);
    }
}

module.exports = seedDefaults;
