USE BeSCMS;
DROP PROCEDURE IF EXISTS User_Verify_Reject;
DELIMITER $$
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