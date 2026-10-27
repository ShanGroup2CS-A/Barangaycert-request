<?php

/**
 * CertificateRequest.Module.Model.php
 * Business logic for Certificate Request operations.
 *
 * Provides methods to submit, cancel, resubmit requests and fetch a user's requests.
 */
require_once __DIR__ . '/../../Libraries/PdoMySql.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Session.Coderstation.php';

class CertificateRequest_Module_Model
{
    private static function requireResident()
    {
        if (Session::get('role') !== 'resident') {
            return array("Status" => "Error", "Message" => "Only resident accounts can manage certificate requests.");
        }
        return null;
    }

    private static function errorMessage($rows)
    {
        $message = $rows[0]['Record_Status'] ?? $rows[0]['Status'] ?? '';
        return is_string($message) && strpos($message, 'Error:') === 0
            ? substr($message, 7)
            : null;
    }

    private static function fetchRequests($userId)
    {
        $response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Certificate_MyRequests(?,?)",
            array($userId, null)
        );
        return Data_Coversion::toArray($response);
    }

    /**
     * Submit a new certificate request.
     *
     * @param array $param Expected keys: 'certificate_type', 'contact_number', 'purpose', 'quantity'
     * @return array Standard response: ['Status' => 'Success'|'Error', 'Message' => string]
     */
    public static function submit($param)
    {
        // Ensure user is logged in
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        $authError = self::requireResident();
        if ($authError !== null) return $authError;

        $certificateType = trim((string)($param['certificate_type'] ?? ''));
        $contactNumber = trim((string)($param['contact_number'] ?? ''));
        $purpose = trim((string)($param['purpose'] ?? ''));
        $quantity = filter_var($param['quantity'] ?? null, FILTER_VALIDATE_INT);
        if ($certificateType === '' || $purpose === '' || $contactNumber === '' ||
            strlen($contactNumber) > 30 || $quantity === false || $quantity < 1 || $quantity > 20) {
            return array("Status" => "Error", "Message" => "Enter a certificate type, contact number, purpose, and a quantity between 1 and 20.");
        }

        $accountResponse = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT verification_status FROM users WHERE id = ?",
            array($user_id)
        );
        $account = Data_Coversion::toArray($accountResponse);
        $databaseError = self::errorMessage($account);
        if ($databaseError !== null) {
            return array("Status" => "Error", "Message" => $databaseError);
        }
        if (!in_array(($account[0]['verification_status'] ?? ''), array('approved', 'verified'), true)) {
            return array("Status" => "Error", "Message" => "Account not verified. Verify your account first to request a certificate.");
        }

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Certificate_Submit(?,?,?,?,?)",
            array($user_id, $certificateType, $purpose, $quantity, $contactNumber)
        );

        $Response = Data_Coversion::toArray($Response);
        $databaseError = self::errorMessage($Response);
        if ($databaseError !== null) {
            return array("Status" => "Error", "Message" => $databaseError);
        }

        $Message = $Response[0]["Record_Status"] ?? "Request submitted.";
        return array("Status" => "Success", "Message" => $Message, "Data" => self::fetchRequests($user_id));
    }

    /**
     * Cancel an existing certificate request.
     *
     * @param array $param Expected to contain the request id or cancellation payload
     * @return array Standard response with status and message
     */
    public static function cancel($param)
    {
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        $authError = self::requireResident();
        if ($authError !== null) return $authError;
        $requestId = filter_var($param['id'] ?? $param['request_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$requestId) {
            return array("Status" => "Error", "Message" => "A valid request ID is required.");
        }

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Certificate_Cancel(?,?)",
            array($user_id, $requestId)
        );

        $Response = Data_Coversion::toArray($Response);
        $databaseError = self::errorMessage($Response);
        if ($databaseError !== null) {
            return array("Status" => "Error", "Message" => $databaseError);
        }
        $Message = $Response[0]["Record_Status"] ?? "Request cancelled.";
        return array("Status" => "Success", "Message" => $Message, "Data" => self::fetchRequests($user_id));
    }

    /**
     * Resubmit a previously cancelled/adjusted request (e.g., update quantity).
     *
     * @param array $param Expected keys depend on stored procedure (id, quantity)
     * @return array Standard response with status and message
     */
    public static function resubmit($param)
    {
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        $authError = self::requireResident();
        if ($authError !== null) return $authError;
        $requestId = filter_var($param['id'] ?? $param['request_id'] ?? null, FILTER_VALIDATE_INT);
        $quantity = filter_var($param['quantity'] ?? null, FILTER_VALIDATE_INT);
        if (!$requestId || $quantity === false || $quantity < 1 || $quantity > 20) {
            return array("Status" => "Error", "Message" => "A valid request ID and quantity between 1 and 20 are required.");
        }

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Certificate_Resubmit(?,?,?)",
            array($user_id, $requestId, $quantity)
        );
        $Response = Data_Coversion::toArray($Response);
        $databaseError = self::errorMessage($Response);
        if ($databaseError !== null) {
            return array("Status" => "Error", "Message" => $databaseError);
        }
        $Message = $Response[0]["Record_Status"] ?? "Request resubmitted.";

        return array("Status" => "Success", "Message" => $Message, "Data" => self::fetchRequests($user_id));
    }

    /**
     * Retrieve requests created by the current user, optionally filtered by status.
     *
     * @param array $param Optional key: 'status' to filter results
     * @return array ['Status' => 'Success'|'Error', 'Data' => array]
     */
    public static function myRequests($param)
    {
        // Ensure user is logged in
        $user_id = Session::get('user_id');
        if (!$user_id) {
            return array("Status" => "Error", "Message" => "Not logged in.");
        }
        $authError = self::requireResident();
        if ($authError !== null) return $authError;

        $status = isset($param['status']) ? $param['status'] : null;
        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Certificate_MyRequests(?,?)",
            array($user_id, $status)
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }
}
