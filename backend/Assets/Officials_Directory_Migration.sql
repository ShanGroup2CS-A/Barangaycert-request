USE BeSCMS;

CREATE TABLE IF NOT EXISTS council_officials (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    council_type ENUM('barangay', 'sk') NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    office_position VARCHAR(150) NOT NULL,
    contact_number VARCHAR(30) NULL,
    term_start DATE NULL,
    term_end DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_council_officials_type_position (council_type, office_position)
);
