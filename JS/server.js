const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const connection = require('./db'); // tu conexión MySQL
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- REGISTRO ---
app.post('/register', async (req, res) => {
    const { nombre, apellido, fecha, email, usuario, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `INSERT INTO Usuario (rol, nombres, apellidos, fechaNacimiento, correo, usuario, contrasena)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    connection.query(sql, [0, nombre, apellido, fecha, email, usuario, hashedPassword], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Correo o usuario ya registrado' });
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

        // Convertimos la foto BLOB a Base64
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

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
