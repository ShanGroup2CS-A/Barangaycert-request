<?php
class Application
{
    public static $DBase = array(
        "Host"     => "localhost",
        "Port"     => "3306",      // Use your MySQL port (3306 or 3307)
        "Username" => "root",
        "Password" => "",
        "DBName"   => "bescms"
    );

    public static $Server = array(
        "TimeZone" => "Asia/Manila"
    );

    public static $FrontendUrl = "http://bescms.test/frontend/";
    public static $PasswordResetSender = "BeSCMS <noreply@bescms.test>";
    public static $MailHost = "127.0.0.1";
    public static $MailPort = 1025;
}
