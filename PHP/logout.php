<?php
// Inicia la sesión para poder manipularla
session_start();

// Elimina todas las variables de sesión
$_SESSION = array();

// Destruye la sesión por completo
session_destroy();

// Redirige al usuario a la página de inicio de sesión
header("Location: ../HTML/inicio.html"); // Cambia esto por tu página de login
exit();
?>