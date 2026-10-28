<?php
require_once __DIR__ . '/../../Libraries/PdoMySql.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';
require_once __DIR__ . '/../../Libraries/Session.Coderstation.php';

class Resident_Module_Model
{
    private static function isAdminOrBhw()
    {
        $role = Session::get('role');
        return in_array($role, ['admin', 'bhw'], true);
    }

    private static function isResidentManager()
    {
        $role = Session::get('role');
        return in_array($role, ['admin', 'bhw', 'purok_leader'], true);
    }

    private static function isAdmin()
    {
        return Session::get('role') === 'admin';
    }

    private static function requireAdminOrBhw()
    {
        if (!self::isAdminOrBhw()) {
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin or BHW can access this function.");
        }
        return null;
    }

    private static function requireResidentManager()
    {
        if (!self::isResidentManager()) {
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin, BHW, or Purok leaders can access this function.");
        }
        return null;
    }

    private static function requireAdmin()
    {
        if (!self::isAdmin()) {
            return array("Status" => "Error", "Message" => "Unauthorized: Only admin can access this function.");
        }
        return null;
    }

     private static function residentFields($param)
     {
         $value = static function ($key) use ($param) {
             $value = trim((string)($param[$key] ?? ''));
             return $value === '' ? null : $value;
         };
         $firstName = $value('first_name');
         $middleName = $value('middle_name');
         $lastName = $value('last_name');
         $suffix = $value('suffix');
         $fullName = trim(implode(' ', array_filter(
             [$firstName, $middleName, $lastName, $suffix],
             static function ($part) {
                 return $part !== null && $part !== '';
             }
         )));
         if ($fullName === '') {
             $fullName = trim((string)($param['full_name'] ?? ''));
         }
         if ($fullName === '') {
             return array("Status" => "Error", "Message" => "First and last name are required.");
         }

         $income = $value('family_monthly_income');
         if ($income !== null && !is_numeric($income)) {
             return array("Status" => "Error", "Message" => "Family monthly income must be a number.");
         }

         $address = $value('address');
         if ($address === null) {
             $address = implode(', ', array_filter([$value('house_no'), $value('street'), $value('purok_no')]));
         }

         return array(
             "full_name" => $fullName,
             "first_name" => $firstName,
             "middle_name" => $middleName,
             "last_name" => $lastName,
             "suffix" => $suffix,
             "birthdate" => $value('birthdate'),
             "birth_place" => $value('birth_place'),
             "civil_status" => $value('civil_status'),
             "nationality" => $value('nationality') ?? 'Filipino',
             "religion" => $value('religion'),
             "occupation" => $value('occupation'),
             "address" => $address,
             "contact_number" => $value('contact_number'),
             "gender" => $value('gender'),
             "is_pwd" => $value('is_pwd') ?? 'no',
             "pwd_id_no" => $value('pwd_id_no'),
             "family_monthly_income" => $income,
             "is_indigent" => $value('is_indigent') ?? 'no',
             "is_solo_parent" => $value('is_solo_parent') ?? 'no',
             "solo_parent_id_no" => $value('solo_parent_id_no'),
             "is_4ps_member" => $value('is_4ps_member') ?? 'no',
             "registered_voter" => $value('registered_voter') ?? 'no',
             "purok_no" => $value('purok_no'),
             "house_no" => $value('house_no'),
             "street" => $value('street'),
             "emergency_contact_name" => $value('emergency_contact_name'),
             "emergency_contact_relationship" => $value('emergency_contact_relationship'),
             "emergency_contact_number" => $value('emergency_contact_number'),
             "emergency_contact_address" => $value('emergency_contact_address'),
             "national_id_no" => $value('national_id_no'),
             "philhealth_no" => $value('philhealth_no'),
             "covid_status" => $value('covid_status'),
             "vaccinated" => $value('vaccinated') ?? 'no',
             "sss_no" => $value('sss_no'),
             "pagibig_no" => $value('pagibig_no'),
             "tin_no" => $value('tin_no'),
             "voters_id_no" => $value('voters_id_no'),
             "date_of_registration" => $value('date_of_registration') ?? date('Y-m-d'),
             "date_of_death" => $value('date_of_death'),
             "is_alive" => $value('is_alive') ?? 'yes'
         );
     }

     private static function savePhoto($files)
     {
         if (!isset($files['photo']) || $files['photo']['error'] === UPLOAD_ERR_NO_FILE) {
             return array("Status" => "Success", "Path" => null);
         }
         $file = $files['photo'];
         if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024) {
             return array("Status" => "Error", "Message" => "Choose an image smaller than 5 MB.");
         }
         $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
         $extensions = array("image/jpeg" => "jpg", "image/png" => "png");
         if (!isset($extensions[$mime])) {
             return array("Status" => "Error", "Message" => "Resident photos must be JPG or PNG images.");
         }

