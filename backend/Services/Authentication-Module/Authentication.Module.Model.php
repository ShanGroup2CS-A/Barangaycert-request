<?php
// Include database helper to run SQL queries safely
require_once __DIR__ . '/../../Libraries/PdoMySql.Coderstation.php';
// Include data conversion helper (probably converts objects/results to arrays)
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';
// Include session management helper (store/retrieve user data across pages)
require_once __DIR__ . '/../../Libraries/Session.Coderstation.php';
// Include file upload helper (handles saving uploaded files to server)
require_once __DIR__ . '/../../Libraries/Upload.Handler.Coderstation.php';

// This class manages user authentication: signup, login, profile, password, etc.
class Authentication_Module_Model
{
    // Public method: create a new user account
    public static function signup($param)
    {
        if (!is_array($param) || empty($param['full_name']) || empty($param['email']) ||
            empty($param['password']) || strlen((string)$param['password']) < 6) {
            return array("Status" => "Error", "Message" => "Enter your registered resident name, a valid email, and a password with at least 6 characters.");
        }
        $param['password'] = password_hash((string)$param['password'], PASSWORD_DEFAULT);
        // Call stored procedure 'User_Signup' with parameters from $param
        // The three '?' placeholders will be filled with values from $param (converted to array)
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,                 // database connection
            "CALL User_Signup(?,?,?)",           // SQL command (e.g., email, password, name)
            Data_Coversion::toArray($param)      // convert input to array for safety
        );
        // Convert database response (maybe a result set) into a PHP array
        $Response = Data_Coversion::toArray($Response);
        if (isset($Response[0]) && is_string($Response[0]) && strpos($Response[0], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Response[0]);
        }

        // Get the status message from the first row, or use default message
        $Message = $Response[0]["Record_Status"] ?? "Account created.";
        if (strpos($Message, 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Message);
        }

