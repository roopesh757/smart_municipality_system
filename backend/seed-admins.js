/**
 * Utility script to seed admin accounts for all cities.
 * Run: node seed-admins.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seedAdmins() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'municipality_db',
        port: process.env.DB_PORT || 3306
    });

    const password = 'Admin@123';
    const hash = await bcrypt.hash(password, 10);

    const admins = [
        { username: 'admin_udupi',      email: 'admin@municipality.com',            city: 'Udupi' },
        { username: 'admin_mangaluru',   email: 'admin.mangaluru@municipality.com',  city: 'Mangaluru' },
        { username: 'admin_mysuru',      email: 'admin.mysuru@municipality.com',     city: 'Mysuru' },
        { username: 'admin_bengaluru',   email: 'admin.bengaluru@municipality.com',  city: 'Bengaluru' },
    ];

    // Check existing admins
    const [existing] = await pool.query('SELECT email, city FROM admins');
    console.log('\n--- Existing admins in database ---');
    if (existing.length === 0) {
        console.log('  (none)');
    } else {
        existing.forEach(a => console.log(`  ✅ ${a.email} → ${a.city}`));
    }

    // Insert missing admins
    let inserted = 0;
    for (const admin of admins) {
        const [rows] = await pool.query('SELECT id FROM admins WHERE email = ?', [admin.email]);
        if (rows.length === 0) {
            await pool.query(
                'INSERT INTO admins (username, email, password, city, role) VALUES (?, ?, ?, ?, ?)',
                [admin.username, admin.email, hash, admin.city, 'admin']
            );
            console.log(`  ➕ Inserted: ${admin.email} → ${admin.city}`);
            inserted++;
        }
    }

    if (inserted === 0) {
        console.log('\n✅ All admin accounts already exist.');
    } else {
        console.log(`\n✅ Inserted ${inserted} new admin(s).`);
    }

    // Verify all admins
    const [final] = await pool.query('SELECT email, city FROM admins ORDER BY id');
    console.log('\n--- Final admin list ---');
    final.forEach(a => console.log(`  ✅ ${a.email} → ${a.city}`));
    console.log(`\nAll admins use password: ${password}\n`);

    await pool.end();
}

seedAdmins().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
