import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import connection from './db.js'; // tu conexión a MySQL
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------- CONFIGURACIÓN GENERAL ----------------
const port = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/HTML', express.static(path.join(__dirname, '../HTML')));
app.use('/CSS', express.static(path.join(__dirname, '../CSS')));
app.use('/JS', express.static(path.join(__dirname, '../JS')));
app.use('/Resources', express.static(path.join(__dirname, '../Resources')));

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://192.168.0.5:3000"
        ],
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('🟢 Nuevo cliente conectado');

    socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado');
    });

    // Guardar mensaje en la base de datos y reenviarlo
    socket.on('chat message', (data) => {
        const { id_usuario, usuario, mensaje } = data;

        // Guardar en la base de datos
        const sql = "INSERT INTO Mensaje (id_usuario, mensaje) VALUES (?, ?)";
        connection.query(sql, [id_usuario, mensaje], (err) => {
            if (err) {
                console.error("❌ Error al guardar mensaje:", err);
                return;
            }
            console.log(`💬 Mensaje guardado de ${usuario}: ${mensaje}`);
        });

        // Enviar mensaje a todos los clientes conectados
        io.emit('chat message', { usuario, mensaje });
    });
});


// ---------------- RUTAS HTML ----------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../HTML/inicio.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../HTML/chatsito.html'));
});

// ---------------- RUTAS API (MySQL) ----------------

// --- REGISTRO ---
app.post('/register', async (req, res) => {
    const { nombre, apellido, fecha, email, usuario, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO Usuario (rol, nombres, apellidos, fechaNacimiento, correo, usuario, contrasena)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    connection.query(sql, [0, nombre, apellido, fecha, email, usuario, hashedPassword], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY')
                return res.status(400).json({ message: 'Correo o usuario ya registrado' });
            return res.status(500).json({ message: err.message });
        }
        res.status(201).json({ message: 'Registro exitoso' });
    });
});

// --- LOGIN (sesión única) ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;
    const sql = 'SELECT * FROM Usuario WHERE correo = ?';

    connection.query(sql, [correo], async (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        const user = results[0];

        // Verificar si ya hay sesión activa (activo = 0 -> ya está activo)
        if (user.activo === 0) {
            return res.status(403).json({ message: 'Este usuario ya tiene sesión iniciada en otro dispositivo' });
        }

        const validPassword = await bcrypt.compare(password, user.contrasena);
        if (!validPassword) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        // Marcar como sesión activa (activo = 0)
        connection.query('UPDATE Usuario SET activo = 0 WHERE id_usuario = ?', [user.id_usuario]);

        res.json({ id_usuario: user.id_usuario, usuario: user.usuario });

    });
});

// --- LOGOUT ---
app.post('/logout', (req, res) => {
    const { id_usuario } = req.body;
    if (!id_usuario) return res.status(400).json({ message: 'ID de usuario requerido' });

    // Al cerrar sesión, activo = 1 (desactivado)
    connection.query('UPDATE Usuario SET activo = 1 WHERE id_usuario = ?', [id_usuario], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Sesión cerrada' });
    });
});


// --- PERFIL ---
app.get('/profile/:id', (req, res) => {
    const userId = req.params.id;
    const sql = "SELECT nombres, apellidos, usuario, correo, fechaNacimiento, foto FROM Usuario WHERE id_usuario = ?";

    connection.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        const user = results[0];
        let fotoBase64 = null;
        if (user.foto) {
            fotoBase64 = `data:image/jpeg;base64,${Buffer.from(user.foto).toString('base64')}`;
        }

        res.json({
            nombres: user.nombres,
            apellidos: user.apellidos,
            usuario: user.usuario,
            correo: user.correo,
            fechaNacimiento: user.fechaNacimiento,
            foto: fotoBase64
        });
    });
});

// ---------------- INICIO DEL SERVIDOR ----------------
server.listen(port, "0.0.0.0", () => {
    console.log("🚀 Servidor corriendo en:");
    console.log(`👉 PC:      http://localhost:${port}`);
    console.log(`👉 Celular: http://192.168.0.5:${port}`);
});

// --- LISTAR USUARIOS (excepto el actual) ---
app.get('/usuarios/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT id_usuario, usuario FROM Usuario WHERE id_usuario != ? AND activo = 1';
    connection.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(results);
    });
});

// --- OBTENER MENSAJES ANTERIORES ---
app.get('/mensajes/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT m.mensaje, m.fecha, u.usuario 
        FROM Mensaje m 
        JOIN Usuario u ON m.id_usuario = u.id_usuario
        ORDER BY m.fecha ASC
    `;
    connection.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(results);
    });
});
