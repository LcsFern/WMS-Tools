<?php
header("Access-Control-Allow-Origin: *"); // Permite qualquer site acessar
header("Content-Type: text/csv");
header("Content-Disposition: inline; filename=dados.csv");

$file_url = "https://drive.usercontent.google.com/u/0/uc?id=1EYhkx4bT83vzmg5I9U_RRv7xKkKcxsyf&export=download";
readfile($file_url);
?>
