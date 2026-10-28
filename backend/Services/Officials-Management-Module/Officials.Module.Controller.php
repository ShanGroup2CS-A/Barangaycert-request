<?php
require_once __DIR__ . '/Officials.Module.Model.php';
require_once __DIR__ . '/Officials.Module.View.php';

class Officials_Module_Controller
{
    public static function dispatch($request)
    {
        Route::get('api/officials/list', function ($request) {
            $query = $request['query'] ?? $_GET ?? array();
            return Officials_Module_View::formatResponse(Officials_Module_Model::list($query));
        });

        Route::post('api/officials/add', function ($request) {
            return Officials_Module_View::formatResponse(Officials_Module_Model::add($request['body'] ?? array()));
        });

        Route::post('api/officials/edit', function ($request) {
            return Officials_Module_View::formatResponse(Officials_Module_Model::edit($request['body'] ?? array()));
        });

        Route::post('api/officials/delete', function ($request) {
            return Officials_Module_View::formatResponse(Officials_Module_Model::delete($request['body'] ?? array()));
        });
    }
}
