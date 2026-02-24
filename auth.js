const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const router = express.Router()

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
        const SECRET = process.env.JWT_SECRET
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
                    { id: usuario.id, email: usuario.email, rol: usuario.rol },
                    SECRET,
                    { expiresIn: "24h" }
                )

                res.json({
                    mensaje: "Login exitoso",
                    token: token,
                    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
                })
            }
        )
    })

    // Cambiar contraseña
    router.put("/cambiar-password", async function(req, res) {
        const SECRET = process.env.JWT_SECRET
        const { passwordActual, passwordNueva } = req.body
        const token = req.headers["authorization"]

        if (!token) return res.status(401).json({ error: "Token requerido" })

        try {
            const decoded = jwt.verify(token, SECRET)

            conexion.query(
                "SELECT * FROM usuarios WHERE id = ?",
                [decoded.id],
                async function(error, resultados) {
                    if (error) return res.status(500).json({ error: "Error en el servidor" })

                    const usuario = resultados[0]
                    const passwordValida = await bcrypt.compare(passwordActual, usuario.password)

                    if (!passwordValida) {
                        return res.status(400).json({ error: "Contraseña actual incorrecta" })
                    }

                    const hash = await bcrypt.hash(passwordNueva, 10)

                    conexion.query(
                        "UPDATE usuarios SET password = ? WHERE id = ?",
                        [hash, decoded.id],
                        function(error) {
                            if (error) return res.status(500).json({ error: "Error al actualizar" })
                            res.json({ mensaje: "Contraseña actualizada correctamente" })
                        }
                    )
                }
            )
        } catch (error) {
            res.status(401).json({ error: "Token inválido" })
        }
    })

    return router
}