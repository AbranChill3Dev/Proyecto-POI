import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import connection from './JS/db.js'; // asegúrate de que exporte el connection correcto

// ---------------- CONFIGURACIÓN GENERAL ----------------
const port = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------------- SOCKET.IO ----------------
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://192.168.0.2:3000"
        ],
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('🟢 Nuevo cliente conectado');

    socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado');
    });

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});

// ---------------- RUTAS HTML ----------------
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/HTML/inicio.html');
});

app.get('/chat', (req, res) => {
    res.sendFile(process.cwd() + '/HTML/chatsito.html');
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

// --- LOGIN ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;
    const sql = 'SELECT * FROM Usuario WHERE correo = ?';

    connection.query(sql, [correo], async (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.contrasena);
        if (!validPassword) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        res.json({ id_usuario: user.id_usuario });
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
    console.log(`👉 Celular: http://192.168.0.2:${port}`);
});
