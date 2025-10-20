<?php
// Iniciamos una sesión para guardar los datos del usuario si el login es correcto
session_start(); 

// Incluimos el archivo de conexión
require 'conexion.php';

// Verificamos que los datos se envíen por el método POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    $correo = $_POST['correo']; // Cambiamos 'usuario' por 'correo'
    $contrasena = $_POST['password'];

    // Preparamos la consulta para obtener el usuario por su correo
    $sql = "SELECT id_usuario, contrasena, nombres FROM Usuario WHERE correo = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $correo);
    $stmt->execute();
    $result = $stmt->get_result();

    // Verificamos si se encontró un usuario
    if ($result->num_rows === 1) {
        $usuario = $result->fetch_assoc();

        // Verificamos si la contraseña ingresada coincide con la hasheada en la BD
        if (password_verify($contrasena, $usuario['contrasena'])) {
            // ¡Login exitoso!
            // Guardamos datos del usuario en la sesión
            $_SESSION['id_usuario'] = $usuario['id_usuario'];
            $_SESSION['nombre_usuario'] = $usuario['nombres'];
            
            // Redirigimos al usuario a la página principal de la aplicación
            header("Location: ../HTML/index.html"); // ¡Asegúrate que esta ruta es correcta!
            exit(); // Es importante terminar el script después de una redirección

        } else {
            // Contraseña incorrecta
            echo "Error: Correo o contraseña incorrectos.";
        }
    } else {
        // Usuario no encontrado
        echo "Error: Correo o contraseña incorrectos.";
    }

    $stmt->close();
    $conn->close();
}
?>