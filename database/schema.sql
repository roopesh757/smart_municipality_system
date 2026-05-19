-- ============================================
-- Smart Municipality Problem Reporting System
-- Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS municipality_db;
USE municipality_db;

-- ============================================
-- Migration for existing databases:
-- If you already have the users table, run:
--   ALTER TABLE users ADD COLUMN state VARCHAR(100) NOT NULL DEFAULT 'Karnataka' AFTER mobile;
--   ALTER TABLE users ADD COLUMN district VARCHAR(100) NOT NULL DEFAULT '' AFTER state;
--   ALTER TABLE users ADD COLUMN taluk VARCHAR(100) NOT NULL DEFAULT '' AFTER district;
--   ALTER TABLE users ADD COLUMN area VARCHAR(100) NOT NULL DEFAULT '' AFTER taluk;
-- ============================================

-- Users (Citizens) table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    district VARCHAR(100) NOT NULL,
    taluk VARCHAR(100) NOT NULL DEFAULT '',
    area VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    ward VARCHAR(50) NOT NULL,
    role ENUM('citizen') DEFAULT 'citizen',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_city (city),
    INDEX idx_ward (ward),
    INDEX idx_state (state),
    INDEX idx_district (district),
    INDEX idx_taluk (taluk)
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    role ENUM('admin') DEFAULT 'admin',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_city (city)
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    problem_type ENUM(
        'Road damage / potholes',
        'Garbage issues',
        'Drainage/sewage overflow',
        'Street light issues',
        'Public toilet issues',
        'Damaged public property',
        'Blocked drains',
        'Broken footpaths',
        'Fallen trees',
        'Water leakage / pipeline break'
    ) NOT NULL,
    location VARCHAR(255) NOT NULL,
    ward VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    status ENUM('Submitted', 'Pending', 'In Progress', 'Solved', 'Rejected') DEFAULT 'Submitted',
    image_path VARCHAR(500) DEFAULT NULL,
    attempt_count INT DEFAULT 1,
    supporter_count INT DEFAULT 0,
    share_token VARCHAR(64) DEFAULT NULL UNIQUE,
    escalated TINYINT(1) DEFAULT 0,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    admin_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_city (city),
    INDEX idx_ward (ward),
    INDEX idx_problem_type (problem_type),
    INDEX idx_location (location(100)),
    INDEX idx_share_token (share_token),
    INDEX idx_supporter_count (supporter_count)
);

-- Complaint Supporters table (tracks users who joined an existing complaint)
CREATE TABLE IF NOT EXISTS complaint_supporters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_supporter (complaint_id, user_id),
    INDEX idx_complaint_id (complaint_id),
    INDEX idx_user_id (user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    complaint_id INT DEFAULT NULL,
    type ENUM('registration', 'complaint_submitted', 'status_update', 'resolved', 'rejected', 'escalation', 'complaint_joined') NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read)
);

-- ============================================
-- Migration for existing databases:
-- Run the following SQL to migrate from the old duplicate system
-- to the new complaint joining system:
--
--   ALTER TABLE complaints ADD COLUMN supporter_count INT DEFAULT 0 AFTER attempt_count;
--   ALTER TABLE complaints ADD INDEX idx_supporter_count (supporter_count);
--   ALTER TABLE complaints DROP COLUMN is_duplicate;
--   ALTER TABLE complaints DROP COLUMN duplicate_of;
--
--   CREATE TABLE IF NOT EXISTS complaint_supporters (
--       id INT AUTO_INCREMENT PRIMARY KEY,
--       complaint_id INT NOT NULL,
--       user_id INT NOT NULL,
--       joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--       FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
--       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--       UNIQUE KEY unique_supporter (complaint_id, user_id),
--       INDEX idx_complaint_id (complaint_id),
--       INDEX idx_user_id (user_id)
--   );
--
--   ALTER TABLE notifications MODIFY COLUMN type
--       ENUM('registration', 'complaint_submitted', 'status_update',
--            'resolved', 'rejected', 'escalation', 'complaint_joined') NOT NULL;
-- ============================================

-- ============================================
-- Sample Data
-- ============================================

-- Sample Admins (password: Admin@123)
INSERT IGNORE INTO admins (username, email, password, city, role) VALUES
('admin_udupi',     'admin@municipality.com',           '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Udupi',     'admin'),
('admin_mangaluru', 'admin.mangaluru@municipality.com', '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Mangaluru', 'admin'),
('admin_mysuru',    'admin.mysuru@municipality.com',    '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Mysuru',    'admin'),
('admin_bengaluru', 'admin.bengaluru@municipality.com', '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Bengaluru', 'admin');

-- Sample Citizen (password: User@123)
INSERT IGNORE INTO users (username, email, password, mobile, state, district, taluk, area, city, ward) VALUES
('Rahul Sharma', 'rahul@example.com', '$2a$10$gI26xCw5IQF4vGDRTrVvn./1KR2AQsGiIlqQxW3KsygoHOXkN2jiO', '9876543210', 'Karnataka', 'Udupi',     '', 'Manipal',    'Udupi',     'Manipal'),
('Priya Patel',  'priya@example.com', '$2a$10$gI26xCw5IQF4vGDRTrVvn./1KR2AQsGiIlqQxW3KsygoHOXkN2jiO', '9876543211', 'Karnataka', 'Bengaluru', '', 'Whitefield', 'Bengaluru', 'Whitefield');

-- Test credentials:
--   Admins (all use password: Admin@123):
--     Udupi:      admin@municipality.com
--     Mangaluru:  admin.mangaluru@municipality.com
--     Mysuru:     admin.mysuru@municipality.com
--     Bengaluru:  admin.bengaluru@municipality.com
--   Citizens (password: User@123):
--     rahul@example.com  (Udupi / Manipal)
--     priya@example.com  (Bengaluru / Whitefield)

-- ============================================
-- Migration: Profile Management
-- Run these if you already have the tables:
--
--   ALTER TABLE users ADD COLUMN profile_photo VARCHAR(500) DEFAULT NULL;
--   ALTER TABLE admins ADD COLUMN mobile VARCHAR(15) DEFAULT NULL;
--   ALTER TABLE admins ADD COLUMN profile_photo VARCHAR(500) DEFAULT NULL;
-- ============================================

