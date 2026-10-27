<?php
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';

class CertificateProcessing_Module_View
{
    public static function formatResponse($param)
    {
        // Convert empty arrays in Data field to null
        if (isset($param['Data']) && is_array($param['Data']) && empty($param['Data'])) {
            $param['Data'] = null;
        }
        return Data_Coversion::toJson($param);
    }

    public static function printHtml($certificateData)
    {
        if (!$certificateData) {
            return "<!doctype html><html lang='en'><meta charset='utf-8'><body>Certificate data not found.</body></html>";
        }
        $escape = static function ($value) {
            return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        };
        $certificateType = trim((string)($certificateData['certificate_type'] ?? 'Barangay Certification'));
        $name = $escape($certificateData['full_name'] ?? 'Resident');
        $purpose = trim((string)($certificateData['purpose'] ?? ''));
        $purpose = $escape($purpose !== '' ? $purpose : 'the purpose stated above');
        $isIndigency = stripos($certificateType, 'indigency') !== false;
        $certificationText = $isIndigency
            ? 'is a bona fide resident of Barangay Polo, Dapitan City, Zamboanga del Norte, and belongs to an indigent family in this barangay.'
            : 'is a bona fide resident of Barangay Polo, Dapitan City, Zamboanga del Norte.';
        $day = (int)date('j');
        $daySuffix = ($day % 100 >= 11 && $day % 100 <= 13) ? 'th' : (array('th', 'st', 'nd', 'rd')[$day % 10] ?? 'th');
        $issuedDay = $day . $daySuffix;
        $issuedMonthYear = date('F, Y');

        return "<!doctype html>
            <html lang='en'>
            <head>
                <meta charset='utf-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1'>
                <title>" . $escape($certificateType) . "</title>
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    * { box-sizing: border-box; }
                    html, body { min-height: 100%; margin: 0; }
                    body { color: #222; background: #f2f3f4; font-family: Georgia, 'Times New Roman', serif; }
                    .certificate-sheet { position: relative; min-height: 620px; overflow: hidden; padding: 34px 7% 30px; background: #fff; }
                    .certificate-watermark { position: absolute; top: 48%; left: 50%; width: 330px; height: 330px; object-fit: contain; opacity: .055; transform: translate(-50%, -50%); }
                    .certificate-header, .certificate-office-title, .certificate-body, .certificate-issued, .certificate-signature, .certificate-footer { position: relative; z-index: 1; }
                    .certificate-header { display: grid; grid-template-columns: 100px 1fr 100px; align-items: center; gap: 12px; text-align: center; }
                    .certificate-seal { display: block; width: 94px; height: 94px; object-fit: contain; }
                    .certificate-header-copy p { margin: 2px 0; font-size: 15px; line-height: 1.2; }
                    .certificate-header-copy .certificate-barangay { font-size: 17px; font-style: italic; font-weight: 700; }
                    .certificate-office-title { margin: 34px 0 0; text-align: center; text-decoration: underline; font-size: 25px; }
                    .certificate-title { margin: 20px 0 0; color: #a91620; text-align: center; text-decoration: underline; font-size: 27px; }
                    .certificate-body { margin: 42px 2% 0; font-size: 18px; line-height: 1.7; }
                    .certificate-body p { margin: 0 0 14px; }
                    .certificate-to-whom { margin-bottom: 18px !important; font-weight: 700; }
                    .certificate-name { font-weight: 700; text-decoration: underline; }
                    .certificate-issued { margin: 0 2%; font-size: 17px; line-height: 1.6; }
                    .certificate-signature { width: 270px; margin: 48px 2% 0 auto; text-align: center; font-size: 16px; }
                    .certificate-signature-name { min-height: 23px; border-bottom: 1px solid #555; font-weight: 700; font-style: italic; }
                    .certificate-signature-role { margin-top: 5px; }
                    .certificate-footer { position: absolute; right: 7%; bottom: 26px; left: 7%; font-size: 13px; font-weight: 700; }
                    @media (max-width: 700px) {
                        .certificate-sheet { min-height: 680px; padding: 22px 5%; }
                        .certificate-header { grid-template-columns: 58px 1fr 58px; gap: 6px; }
                        .certificate-seal { width: 56px; height: 56px; }
                        .certificate-header-copy p { font-size: 11px; }
                        .certificate-header-copy .certificate-barangay { font-size: 13px; }
                        .certificate-office-title { margin-top: 26px; font-size: 19px; }
                        .certificate-title { font-size: 20px; }
                        .certificate-body { margin-top: 28px; font-size: 15px; }
                        .certificate-issued { font-size: 14px; }
                        .certificate-signature { margin-top: 32px; }
                    }
                    @media print {
                        html, body { width: 210mm; height: 297mm; min-height: 0; background: #fff; }
                        .certificate-sheet { width: 210mm; height: 297mm; min-height: 0; padding: 12mm 18mm 10mm; }
                        .certificate-header { grid-template-columns: 25mm 1fr 25mm; }
                        .certificate-seal { width: 25mm; height: 25mm; }
                        .certificate-header-copy p { font-size: 10pt; }
                        .certificate-header-copy .certificate-barangay { font-size: 12pt; }
                        .certificate-office-title { margin-top: 9mm; font-size: 18pt; }
                        .certificate-title { margin-top: 5mm; font-size: 20pt; }
                        .certificate-body { margin-top: 15mm; font-size: 12pt; }
                        .certificate-issued { font-size: 11pt; }
                        .certificate-signature { width: 65mm; margin-top: 14mm; font-size: 11pt; }
                        .certificate-footer { bottom: 12mm; font-size: 9pt; }
                    }
                </style>
            </head>
            <body>
                <main class='certificate-sheet'>
                    <img class='certificate-watermark' src='/frontend/images/polog.png' alt=''>
                    <header class='certificate-header'>
                        <img class='certificate-seal' src='/frontend/images/polog.png' alt='Barangay Polo seal'>
                        <div class='certificate-header-copy'>
                            <p>Republic of the Philippines</p>
                            <p>Province of Zamboanga del Norte</p>
                            <p>City of Dapitan</p>
                            <p class='certificate-barangay'>Barangay Polo</p>
                        </div>
                        <span aria-hidden='true'></span>
                    </header>
                    <h1 class='certificate-office-title'>OFFICE OF THE BARANGAY CAPTAIN</h1>
                    <h2 class='certificate-title'>BARANGAY CERTIFICATION</h2>
                    <section class='certificate-body'>
                        <p class='certificate-to-whom'>TO WHOM IT MAY CONCERN:</p>
                        <p>This is to certify that <span class='certificate-name'>" . $name . "</span> " . $certificationText . "</p>
                        <p>This certification is issued upon the request of the above-mentioned resident for " . $purpose . ".</p>
                    </section>
                    <p class='certificate-issued'>Done this <strong>" . $issuedDay . "</strong> day of <strong>" . $issuedMonthYear . "</strong> at Barangay Polo, Dapitan City, Zamboanga del Norte.</p>
                    <div class='certificate-signature'><div class='certificate-signature-name'>Oscar Balladares</div><div class='certificate-signature-role'>Punong Barangay</div></div>
                    <footer class='certificate-footer'>NOT VALID WITHOUT SEAL</footer>
                </main>
            </body>
            </html>";
    }
}
