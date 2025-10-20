<?php
// Incluimos el archivo de conexión
require 'conexion.php';

// Verificamos que los datos se envíen por el método POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // Obtenemos los datos del formulario y los limpiamos un poco
    $nombres = $_POST['nombre'];
    $apellidos = $_POST['apellido'];
    $fechaNacimiento = $_POST['fecha'];
    $correo = $_POST['email'];
    $usuario = $_POST['usuario'];
    $contrasena = $_POST['password'];

    // --- ¡IMPORTANTE! Hashear la contraseña por seguridad ---
    // Nunca guardes contraseñas en texto plano.
    $contrasena_hasheada = password_hash($contrasena, PASSWORD_DEFAULT);

    // El rol por defecto para un nuevo usuario será 0 (cliente)
    $rol = 0;

    // Preparamos la consulta SQL para evitar inyecciones SQL (más seguro)
    $sql = "INSERT INTO Usuario (rol, nombres, apellidos, fechaNacimiento, correo, usuario, contrasena) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    // Preparamos la sentencia
    $stmt = $conn->prepare($sql);

    // Vinculamos los parámetros
    // "issssss" indica el tipo de dato: i=integer, s=string
    $stmt->bind_param("issssss", $rol, $nombres, $apellidos, $fechaNacimiento, $correo, $usuario, $contrasena_hasheada);

    // Ejecutamos la sentencia y verificamos si fue exitoso
    if ($stmt->execute()) {
        echo "¡Registro exitoso! Ahora puedes iniciar sesión.";
        // Opcional: Redirigir al usuario a la página de inicio después de unos segundos
        header("Location: ../HTML/inicio.html"); // Cambia 'index.html' por tu página de inicio
    } else {
        // Manejo de errores, por ejemplo, si el correo ya existe
        if ($conn->errno == 1062) { // 1062 es el código de error para entrada duplicada
            echo "Error: El correo electrónico o el nombre de usuario ya están registrados.";
        } else {
            echo "Error al registrar el usuario: " . $stmt->error;
        }
    }

    // Cerramos la sentencia y la conexión
    $stmt->close();
    $conn->close();
}
?>