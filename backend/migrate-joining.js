// migrate-joining.js — One-time migration from duplicate system to complaint joining system
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    console.log('Connected to database. Running migration...\n');

    const steps = [
        {
            name: 'Add supporter_count column',
            sql: `ALTER TABLE complaints ADD COLUMN supporter_count INT DEFAULT 0 AFTER attempt_count`,
            ignore: 'Duplicate column'
        },
        {
            name: 'Add index on supporter_count',
            sql: `ALTER TABLE complaints ADD INDEX idx_supporter_count (supporter_count)`,
            ignore: 'Duplicate key name'
        },
        {
            name: 'Drop is_duplicate column',
            sql: `ALTER TABLE complaints DROP COLUMN is_duplicate`,
            ignore: "check that column/key exists"
        },
        {
            name: 'Drop duplicate_of column',
            sql: `ALTER TABLE complaints DROP COLUMN duplicate_of`,
            ignore: "check that column/key exists"
        },
        {
            name: 'Create complaint_supporters table',
            sql: `CREATE TABLE IF NOT EXISTS complaint_supporters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                complaint_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_supporter (complaint_id, user_id),
                INDEX idx_complaint_id (complaint_id),
                INDEX idx_user_id (user_id)
            )`,
            ignore: null
        },
        {
            name: 'Update notifications type enum',
            sql: `ALTER TABLE notifications MODIFY COLUMN type
                ENUM('registration', 'complaint_submitted', 'status_update',
                     'resolved', 'rejected', 'escalation', 'complaint_joined') NOT NULL`,
            ignore: null
        }
    ];

    for (const step of steps) {
        try {
            await conn.query(step.sql);
            console.log(`  ✅ ${step.name}`);
        } catch (err) {
            if (step.ignore && err.message.includes(step.ignore)) {
                console.log(`  ⏭️  ${step.name} — already done, skipping`);
            } else {
                console.error(`  ❌ ${step.name} — ${err.message}`);
            }
        }
    }

    console.log('\n✅ Migration complete!');
    await conn.end();
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