         $directory = __DIR__ . '/../../uploads/residents';
         if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
             return array("Status" => "Error", "Message" => "Unable to create resident photo storage.");
         }
         $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
         if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
             return array("Status" => "Error", "Message" => "Unable to save the resident photo.");
         }
         return array(
             "Status" => "Success",
             "Path" => 'uploads/residents/' . $filename,
             "AbsolutePath" => $directory . '/' . $filename
         );
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

     public static function add($param, $files = array())
     {
         $authError = self::requireResidentManager();
         if ($authError !== null) return $authError;
         $fields = self::residentFields($param);
         if (isset($fields['Status'])) return $fields;

         $existingResponse = PdoMySql::ExecuteDML_Query(
             Application::$DBase,
             "SELECT id FROM residents WHERE full_name = ? AND birthdate <=> ? AND contact_number <=> ? LIMIT 1",
             array($fields['full_name'], $fields['birthdate'], $fields['contact_number'])
         );
         $existingError = self::databaseError($existingResponse);
         if ($existingError !== null) {
             return array("Status" => "Error", "Message" => $existingError);
         }
         $existing = Data_Coversion::toArray($existingResponse);
         if (!empty($existing) && isset($existing[0]['id'])) {
             return array("Status" => "Error", "Message" => "Resident already exists.");
         }

         $photo = self::savePhoto($files);
         if ($photo['Status'] !== 'Success') return $photo;
         $fields['photo_path'] = $photo['Path'];
         $role = Session::get('role');
         $fields['added_by'] = $role === 'admin' ? 'Admin' : ($role === 'purok_leader' ? 'Purok Leader' : 'BHW');
         $columns = array_keys($fields);
         $sql = "INSERT INTO residents (" . implode(', ', $columns) . ") VALUES (" . implode(', ', array_fill(0, count($columns), '?')) . ")";
         $result = PdoMySql::ExecuteDML_NonQuery(Application::$DBase, $sql, array_values($fields));
         $error = self::databaseError($result);
         if ($error !== null || !is_int($result)) {
             if ($photo['AbsolutePath'] ?? false) unlink($photo['AbsolutePath']);
             return array("Status" => "Error", "Message" => $error ?? "Unable to add resident.");
         }
         return array("Status" => "Success", "Message" => "Resident added successfully.");
     }

     public static function edit($param, $files = array())
     {
         $authError = self::requireAdminOrBhw();
         if ($authError !== null) return $authError;
         $residentId = filter_var($param['id'] ?? null, FILTER_VALIDATE_INT);
         if (!$residentId) return array("Status" => "Error", "Message" => "A valid resident ID is required.");
         $fields = self::residentFields($param);
         if (isset($fields['Status'])) return $fields;

         $photo = self::savePhoto($files);
         if ($photo['Status'] !== 'Success') return $photo;
         if ($photo['Path'] !== null) $fields['photo_path'] = $photo['Path'];
         $role = Session::get('role');
         $fields['last_updated_by'] = $role === 'admin' ? 'Admin' : 'BHW';
         $assignments = array_map(static function ($column) {
             return $column . ' = ?';
         }, array_keys($fields));
         $assignments[] = 'updated_at = NOW()';
         $values = array_values($fields);
         $values[] = $residentId;
         $result = PdoMySql::ExecuteDML_NonQuery(
             Application::$DBase,
             "UPDATE residents SET " . implode(', ', $assignments) . " WHERE id = ?",
             $values
         );
         $error = self::databaseError($result);
         if ($error !== null || !is_int($result)) {
             if ($photo['AbsolutePath'] ?? false) unlink($photo['AbsolutePath']);
             return array("Status" => "Error", "Message" => $error ?? "Unable to update resident.");
         }
         return array("Status" => "Success", "Message" => "Resident updated.");
     }

    public static function delete($param)
    {
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Resident_Delete(?)",
            Data_Coversion::toArray($param)
        );
        $Response = Data_Coversion::toArray($Response);
        $Message = $Response[0]["Record_Status"] ?? "Resident deleted.";
        return array("Status" => "Success", "Message" => $Message);
    }

    public static function export()
    {
        $authError = self::requireAdminOrBhw();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Resident_Export()"
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }

    public static function list()
    {
        $authError = self::requireAdmin();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Resident_Load()"
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }

    public static function search($param)
    {
        $authError = self::requireResidentManager();
        if ($authError !== null) return $authError;

        $Response = PdoMySql::ExecuteDML_Query(
            Application::$DBase,
            "CALL Resident_Search(?)",
            Data_Coversion::toArray($param)
        );
        $Response = Data_Coversion::toArray($Response);
        return array("Status" => "Success", "Data" => $Response);
    }
}
