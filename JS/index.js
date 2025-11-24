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
import crypto from 'crypto';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs'; 


// ---------------- CONFIGURACIÓN DE RUTAS Y MÓDULOS ES ----------------
// Definiciones necesarias para usar __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------------------------------------------------------------


// ---------------- CONFIGURACIÓN GENERAL DE EXPRESS Y SERVIDOR ----------------
const port = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------------- CONFIGURACIÓN DE ENCRIPTACIÓN AES ----------------
const ENCRYPTION_KEY = crypto.scryptSync('mi-clave-ultra-secreta-32-chars', 'salt', 32); // Clave de 32 bytes (AES-256)
const IV_LENGTH = 16; // AES requiere un IV de 16 bytes (128 bits)

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text || text.indexOf(':') === -1) return text;
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return text;
    }
}
// ---------------- FIN CONFIGURACIÓN DE ENCRIPTACIÓN ----------------


// ---------------- CONFIGURACIÓN DE CARGA DE ARCHIVOS (MULTER) ----------------
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Crear el directorio de subidas si no existe
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`📂 Creando directorio: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const uniqueFilename = uuidv4() + extension;
        cb(null, uniqueFilename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});
// ---------------- FIN CONFIGURACIÓN DE MULTER ----------------


// ---------------- SERVICIO DE ARCHIVOS ESTÁTICOS ----------------
app.use('/HTML', express.static(path.join(__dirname, '../HTML')));
app.use('/CSS', express.static(path.join(__dirname, '../CSS')));
app.use('/JS', express.static(path.join(__dirname, '../JS')));
app.use('/Resources', express.static(path.join(__dirname, '../Resources')));
// Servir el directorio de subidas de archivos
app.use('/uploads', express.static(UPLOADS_DIR));


// ID predefinido para el chat general y tipo de chat
const ID_CHAT_GENERAL = 1;
const ID_TIPO_CHAT_PRIVADO = 2;

// ---------------- ALMACENAMIENTO DE SOCKETS ----------------
// userSocketMap solo contiene a los usuarios marcados como "Activos" (activo=0 en DB)
const userSocketMap = {};
const socketUserMap = {};

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
    console.log('🟢 Nuevo cliente conectado:', socket.id);

    // --- 1. Evento para asociar el usuario autenticado con su socket (ACTIVO)
    socket.on('user connected', (id_usuario) => {
        if (id_usuario) {
            userSocketMap[id_usuario] = socket.id;
            socketUserMap[socket.id] = id_usuario;
            console.log(`👤 Usuario ${id_usuario} asociado a socket ${socket.id} (ACTIVO)`);

            // Marcar como activo (0) en la base de datos
            connection.query('UPDATE Usuario SET activo = 0 WHERE id_usuario = ?', [id_usuario], (err) => {
                if (err) console.error("❌ Error al actualizar 'activo' a 0:", err);
            });

            io.emit('online users', Object.keys(userSocketMap));
        }
    });

    // --- NUEVO: Desconexión manual (INACTIVO/Stealth) ---
    socket.on('manual disconnect', (id_usuario) => {
        if (id_usuario) {
            // 1. Eliminar el socket mapping (lo hace "invisible" a otros usuarios)
            delete userSocketMap[id_usuario];
            delete socketUserMap[socket.id];
            console.log(`⚫ Usuario ${id_usuario} se puso INACTIVO manualmente.`);

            // 2. Marcar como inactivo en la base de datos (activo = 1)
            connection.query('UPDATE Usuario SET activo = 1 WHERE id_usuario = ?', [id_usuario], (err) => {
                if (err) console.error("❌ Error al actualizar 'activo' a 1:", err);
            });

            // 3. Notificar a todos para que la bolita desaparezca
            io.emit('online users', Object.keys(userSocketMap));
        }
    });


    socket.on('disconnect', () => {
        console.log('🔴 Cliente desconectado (físicamente):', socket.id);
        const id_usuario = socketUserMap[socket.id];

        if (id_usuario) {
            
            // Si el usuario aún estaba en el mapa (no se desconectó manualmente), lo marcamos inactivo.
            if (userSocketMap[id_usuario]) {
                connection.query('UPDATE Usuario SET activo = 1 WHERE id_usuario = ?', [id_usuario], (err) => {
                    if (err) console.error("❌ Error al actualizar 'activo' en logout:", err);
                });
            }
            
            // Limpieza final de mapas
            delete userSocketMap[id_usuario];
            delete socketUserMap[socket.id];
            
            io.emit('online users', Object.keys(userSocketMap));
        }
    });

    // --- 2. Mensaje de Chat General
    socket.on('general message', (data) => {
        const { id_usuario, usuario, mensaje, isEncrypted } = data;

        const mensajeParaBD = mensaje.startsWith('[UBICACIÓN:') ? mensaje : (isEncrypted ? encrypt(mensaje) : mensaje);

        const sql = "INSERT INTO Mensaje (id_chat, id_usuario, contenido, encriptado) VALUES (?, ?, ?, ?)";
        connection.query(sql, [ID_CHAT_GENERAL, id_usuario, mensajeParaBD, isEncrypted], (err, resultMensaje) => {
            if (err) {
                console.error("❌ Error al guardar mensaje general:", err);
                return;
            }
            console.log(`💬 Mensaje general guardado de ${usuario}. Encriptado: ${isEncrypted}`);

            // Enviar mensaje a todos los clientes (incluido el remitente)
            io.emit('general message', {
                usuario,
                mensaje: mensaje,
                id_usuario,
                fecha_envio: new Date().toISOString(),
                id_mensaje: resultMensaje.insertId
            });
        });
    });

    // --- 3. Mensaje Privado
    socket.on('private message', (data) => {
        const { id_chat, id_remitente, usuario_remitente, mensaje, id_destinatario, isEncrypted } = data;

        const mensajeParaBD = mensaje.startsWith('[UBICACIÓN:') ? mensaje : (isEncrypted ? encrypt(mensaje) : mensaje);

        // A. Guardar en la base de datos
        const sql = "INSERT INTO Mensaje (id_chat, id_usuario, contenido, encriptado) VALUES (?, ?, ?, ?)";
        connection.query(sql, [id_chat, id_remitente, mensajeParaBD, isEncrypted], (err, resultMensaje) => {
            if (err) {
                console.error("❌ Error al guardar mensaje privado:", err);
                return;
            }
            console.log(`💬 Mensaje privado guardado en chat ${id_chat}. Encriptado: ${isEncrypted}`);

            const messageData = {
                id_chat,
                usuario: usuario_remitente,
                mensaje: mensaje,
                id_usuario: id_remitente,
                fecha_envio: new Date().toISOString(),
                id_mensaje: resultMensaje.insertId 
            };

            // B. Enviar mensaje de vuelta al remitente (usando su socket ID)
            io.to(socket.id).emit('private message', messageData);

            // C. Enviar al destinatario si está conectado
            const destinatarioSocketId = userSocketMap[id_destinatario];
            if (destinatarioSocketId) {
                if (destinatarioSocketId !== socket.id) {
                    io.to(destinatarioSocketId).emit('private message', messageData);
                }
            }
        });
    });
});


// ---------------- RUTAS HTML ----------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../HTML/inicio.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../HTML/chatsito.html'));
});

// ---------------- RUTAS API (MySQL) Y ARCHIVOS ----------------

// RUTA POST para Subida de Archivos
app.post('/upload', upload.single('archivo'), async (req, res) => {
    const { id_chat, id_usuario, usuario, tipo_chat, id_destinatario, isEncrypted } = req.body;
    const archivo = req.file;

    if (!archivo) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
    }

    const tipoArchivo = archivo.mimetype.startsWith('image/') ? 'imagen' : 'otro';
    const contenidoMensaje = `[ARCHIVO:${tipoArchivo}:${archivo.filename}]`;

    const mensajeParaBD = isEncrypted === 'true' ? encrypt(contenidoMensaje) : contenidoMensaje;

    const sqlMensaje = "INSERT INTO Mensaje (id_chat, id_usuario, contenido, encriptado) VALUES (?, ?, ?, ?)";

    connection.query(sqlMensaje, [id_chat, id_usuario, mensajeParaBD, isEncrypted === 'true'], (err, resultMensaje) => {
        if (err) {
            console.error("❌ Error al guardar mensaje con archivo:", err);
            return res.status(500).json({ message: err.message });
        }

        const id_mensaje = resultMensaje.insertId;

        // Insertar en la tabla Archivo
        const sqlArchivo = "INSERT INTO Archivo (id_mensaje, tipo, nombre_original, ruta_archivo, tamaño) VALUES (?, ?, ?, ?, ?)";
        const rutaRelativa = `/uploads/${archivo.filename}`;

        connection.query(sqlArchivo, [id_mensaje, tipoArchivo, archivo.originalname, rutaRelativa, archivo.size], (err) => {
            if (err) {
                console.error("❌ Error al guardar en tabla Archivo:", err);
                return res.status(500).json({ message: err.message });
            }

            // Notificar a los clientes por Socket.IO
            const messageData = {
                id_chat: parseInt(id_chat),
                usuario: usuario,
                mensaje: contenidoMensaje,
                id_usuario: parseInt(id_usuario),
                fecha_envio: new Date().toISOString(),
                id_mensaje: id_mensaje
            };

            if (tipo_chat === 'general') {
                io.emit('general message', messageData);
            } else if (tipo_chat === 'private') {
                const remitenteSocketId = userSocketMap[id_usuario];
                if (remitenteSocketId) io.to(remitenteSocketId).emit('private message', messageData);

                const destinatarioSocketId = userSocketMap[id_destinatario];
                if (destinatarioSocketId) io.to(destinatarioSocketId).emit('private message', messageData);
            }

            res.json({ message: 'Archivo subido y notificado correctamente' });
        });
    });
});

// RUTA GET para obtener metadata del archivo
app.get('/archivo/:id_mensaje', (req, res) => {
    const { id_mensaje } = req.params;
    const sql = 'SELECT nombre_original, ruta_archivo, tipo FROM Archivo WHERE id_mensaje = ?';

    connection.query(sql, [id_mensaje], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Archivo no encontrado' });

        res.json(results[0]);
    });
});

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
    const sql = 'SELECT id_usuario, usuario, contrasena, activo FROM Usuario WHERE correo = ?';

    connection.query(sql, [correo], async (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        const user = results[0];

        const validPassword = await bcrypt.compare(password, user.contrasena);
        if (!validPassword) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });

        if (user.activo === 0) {
            // Manejar si la sesión única está activa
        }

        connection.query('UPDATE Usuario SET activo = 0 WHERE id_usuario = ?', [user.id_usuario]);

        res.json({ id_usuario: user.id_usuario, usuario: user.usuario });

    });
});

// --- LOGOUT ---
app.post('/logout', (req, res) => {
    const { id_usuario } = req.body;
    if (!id_usuario) return res.status(400).json({ message: 'ID de usuario requerido' });

    connection.query('UPDATE Usuario SET activo = 1 WHERE id_usuario = ?', [id_usuario], (err) => {
        if (err) return res.status(500).json({ message: err.message });

        if (userSocketMap[id_usuario]) {
            const socketId = userSocketMap[id_usuario];
            delete userSocketMap[id_usuario];
            delete socketUserMap[socketId];
            io.emit('online users', Object.keys(userSocketMap));
        }

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

// --- LISTAR USUARIOS PARA CHAT PRIVADO ---
app.get('/usuarios/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT id_usuario, usuario FROM Usuario WHERE id_usuario != ?';
    connection.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(results);
    });
});

// --- OBTENER MENSAJES DEL CHAT GENERAL (ID_CHAT_GENERAL = 1) ---
app.get('/mensajes/general', (req, res) => {
    const sql = `
        SELECT m.id_mensaje, m.contenido, m.fecha_envio AS fecha, u.usuario, u.id_usuario, m.encriptado
        FROM Mensaje m 
        JOIN Usuario u ON m.id_usuario = u.id_usuario
        WHERE m.id_chat = ?
        ORDER BY m.fecha_envio ASC
    `;
    connection.query(sql, [ID_CHAT_GENERAL], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });

        const mensajesDesencriptados = results.map(m => ({
            id_mensaje: m.id_mensaje,
            mensaje: m.encriptado ? decrypt(m.contenido) : m.contenido,
            fecha: m.fecha,
            usuario: m.usuario,
            id_usuario: m.id_usuario
        }));

        res.json(mensajesDesencriptados);
    });
});

// --- OBTENER MENSAJES DE UN CHAT ESPECÍFICO (Privado o Grupo) ---
app.get('/mensajes/chat/:id_chat', (req, res) => {
    const { id_chat } = req.params;
    const sql = `
        SELECT m.id_mensaje, m.contenido, m.fecha_envio AS fecha, u.usuario, u.id_usuario, m.encriptado
        FROM Mensaje m 
        JOIN Usuario u ON m.id_usuario = u.id_usuario
        WHERE m.id_chat = ?
        ORDER BY m.fecha_envio ASC
    `;
    connection.query(sql, [id_chat], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });

        const mensajesDesencriptados = results.map(m => ({
            id_mensaje: m.id_mensaje,
            mensaje: m.encriptado ? decrypt(m.contenido) : m.contenido,
            fecha: m.fecha,
            usuario: m.usuario,
            id_usuario: m.id_usuario
        }));

        res.json(mensajesDesencriptados);
    });
});

// --- CREAR/OBTENER CHAT PRIVADO ---
app.post('/chat/private', (req, res) => {
    const { id_usuario_1, id_usuario_2 } = req.body;

    const checkSql = `
        SELECT c.id_chat 
        FROM Chat c
        JOIN ChatUsuario cu1 ON c.id_chat = cu1.id_chat
        JOIN ChatUsuario cu2 ON c.id_chat = cu2.id_chat
        WHERE c.id_tipo_chat = ?
          AND cu1.id_usuario = ? AND cu2.id_usuario = ?
          AND cu1.id_usuario != cu2.id_usuario
        LIMIT 1;
    `;

    const checkParams = [ID_TIPO_CHAT_PRIVADO, id_usuario_1, id_usuario_2];

    connection.query(checkSql, checkParams, (err, results) => {
        if (err) return res.status(500).json({ message: err.message });

        if (results.length > 0) {
            return res.json({ id_chat: results[0].id_chat });
        }

        connection.beginTransaction((err) => {
            if (err) return res.status(500).json({ message: err.message });

            const createChatSql = 'INSERT INTO Chat (id_tipo_chat, creado_por) VALUES (?, ?)';
            connection.query(createChatSql, [ID_TIPO_CHAT_PRIVADO, id_usuario_1], (err, resultChat) => {
                if (err) {
                    return connection.rollback(() => res.status(500).json({ message: 'Error al crear chat: ' + err.message }));
                }

                const newChatId = resultChat.insertId;

                const users = [[newChatId, id_usuario_1], [newChatId, id_usuario_2]];
                const createUsersSql = 'INSERT INTO ChatUsuario (id_chat, id_usuario) VALUES ?';

                connection.query(createUsersSql, [users], (err) => {
                    if (err) {
                        return connection.rollback(() => res.status(500).json({ message: 'Error al añadir usuarios: ' + err.message }));
                    }

                    connection.commit((err) => {
                        if (err) {
                            return connection.rollback(() => res.status(500).json({ message: 'Error al hacer commit: ' + err.message }));
                        }
                        res.status(201).json({ id_chat: newChatId });
                    });
                });
            });
        });
    });
});


// ---------------- INICIO DEL SERVIDOR ----------------
server.listen(port, "0.0.0.0", () => {
    console.log("🚀 Servidor corriendo en:");
    console.log(`👉 PC:      http://localhost:${port}`);
    console.log(`👉 Celular: http://192.168.0.2:${port}`);
});