        // Remove the "Record_Status" from the data array so it's not returned twice
        unset($Response[0]["Record_Status"]);
        // Return success response with message and any extra data (e.g., user ID)
        return array("Status" => "Success", "Message" => $Message, "Data" => $Response);
    }

    // Public method: log an existing user in
    public static function login($param)
    {
        $email = trim((string)($param['email'] ?? ''));
        $password = (string)($param['password'] ?? '');
        if ($email === '' || $password === '') {
            return array("Status" => "Error", "Message" => "Enter your email and password.");
        }

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT id AS user_id, role, verification_status, password
             FROM users WHERE email = ? LIMIT 1",
            array($email)
        );
        $Response = Data_Coversion::toArray($Response);
        if (isset($Response[0]) && is_string($Response[0]) && strpos($Response[0], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Response[0]);
        }
        $user = $Response[0] ?? null;
        if (isset($user['Status']) && strpos((string)$user['Status'], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $user['Status']);
        }
        if (!$user || !isset($user['password'], $user['user_id'])) {
            return array("Status" => "Error", "Message" => "Invalid email or password.");
        } else {
            $storedPassword = (string)$user['password'];
            $passwordMatches = password_verify($password, $storedPassword);
            if (!$passwordMatches && hash_equals($storedPassword, $password)) {
                $passwordMatches = true;
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $updated = PdoMySql::ExecuteDML_NonQuery(
                    Application::$DBase,
                    "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
                    array($hashedPassword, $user['user_id'])
                );
                if (!is_int($updated)) {
                    $error = json_decode((string)$updated, true);
                    return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to secure account password.");
                }
            }
            if (!$passwordMatches) {
                return array("Status" => "Error", "Message" => "Invalid email or password.");
            }
        }

        $verificationStatus = $user['verification_status'];
        if (in_array($verificationStatus, array('approved', 'verified'), true)) {
            $verificationStatus = 'approved';
        } elseif (in_array($verificationStatus, array('pending', 'verifying'), true)) {
            $verificationStatus = 'verifying';
        }
        Session::set('user_id', $user['user_id']);
        Session::set('role', $user['role']);
        Session::set('verification_status', $verificationStatus);
        return array("Status" => "Success", "Message" => "Login successful", "Data" => array(
            'user_id' => $user['user_id'],
            'role' => $user['role'],
            'verification_status' => $verificationStatus
        ));
    }

    // Public method: upload an identification document (ID) for verification
    public static function uploadID($post, $files)
    {
        // Get logged-in user's ID from session (set during login)
        $user_id = Session::get('user_id');
        // If no user is logged in, return error
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        // Check if a file was uploaded under the field name 'verification_doc'
        if (!isset($files['verification_doc'])) {
            return array("Status" => "Error", "Message" => "No file uploaded.");
        }
        // Use Upload_Handler to save the file to the 'uploads/' folder on the server
        $uploadResult = Upload_Handler::save($files['verification_doc'], __DIR__ . '/../../uploads/');
        // If upload failed (e.g., file too large, wrong type), return the error
        if (!$uploadResult['success']) {
            return array("Status" => "Error", "Message" => $uploadResult['error']);
        }
        // Call stored procedure 'User_UploadID' to store the filename in the database
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL User_UploadID(?,?)",
            array($user_id, $uploadResult['filename'])   // user ID and saved filename
        );
        $Response = Data_Coversion::toArray($Response);
        $Message = $Response[0]["Record_Status"] ?? $Response[0]["Status"] ?? "ID uploaded.";
        if (is_string($Message) && strpos($Message, 'Error:') === 0) {
            $uploadedPath = __DIR__ . '/../../uploads/' . $uploadResult['filename'];
            if (is_file($uploadedPath)) {
                unlink($uploadedPath);
            }
            return array("Status" => "Error", "Message" => $Message);
        }
        return array("Status" => "Success", "Message" => $Message);
    }

    // Private helper: checks if current user is admin or BHW (Barangay Health Worker)
    private static function isAdminOrBhw()
    {
        $role = Session::get('role');   // Get role from session
        // Return true if role is 'admin' or 'bhw', otherwise false
        return in_array($role, ['admin', 'bhw'], true);
    }

    private static function requireAdmin()
    {
        if (Session::get('role') !== 'admin') {
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin can manage staff access.");
        }
        return null;
    }

    // Private helper: stops execution if user is not admin/BHW
    private static function requireAdminOrBhw()
    {
        if (!self::isAdminOrBhw()) {
            // Return an error array (the caller will return this as the response)
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin or BHW can access this function.");
        }
        // If authorized, return null (meaning "all good")
        return null;
    }

    // Public method: admin/BHW approves a user's ID verification
    public static function approveVerification($param)
    {
        // Check authorization (only admin/BHW can approve)
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;   // If not authorized, return the error

        // Call stored procedure 'User_Verify_Approve' with one parameter (e.g., user_id or request_id)
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL User_Verify_Approve(?)",
            Data_Coversion::toArray($param)
        );
        $Response = Data_Coversion::toArray($Response);
        $Message = $Response[0]["Record_Status"] ?? "Approved";
        if (strpos((string)$Message, 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Message);
        }
        return array("Status" => "Success", "Message" => $Message);
    }

    // Public method: admin/BHW rejects a user's ID verification (optionally with a reason)
    public static function rejectVerification($param)
    {
        // Authorization check again
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;

        // Call stored procedure 'User_Verify_Reject' (expects user_id and maybe reason)
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL User_Verify_Reject(?,?)",
            Data_Coversion::toArray($param)
        );
        $Response = Data_Coversion::toArray($Response);
        $Message = $Response[0]["Record_Status"] ?? "Rejected";
        if (strpos((string)$Message, 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Message);
        }
        return array("Status" => "Success", "Message" => $Message);
    }

    public static function pendingVerifications()
    {
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT u.id, u.email, u.verification_status, u.verification_doc, u.created_at,
                    r.full_name, r.first_name, r.middle_name, r.last_name, r.suffix,
                    r.photo_path, r.address, r.contact_number
             FROM users u
             JOIN residents r ON u.resident_id = r.id
             WHERE u.verification_status IN ('pending', 'verifying')
               AND u.verification_doc IS NOT NULL
               AND u.verification_doc <> ''
             ORDER BY u.created_at ASC"
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }

    public static function verificationDocument($param)
    {
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;

        $userId = $param['user_id'] ?? null;
        if (!$userId) {
            return array("Status" => "Error", "Message" => "A user ID is required.");
        }

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT verification_doc FROM users WHERE id = ?",
            array($userId)
        );
        $Response = Data_Coversion::toArray($Response);
        if (isset($Response[0]['Status']) && strpos($Response[0]['Status'], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $Response[0]['Status']);
        }

        $filename = $Response[0]['verification_doc'] ?? '';
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $contentTypes = array(
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'pdf' => 'application/pdf'
        );
        if ($filename === '' || basename($filename) !== $filename || !isset($contentTypes[$extension])) {
            return array("Status" => "Error", "Message" => "Verification document not found.");
        }

        $uploadDirectory = realpath(__DIR__ . '/../../uploads');
        $path = realpath(__DIR__ . '/../../uploads/' . $filename);
        if ($uploadDirectory === false || $path === false || !is_file($path) ||
            strpos($path, $uploadDirectory . DIRECTORY_SEPARATOR) !== 0) {
            return array("Status" => "Error", "Message" => "Verification document not found.");
        }

        return array(
            "Status" => "Success",
            "Path" => $path,
            "ContentType" => $contentTypes[$extension],
            "DownloadName" => 'verification-document.' . $extension
        );
    }

    public static function accounts()
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT u.id, u.email, u.role,
                    CASE WHEN u.verification_status IN ('pending', 'verifying') AND u.verification_doc IS NOT NULL AND u.verification_doc <> ''
                         THEN 'verifying'
                         WHEN u.verification_status IN ('pending', 'unverified') THEN 'unverified'
                         ELSE u.verification_status END AS verification_status,
                    r.full_name
             FROM users u
             JOIN residents r ON u.resident_id = r.id
             ORDER BY r.full_name ASC"
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }

    public static function updateAccountRole($param)
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;

        $userId = $param['user_id'] ?? null;
        $role = $param['role'] ?? '';
        if (!$userId || !in_array($role, ['resident', 'bhw', 'purok_leader'], true)) {
            return array("Status" => "Error", "Message" => "A valid user ID and resident, BHW, or Purok leader role are required.");
        }

        $updated = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "UPDATE users SET role = ?, updated_at = NOW() WHERE id = ? AND role IN ('resident', 'bhw', 'purok_leader')",
            array($role, $userId)
        );
        if (!is_int($updated)) {
            $error = json_decode((string)$updated, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to update account role.");
        }
        if ($updated === 0) {
            $existing = PdoMySql::ExecuteDML_Query(
                Application::$DBase,
                "SELECT id FROM users WHERE id = ? AND role = ? AND role IN ('resident', 'bhw', 'purok_leader')",
                array($userId, $role)
            );
            $existingRows = Data_Coversion::toArray($existing);
            if (isset($existingRows[0]['Status']) && strpos($existingRows[0]['Status'], 'Error:') === 0) {
                return array("Status" => "Error", "Message" => $existingRows[0]['Status']);
            }
            if (!empty($existingRows)) {
                return array("Status" => "Success", "Message" => "Account already has this access role.");
            }
            return array("Status" => "Error", "Message" => "Account not found or role was not changed.");
        }
        $messages = array(
            'resident' => "Resident access restored.",
            'bhw' => "BHW access assigned.",
            'purok_leader' => "Purok leader access assigned."
        );
        return array("Status" => "Success", "Message" => $messages[$role]);
    }

    // Public method: get the logged-in user's profile (including resident details)
    public static function getProfile()
    {
        // Get user ID from session
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        // Select user data joined with resident table (full_name, address, etc.)
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT u.id, u.email, u.role,
                    CASE WHEN u.verification_status IN ('pending', 'verifying') AND u.verification_doc IS NOT NULL AND u.verification_doc <> ''
                         THEN 'verifying'
                         WHEN u.verification_status IN ('pending', 'unverified') THEN 'unverified'
                         ELSE u.verification_status END AS verification_status,
                    u.created_at,
                    r.full_name, r.first_name, r.middle_name, r.last_name, r.suffix,
                    r.photo_path, r.address, r.contact_number, r.birthdate, r.gender
             FROM users u JOIN residents r ON u.resident_id = r.id WHERE u.id = ?",
            array($user_id)
        );
        $Response = Data_Coversion::toArray($Response);
        // Return the profile data
        return array("Status" => "Success", "Data" => $Response);
    }

    // Public method: change the logged-in user's password
    public static function changePassword($param)
    {
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        $oldPassword = (string)($param['old_password'] ?? '');
        $newPassword = (string)($param['new_password'] ?? '');
        if ($oldPassword === '' || strlen($newPassword) < 6) {
            return array("Status" => "Error", "Message" => "Enter your current password and a new password with at least 6 characters.");
        }
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT password FROM users WHERE id = ?",
            array($user_id)
        );
        $user = Data_Coversion::toArray($Response);

        $currentPassword = (string)($user[0]['password'] ?? '');
        $passwordMatches = $currentPassword !== '' &&
            (password_verify($oldPassword, $currentPassword) || hash_equals($currentPassword, $oldPassword));
        if (!$passwordMatches) {
            return array("Status" => "Error", "Message" => "Old password is incorrect.");
        }
        $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);

        $Response = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
            array($newPasswordHash, $user_id)
        );
        if (!is_int($Response)) {
            $error = json_decode((string)$Response, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to update password.");
        }
        return array("Status" => "Success", "Message" => "Password changed.");
    }

    public static function requestPasswordReset($param)
    {
        $email = trim((string)($param['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return array("Status" => "Error", "Message" => "Enter a valid email address.");
        }

        $ipAddress = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $ipHash = hash('sha256', $ipAddress);
        $expiredAttempts = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "DELETE FROM password_reset_requests WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
        if (!is_int($expiredAttempts)) {
            $error = json_decode((string)$expiredAttempts, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to process the password reset request.");
        }
        $attempts = Data_Coversion::toArray(PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT COUNT(*) AS attempt_count FROM password_reset_requests
             WHERE request_ip_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)",
            array($ipHash)
        ));
        if (isset($attempts[0]) && is_string($attempts[0]) && strpos($attempts[0], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $attempts[0]);
        }
        if ((int)($attempts[0]['attempt_count'] ?? 0) >= 5) {
            return array("Status" => "Error", "Message" => "Too many reset requests. Please try again in 15 minutes.");
        }

        $loggedAttempt = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "INSERT INTO password_reset_requests (request_ip_hash, created_at) VALUES (?, NOW())",
            array($ipHash)
        );
        if (!is_int($loggedAttempt)) {
            $error = json_decode((string)$loggedAttempt, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to process the password reset request.");
        }

        $users = Data_Coversion::toArray(PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT id, email FROM users WHERE email = ? LIMIT 1",
            array($email)
        ));
        if (isset($users[0]) && is_string($users[0]) && strpos($users[0], 'Error:') === 0) {
            return array("Status" => "Error", "Message" => $users[0]);
        }
        $user = $users[0] ?? null;
        if (!$user || empty($user['id'])) {
            return array("Status" => "Success", "Message" => "If that email is registered, a password reset link has been sent.");
        }

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $invalidated = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
            array($user['id'])
        );
        if (!is_int($invalidated)) {
            $error = json_decode((string)$invalidated, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to prepare the password reset.");
        }

        $stored = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), NOW())",
            array($user['id'], $tokenHash)
        );
        if (!is_int($stored)) {
            $error = json_decode((string)$stored, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to prepare the password reset.");
        }

        $frontendUrl = rtrim((string)Application::$FrontendUrl, '/') . '/';
        $resetUrl = $frontendUrl . '?reset_token=' . rawurlencode($token);
        $sender = (string)Application::$PasswordResetSender;
        $headers = array(
            'From: ' . $sender,
            'Content-Type: text/plain; charset=UTF-8',
            'X-Mailer: BeSCMS'
        );
        $message = "A password reset was requested for your BeSCMS account.\n\n"
            . "Use this link within 30 minutes to choose a new password:\n"
            . $resetUrl . "\n\n"
            . "If you did not request this change, you can ignore this email.";
        $smtpHostSet = ini_set('SMTP', (string)Application::$MailHost);
        $smtpPortSet = ini_set('smtp_port', (string)Application::$MailPort);
        if ($smtpHostSet === false || $smtpPortSet === false) {
            error_log('BeSCMS could not apply the configured password reset mail transport.');
            return array("Status" => "Error", "Message" => "The reset email service is not configured. Please contact Barangay Polo staff for help.");
        }
        if (!@mail((string)$user['email'], 'Reset your BeSCMS password', $message, implode("\r\n", $headers))) {
            $invalidated = PdoMySql::ExecuteDML_NonQuery(
                Application::$DBase,
                "UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL",
                array($tokenHash)
            );
            if (!is_int($invalidated)) {
                error_log('BeSCMS could not invalidate an undelivered password reset token.');
            }
            error_log('BeSCMS password reset email could not be sent. Verify the configured PHP mail transport.');
            return array("Status" => "Error", "Message" => "The reset email could not be sent. Please contact Barangay Polo staff for help.");
        }

        return array("Status" => "Success", "Message" => "If that email is registered, a password reset link has been sent.");
    }

    public static function resetPassword($param)
    {
        $token = trim((string)($param['token'] ?? ''));
        $newPassword = (string)($param['new_password'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
            return array("Status" => "Error", "Message" => "This password reset link is invalid or has expired. Request a new one.");
        }
        if (strlen($newPassword) < 6) {
            return array("Status" => "Error", "Message" => "Choose a password with at least 6 characters.");
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "UPDATE users AS u
             INNER JOIN password_reset_tokens AS t ON t.user_id = u.id
             SET u.password = ?, u.updated_at = NOW(), t.used_at = NOW()
             WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()",
            array($passwordHash, hash('sha256', $token))
        );
        if (!is_int($updated)) {
            $error = json_decode((string)$updated, true);
            return array("Status" => "Error", "Message" => $error['Status'] ?? "Unable to reset the password.");
        }
        if ($updated < 1) {
            return array("Status" => "Error", "Message" => "This password reset link is invalid or has expired. Request a new one.");
        }

        return array("Status" => "Success", "Message" => "Password reset successfully. You may now log in.");
    }

    // Public method: log the user out
    public static function logout()
    {
        // Destroy all session data (clear the "ID card")
        Session::destroy();
        return array("Status" => "Success", "Message" => "Logged out.");
    }
}
