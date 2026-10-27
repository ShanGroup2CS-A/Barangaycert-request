USE BeSCMS;
DROP PROCEDURE IF EXISTS User_UploadID;
DELIMITER $$
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
DELIMITER ;