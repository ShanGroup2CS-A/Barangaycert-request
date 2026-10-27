-- Create database if not exists
CREATE DATABASE IF NOT EXISTS BeSCMS;
USE BeSCMS;

-- Table: residents
CREATE TABLE residents (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    suffix VARCHAR(20),
    photo_path VARCHAR(255),
    birthdate DATE,
    birth_place VARCHAR(255),
    civil_status VARCHAR(40),
    nationality VARCHAR(100) DEFAULT 'Filipino',
    religion VARCHAR(100),
    occupation VARCHAR(150),
    address TEXT,
    contact_number VARCHAR(20),
    gender ENUM('male','female') DEFAULT NULL,
    is_pwd ENUM('yes','no') DEFAULT 'no',
    pwd_id_no VARCHAR(100),
    family_monthly_income DECIMAL(12,2),
    is_indigent ENUM('yes','no') DEFAULT 'no',
    is_solo_parent ENUM('yes','no') DEFAULT 'no',
    solo_parent_id_no VARCHAR(100),
    is_4ps_member ENUM('yes','no') DEFAULT 'no',
    registered_voter ENUM('yes','no') DEFAULT 'no',
    purok_no VARCHAR(50),
    house_no VARCHAR(50),
    street VARCHAR(150),
    emergency_contact_name VARCHAR(255),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_number VARCHAR(20),
    emergency_contact_address TEXT,
    national_id_no VARCHAR(100),
    philhealth_no VARCHAR(100),
    covid_status VARCHAR(50),
    vaccinated ENUM('yes','no') DEFAULT 'no',
    sss_no VARCHAR(100),
    pagibig_no VARCHAR(100),
    tin_no VARCHAR(100),
    voters_id_no VARCHAR(100),
    date_of_registration DATE,
    date_of_death DATE,
    is_alive ENUM('yes','no') DEFAULT 'yes',
    added_by VARCHAR(100),
    last_updated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: barangay and SK officials
CREATE TABLE council_officials (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    council_type ENUM('barangay', 'sk') NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    office_position VARCHAR(150) NOT NULL,
    contact_number VARCHAR(30),
    term_start DATE,
    term_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_council_officials_type_position (council_type, office_position)
);

-- Table: users
CREATE TABLE users (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    resident_id INT(11) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','resident','bhw','purok_leader') DEFAULT 'resident',
    verification_status ENUM('unverified','verifying','verified','rejected') DEFAULT 'unverified',
    verification_doc VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id INT(11) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_tokens_user_expiry (user_id, expires_at),
    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_ip_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_requests_ip_created (request_ip_hash, created_at)
);

-- Table: certificate_requests
CREATE TABLE certificate_requests (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) NOT NULL,
    certificate_type VARCHAR(100) NOT NULL,
    purpose TEXT NOT NULL,
    contact_number VARCHAR(30) NOT NULL,
    quantity INT(11) DEFAULT 1,
    status ENUM('pending','approved','completed','cancelled','rejected') DEFAULT 'pending',
    admin_notes TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Provision the first admin through a trusted process with a unique credential.