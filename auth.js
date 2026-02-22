const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const router = express.Router()

const SECRET = "mi_clave_secreta_2026"

module.exports = function(conexion) {

    // Registro
    router.post("/registro", async function(req, res) {
        let { nombre, email, password } = req.body

        if (!nombre || !email || !password) {
            return res.status(400).json({ error: "Todos los campos son obligatorios" })
        }

        try {
            const hash = await bcrypt.hash(password, 10)

            conexion.query(
                "INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)",
                [nombre, email, hash],
                function(error, resultado) {
                    if (error) {
                        if (error.code === "ER_DUP_ENTRY") {
                            return res.status(400).json({ error: "El email ya está registrado" })
                        }
                        return res.status(500).json({ error: "Error al registrar usuario" })
                    }
                    res.json({ mensaje: "Usuario registrado correctamente" })
                }
            )
        } catch (error) {
            res.status(500).json({ error: "Error en el servidor" })
        }
    })

    // Login
    router.post("/login", function(req, res) {
        let { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: "Email y contraseña son obligatorios" })
        }

        conexion.query(
            "SELECT * FROM usuarios WHERE email = ?",
            [email],
            async function(error, resultados) {
                if (error) return res.status(500).json({ error: "Error en el servidor" })

                if (resultados.length === 0) {
                    return res.status(401).json({ error: "Credenciales incorrectas" })
                }

                const usuario = resultados[0]
                const passwordValida = await bcrypt.compare(password, usuario.password)

                if (!passwordValida) {
                    return res.status(401).json({ error: "Credenciales incorrectas" })
                }

                const token = jwt.sign(
                    { id: usuario.id, email: usuario.email },
                    SECRET,
                    { expiresIn: "24h" }
                )

                res.json({
                    mensaje: "Login exitoso",
                    token: token,
                    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email }
                })
            }
        )
    })

    return router
}