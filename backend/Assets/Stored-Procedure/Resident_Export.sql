USE BeSCMS;
DROP PROCEDURE IF EXISTS Resident_Export;
DELIMITER $$
CREATE PROCEDURE Resident_Export()
BEGIN
    SELECT
        full_name,
        gender,
        civil_status,
        purok_no,
        contact_number,
        date_of_registration,
        birthdate,
        birth_place,
        nationality,
        religion,
        occupation,
        is_pwd,
        pwd_id_no,
        family_monthly_income,
        is_indigent,
        is_solo_parent,
        solo_parent_id_no,
        is_4ps_member,
        registered_voter,
        house_no,
        street,
        emergency_contact_name,
        emergency_contact_relationship,
        emergency_contact_number,
        emergency_contact_address,
        national_id_no,
        philhealth_no,
        covid_status,
        vaccinated,
        sss_no,
        pagibig_no,
        tin_no,
        voters_id_no,
        date_of_death,
        is_alive,
        added_by
    FROM residents ORDER BY full_name;
END$$
DELIMITER ;