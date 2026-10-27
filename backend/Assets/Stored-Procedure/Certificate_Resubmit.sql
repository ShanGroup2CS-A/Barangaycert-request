USE BeSCMS;
DROP PROCEDURE IF EXISTS Certificate_Resubmit;
DELIMITER $$
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
DELIMITER ;