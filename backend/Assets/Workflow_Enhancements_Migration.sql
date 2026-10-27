USE BeSCMS;

ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'resident', 'bhw', 'purok_leader') DEFAULT 'resident';

ALTER TABLE users
    MODIFY COLUMN verification_status ENUM('pending', 'approved', 'rejected', 'unverified', 'verifying', 'verified') DEFAULT 'unverified';

UPDATE users
SET verification_status = CASE
    WHEN verification_status = 'approved' THEN 'verified'
    WHEN verification_status = 'pending' AND verification_doc IS NOT NULL AND verification_doc <> '' THEN 'verifying'
    WHEN verification_status = 'pending' THEN 'unverified'
    ELSE verification_status
END;

ALTER TABLE users
    MODIFY COLUMN verification_status ENUM('unverified', 'verifying', 'verified', 'rejected') DEFAULT 'unverified';

SET @add_request_contact = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE certificate_requests ADD COLUMN contact_number VARCHAR(30) NULL AFTER purpose',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'certificate_requests'
      AND column_name = 'contact_number'
);
PREPARE add_request_contact_statement FROM @add_request_contact;
EXECUTE add_request_contact_statement;
DEALLOCATE PREPARE add_request_contact_statement;

DROP PROCEDURE IF EXISTS Certificate_Submit;
DROP PROCEDURE IF EXISTS Certificate_Cancel;
DROP PROCEDURE IF EXISTS Certificate_Resubmit;
DROP PROCEDURE IF EXISTS User_UploadID;
DROP PROCEDURE IF EXISTS User_Verify_Approve;
DROP PROCEDURE IF EXISTS User_Verify_Reject;

DELIMITER $$

CREATE PROCEDURE Certificate_Submit(
    IN p_user_id INT,
    IN p_certificate_type VARCHAR(100),
    IN p_purpose TEXT,
    IN p_quantity INT,
    IN p_contact_number VARCHAR(30)
)
BEGIN
    DECLARE Record_Status VARCHAR(100);
    INSERT INTO certificate_requests (user_id, certificate_type, purpose, contact_number, quantity, status, requested_at)
    VALUES (p_user_id, p_certificate_type, p_purpose, p_contact_number, p_quantity, 'pending', NOW());
    SET Record_Status = 'Request submitted. Awaiting approval.';
    SELECT Record_Status;
END$$

CREATE PROCEDURE Certificate_Cancel(IN p_user_id INT, IN p_request_id INT)
BEGIN
    DECLARE Record_Status VARCHAR(100);
    IF EXISTS(SELECT 1 FROM certificate_requests WHERE id = p_request_id AND user_id = p_user_id AND status = 'pending') THEN
        UPDATE certificate_requests SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = p_request_id AND user_id = p_user_id;
        SET Record_Status = 'Request cancelled.';
    ELSE
        SET Record_Status = 'Error: Only your pending requests can be cancelled.';
    END IF;
    SELECT Record_Status;
END$$

CREATE PROCEDURE Certificate_Resubmit(IN p_user_id INT, IN p_request_id INT, IN p_new_quantity INT)
BEGIN
    DECLARE Record_Status VARCHAR(100);
    IF p_new_quantity BETWEEN 1 AND 20 AND
       EXISTS(SELECT 1 FROM certificate_requests WHERE id = p_request_id AND user_id = p_user_id AND status IN ('pending','cancelled')) THEN
        UPDATE certificate_requests SET quantity = p_new_quantity, status = 'pending',
               cancelled_at = NULL, requested_at = NOW()
        WHERE id = p_request_id AND user_id = p_user_id;
        SET Record_Status = 'Request resubmitted.';
    ELSE
        SET Record_Status = 'Error: Cannot resubmit; the quantity or request status is invalid.';
    END IF;
    SELECT Record_Status;
END$$

CREATE PROCEDURE User_UploadID(IN p_user_id INT, IN p_filename VARCHAR(255))
BEGIN
    DECLARE Record_Status VARCHAR(100);
    IF EXISTS(SELECT 1 FROM users WHERE id = p_user_id AND role = 'resident' AND verification_status <> 'verified') THEN
        UPDATE users SET verification_doc = p_filename, verification_status = 'verifying'
        WHERE id = p_user_id AND role = 'resident' AND verification_status <> 'verified';
        SET Record_Status = 'Verification request submitted. Please wait for verification approval.';
    ELSE
        SET Record_Status = 'Error: Account is already verified or does not exist.';
    END IF;
    SELECT Record_Status;
END$$

CREATE PROCEDURE User_Verify_Approve(IN p_user_id INT)
BEGIN
    DECLARE Record_Status VARCHAR(100);
    IF EXISTS(SELECT 1 FROM users WHERE id = p_user_id AND verification_status = 'verifying'
              AND verification_doc IS NOT NULL AND verification_doc <> '') THEN
        UPDATE users SET verification_status = 'verified', updated_at = NOW()
        WHERE id = p_user_id AND verification_status = 'verifying'
          AND verification_doc IS NOT NULL AND verification_doc <> '';
        SET Record_Status = 'Account approved.';
    ELSE
        SET Record_Status = 'Error: Verification document not found or account is no longer awaiting review.';
    END IF;
    SELECT Record_Status;
END$$

CREATE PROCEDURE User_Verify_Reject(IN p_user_id INT, IN p_reason TEXT)
BEGIN
    DECLARE Record_Status VARCHAR(100);
    IF EXISTS(SELECT 1 FROM users WHERE id = p_user_id AND verification_status = 'verifying'
              AND verification_doc IS NOT NULL AND verification_doc <> '') THEN
        UPDATE users SET verification_status = 'rejected', verification_doc = NULL, updated_at = NOW()
        WHERE id = p_user_id AND verification_status = 'verifying'
          AND verification_doc IS NOT NULL AND verification_doc <> '';
        SET Record_Status = CONCAT('Verification rejected. Reason: ', IFNULL(p_reason, 'Not provided.'));
    ELSE
        SET Record_Status = 'Error: Verification request not found or account is no longer awaiting review.';
    END IF;
    SELECT Record_Status;
END$$

DELIMITER ;
