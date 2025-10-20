<?php
// Configuración de la base de datos
$servidor = "localhost"; // Generalmente es 'localhost'
$usuario_db = "root";    // Usuario de tu base de datos (por defecto suele ser 'root')
$contrasena_db = "12345";     // Contraseña de tu base de datos (déjala vacía si no tiene)
$nombre_db = "bd_poi";   // El nombre de tu base de datos

// Crear la conexión
$conn = new mysqli($servidor, $usuario_db, $contrasena_db, $nombre_db);

// Verificar si la conexión falló
if ($conn->connect_error) {
    // Detiene la ejecución y muestra el error
    die("Error de conexión: " . $conn->connect_error);
}

// Opcional: Establecer el conjunto de caracteres a UTF-8 para evitar problemas con tildes y ñ
$conn->set_charset("utf8");
?>