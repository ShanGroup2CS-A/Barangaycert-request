<?php
require_once __DIR__ . '/../../Libraries/Coversion.Coderstation.php';

class Officials_Module_View
{
    public static function formatResponse($param)
    {
        if (isset($param['Data']) && is_array($param['Data']) && empty($param['Data'])) {
            $param['Data'] = null;
        }
        return Data_Coversion::toJson($param);
    }
}
