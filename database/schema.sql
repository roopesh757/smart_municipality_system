-- ============================================
-- Smart Municipality Problem Reporting System
-- Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS municipality_db;
USE municipality_db;

-- Users (Citizens) table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    city VARCHAR(100) NOT NULL,
    ward VARCHAR(50) NOT NULL,
    role ENUM('citizen') DEFAULT 'citizen',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_city (city),
    INDEX idx_ward (ward)
);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    role ENUM('admin', 'superadmin') DEFAULT 'admin',
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
    is_duplicate TINYINT(1) DEFAULT 0,
    duplicate_of INT DEFAULT NULL,
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
    INDEX idx_share_token (share_token)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    complaint_id INT DEFAULT NULL,
    type ENUM('registration', 'complaint_submitted', 'status_update', 'resolved', 'rejected', 'escalation', 'duplicate') NOT NULL,
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
-- Sample Data
-- ============================================

-- Sample Admin (password: Admin@123)
INSERT INTO admins (username, email, password, city, role) VALUES
('admin_mumbai', 'admin@municipality.com', '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Mumbai', 'admin'),
('superadmin', 'superadmin@municipality.com', '$2a$10$0LTwjgJY3bTtjuJh/iB2a.KihUgMLnyJ7yzER.DQd1ffDZBxm7guS', 'Mumbai', 'superadmin');

-- Sample Citizen (password: User@123)
INSERT INTO users (username, email, password, mobile, city, ward) VALUES
('Rahul Sharma', 'rahul@example.com', '$2a$10$gI26xCw5IQF4vGDRTrVvn./1KR2AQsGiIlqQxW3KsygoHOXkN2jiO', '9876543210', 'Mumbai', 'Ward-5'),
('Priya Patel', 'priya@example.com', '$2a$10$gI26xCw5IQF4vGDRTrVvn./1KR2AQsGiIlqQxW3KsygoHOXkN2jiO', '9876543211', 'Mumbai', 'Ward-3');

-- Test credentials:
--   Admin: admin@municipality.com / Admin@123
--   Super Admin: superadmin@municipality.com / Admin@123
--   Citizen: rahul@example.com / User@123
