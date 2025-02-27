<?php
header("Access-Control-Allow-Origin: *"); // Permite qualquer site acessar
header("Content-Type: text/csv");
header("Content-Disposition: inline; filename=dados.csv");

$file_url = "http://stvapl/export/csv?page=DLG0404017W";
readfile($file_url);
?>
