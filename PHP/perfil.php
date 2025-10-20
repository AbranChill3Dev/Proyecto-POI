<?php
// 1. Iniciar la sesión
session_start();

// 2. Incluir la conexión
require 'conexion.php'; // ¡Asegúrate que esta ruta es correcta!

// 3. Verificar si el usuario ha iniciado sesión
if (!isset($_SESSION['id_usuario'])) {
    header("Location: login.php");
    exit();
}

// 4. Obtener el ID del usuario de la sesión
$id_usuario = $_SESSION['id_usuario'];

// 5. Preparar y ejecutar la consulta con los nombres de columna correctos
$sql = "SELECT nombres, apellidos, usuario, correo, fechaNacimiento FROM Usuario WHERE id_usuario = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id_usuario);
$stmt->execute();
$result = $stmt->get_result();
$usuario = $result->fetch_assoc();

// 6. Calcular la edad del usuario
$fecha_nacimiento = new DateTime($usuario['fechaNacimiento']);
$hoy = new DateTime();
$edad = $hoy->diff($fecha_nacimiento)->y;

$stmt->close();
$conn->close();
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Perfil | QuinielaZo</title>
    <link rel="stylesheet" href="../CSS/Styles.css">
</head>
<body>
    <header>
        <div class="head">
            <div class="logo">
                <a href="index.html">
                    <img src="../Resources/Imagenes/QuinielazoLogo.png" alt="logo">
                </a>
            </div>
            <div class="navbar">
                <a href="../HTML/QuinielaZo.html">Torneo</a>
                <a href="../HTML/chat.html">Chat</a>
                <a href="../HTML/recompensas.html">Recompensas</a>
                <a href="../HTML/Novedades.html">Novedades</a>
                <a href="perfil.php">Perfil</a> </div>
        </div>
    </header>

    <main>
        <section class="perfil-main">
            <div class="perfil-card perfil-card-left">
                <h2 class="perfil-titulo">Mi cuenta</h2>
                <div class="perfil-foto">
                    <img src="../Resources/Imagenes/IconImage.jpg" alt="Foto de perfil">
                </div>
                <div class="perfil-campo">
                    <label>Nombre:</label>
                    <div class="perfil-input"><?= htmlspecialchars($usuario['nombres']) ?></div>
                </div>
                <div class="perfil-campo">
                    <label>Apellido:</label>
                    <div class="perfil-input"><?= htmlspecialchars($usuario['apellidos']) ?></div>
                </div>
                <div class="perfil-campo">
                    <label>Usuario:</label>
                    <div class="perfil-input"><?= htmlspecialchars($usuario['usuario']) ?></div>
                </div>
            </div>
            <div class="perfil-card perfil-card-right">
                <h2 class="perfil-titulo">Información General</h2>
                <div class="perfil-campo">
                    <label>Correo electrónico:</label>
                    <div class="perfil-input perfil-input-largo"><?= htmlspecialchars($usuario['correo']) ?></div>
                </div>
                <div class="perfil-campo perfil-campo-inline">
                    <div>
                        <label>Edad:</label>
                        <div class="perfil-input perfil-input-corto"><?= $edad ?></div>
                    </div>
                    <div>
                        <label>Fecha de nacimiento:</label>
                        <div class="perfil-input perfil-input-corto"><?= htmlspecialchars($usuario['fechaNacimiento']) ?></div>
                    </div>
                </div>
                <div class="perfil-campo">
                    <label>Puntos:</label>
                    <div class="perfil-input perfil-input-largo">0</div>
                </div>
                <div class="perfil-stats">
                    <div>
                        <div class="stat-label stat-victorias">Victorias</div>
                        <div class="stat-box">0</div>
                    </div>
                    <div>
                        <div class="stat-label stat-empates">Empates</div>
                        <div class="stat-box">0</div>
                    </div>
                    <div>
                        <div class="stat-label stat-derrotas">Derrotas</div>
                        <div class="stat-box">0</div>
                    </div>
                </div>
            </div>
        </section>
        <a href="logout.php">
            <button class="boton-cerrar-sesion">Cerrar Sesión</button>
        </a>
    </main>

    <footer>
        <div class="footerLinks">
            <a href="#">Contacto</a>
            <a href="#">Aviso de Privacidad</a>
            <a href="#">Términos y Condiciones</a>
        </div>
        <div class="copyright">
            <p>&copy; 2026 QuinielaZo. Todos los derechos reservados.</p>
        </div>
    </footer>
</body>
</html>