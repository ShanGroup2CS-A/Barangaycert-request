<?php
require_once __DIR__ . '/../../Libraries/PdoMySql.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Session.Coderstation.php';

class Officials_Module_Model
{
    private static function requireAdmin()
    {
        if (Session::get('role') !== 'admin') {
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin can manage officials.");
        }
        return null;
    }

    private static function databaseError($response)
    {
        if (is_string($response)) {
            $decoded = json_decode($response, true);
            if (is_array($decoded) && isset($decoded['Status']) && strpos((string)$decoded['Status'], 'Error:') === 0) {
                return $decoded['Status'];
            }
        }
        return null;
    }

    private static function councilType($value)
    {
        return in_array($value ?? null, array('barangay', 'sk'), true) ? $value : null;
    }

    private static function validateDate($value, $label)
    {
        $date = trim((string)($value ?? ''));
        if ($date === '') return null;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return array("Status" => "Error", "Message" => $label . " must be a valid date.");
        }
        $parts = explode('-', $date);
        if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            return array("Status" => "Error", "Message" => $label . " must be a valid date.");
        }
        return $date;
    }

    private static function fields($param)
    {
        $fullName = trim((string)($param['full_name'] ?? ''));
        $position = trim((string)($param['position'] ?? ''));
        $councilType = self::councilType($param['council_type'] ?? null);
        if ($fullName === '' || $position === '') {
            return array("Status" => "Error", "Message" => "Full name and position are required.");
        }
        if ($councilType === null) {
            return array("Status" => "Error", "Message" => "Choose a valid officials directory.");
        }
        $termStart = self::validateDate($param['term_start'] ?? null, "Term start");
        if (is_array($termStart)) return $termStart;
        $termEnd = self::validateDate($param['term_end'] ?? null, "Term end");
        if (is_array($termEnd)) return $termEnd;
        if ($termStart !== null && $termEnd !== null && $termEnd < $termStart) {
            return array("Status" => "Error", "Message" => "Term end cannot be earlier than term start.");
        }
        return array(
            'council_type' => $councilType,
            'full_name' => $fullName,
            'position' => $position,
            'contact_number' => trim((string)($param['contact_number'] ?? '')) ?: null,
            'term_start' => $termStart,
            'term_end' => $termEnd
        );
    }

    public static function list($param)
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;
        $councilType = self::councilType($param['type'] ?? null);
        if ($councilType === null) {
            return array("Status" => "Error", "Message" => "Choose a valid officials directory.");
        }
        $response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "SELECT id, council_type, full_name, office_position AS position, contact_number, term_start, term_end FROM council_officials WHERE council_type = ? ORDER BY office_position, full_name",
            array($councilType)
        );
        $error = self::databaseError($response);
        if ($error !== null) return array("Status" => "Error", "Message" => $error);
        return array("Status" => "Success", "Data" => Data_Coversion::toArray($response));
    }

    public static function add($param)
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;
        $fields = self::fields($param);
        if (isset($fields['Status'])) return $fields;
        $result = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "INSERT INTO council_officials (council_type, full_name, office_position, contact_number, term_start, term_end) VALUES (?, ?, ?, ?, ?, ?)",
            array_values($fields)
        );
        $error = self::databaseError($result);
        if ($error !== null || !is_int($result)) {
            return array("Status" => "Error", "Message" => $error ?? "Unable to add official.");
        }
        return array("Status" => "Success", "Message" => "Official added.");
    }

    public static function edit($param)
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;
        $id = filter_var($param['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) return array("Status" => "Error", "Message" => "A valid official ID is required.");
        $fields = self::fields($param);
        if (isset($fields['Status'])) return $fields;
        $values = array_values($fields);
        $values[] = $id;
        $result = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "UPDATE council_officials SET council_type = ?, full_name = ?, office_position = ?, contact_number = ?, term_start = ?, term_end = ?, updated_at = NOW() WHERE id = ?",
            $values
        );
        $error = self::databaseError($result);
        if ($error !== null || !is_int($result)) {
            return array("Status" => "Error", "Message" => $error ?? "Unable to update official.");
        }
        return array("Status" => "Success", "Message" => "Official updated.");
    }

    public static function delete($param)
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;
        $id = filter_var($param['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || self::councilType($param['council_type'] ?? null) === null) {
            return array("Status" => "Error", "Message" => "A valid official ID and directory are required.");
        }
        $result = PdoMySql::ExecuteDML_NonQuery(
            Application::$DBase,
            "DELETE FROM council_officials WHERE id = ? AND council_type = ?",
            array($id, $param['council_type'])
        );
        $error = self::databaseError($result);
        if ($error !== null || !is_int($result)) {
            return array("Status" => "Error", "Message" => $error ?? "Unable to delete official.");
        }
        if ($result === 0) {
            return array("Status" => "Error", "Message" => "Official was not found in this directory.");
        }
        return array("Status" => "Success", "Message" => "Official deleted.");
    }
}
