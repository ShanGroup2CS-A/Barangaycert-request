# barangaycert-frontend

## Existing database upgrades

For an existing BeSCMS database, run `backend/Assets/Workflow_Enhancements_Migration.sql` once before deploying the updated application. It adds Purok leader access and certificate-request contact numbers, and updates the affected stored procedures.

Run `backend/Assets/Resident_Details_Migration.sql` once on existing databases to add the TIN and Voter ID fields used in resident records.

Run `backend/Assets/Password_Reset_Migration.sql` once on an existing database to enable the forgot-password flow. Reset links expire after 30 minutes and can only be used once. Set `Application::$FrontendUrl`, `Application::$PasswordResetSender`, `Application::$MailHost`, and `Application::$MailPort` in `backend/Configuration/Application.Config.php` for the deployed site and mail server. Local defaults target Laragon Mailpit at `127.0.0.1:1025`; start Mailpit to capture test emails. Production deployments must provide a working PHP mail transport and an HTTPS frontend URL. If the mail provider requires SMTP authentication or TLS, use an appropriately configured server-side relay rather than storing credentials in source code. The reset tables are also included in `backend/Assets/bescms.sql` for fresh installations.

For a fresh database, use `backend/Assets/bescms.sql` and the stored procedures in `backend/Assets/Stored-Procedure/`.
