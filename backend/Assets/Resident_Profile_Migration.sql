USE BeSCMS;

ALTER TABLE residents
    ADD COLUMN first_name VARCHAR(100) NULL,
    ADD COLUMN middle_name VARCHAR(100) NULL,
    ADD COLUMN last_name VARCHAR(100) NULL,
    ADD COLUMN suffix VARCHAR(20) NULL,
    ADD COLUMN photo_path VARCHAR(255) NULL,
    ADD COLUMN birth_place VARCHAR(255) NULL,
    ADD COLUMN civil_status VARCHAR(40) NULL,
    ADD COLUMN nationality VARCHAR(100) DEFAULT 'Filipino',
    ADD COLUMN religion VARCHAR(100) NULL,
    ADD COLUMN occupation VARCHAR(150) NULL,
    ADD COLUMN is_pwd ENUM('yes','no') DEFAULT 'no',
    ADD COLUMN pwd_id_no VARCHAR(100) NULL,
    ADD COLUMN family_monthly_income DECIMAL(12,2) NULL,
    ADD COLUMN is_indigent ENUM('yes','no') DEFAULT 'no',
    ADD COLUMN is_solo_parent ENUM('yes','no') DEFAULT 'no',
    ADD COLUMN solo_parent_id_no VARCHAR(100) NULL,
    ADD COLUMN is_4ps_member ENUM('yes','no') DEFAULT 'no',
    ADD COLUMN purok_no VARCHAR(50) NULL,
    ADD COLUMN house_no VARCHAR(50) NULL,
    ADD COLUMN street VARCHAR(150) NULL,
    ADD COLUMN emergency_contact_name VARCHAR(255) NULL,
    ADD COLUMN emergency_contact_relationship VARCHAR(100) NULL,
    ADD COLUMN emergency_contact_number VARCHAR(20) NULL,
    ADD COLUMN emergency_contact_address TEXT NULL,
    ADD COLUMN national_id_no VARCHAR(100) NULL,
    ADD COLUMN philhealth_no VARCHAR(100) NULL,
    ADD COLUMN covid_status VARCHAR(50) NULL,
    ADD COLUMN vaccinated ENUM('yes','no') DEFAULT 'no',
    ADD COLUMN sss_no VARCHAR(100) NULL,
    ADD COLUMN pagibig_no VARCHAR(100) NULL,
    ADD COLUMN date_of_registration DATE NULL,
    ADD COLUMN date_of_death DATE NULL,
    ADD COLUMN is_alive ENUM('yes','no') DEFAULT 'yes';

UPDATE residents
SET date_of_registration = DATE(created_at)
WHERE date_of_registration IS NULL;
