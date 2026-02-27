require("dotenv").config()
const express = require("express")
const mysql = require("mysql2")
const cors = require("cors")
const app = express()

app.use(cors())
app.set("trust proxy", 1)
app.use(express.json())
const rateLimit = require("express-rate-limit")

const limitadorGeneral = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Demasiadas solicitudes, intenta de nuevo en 15 minutos" }
})

const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Demasiados intentos de login, intenta de nuevo en 15 minutos" }
})

app.use(limitadorGeneral)
app.use("/auth/login", limitadorLogin)
app.use("/public", express.static("public"))

const PORT = process.env.PORT || 3000

const conexion = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
})

conexion.connect(function(error) {
    if (error) {
        console.log("Error conectando:", error)
        return
    }
    console.log("Conectado a MySQL correctamente")
})

const { verificarToken, soloAdmin, soloSuperAdmin } = require("./middleware")
const authRoutes = require("./auth")
const upload = require("./uploads")

app.use("/auth", authRoutes(conexion))

app.get("/productos", verificarToken, function(req, res) {
    conexion.query("SELECT * FROM productos", function(error, resultados) {
        if (error) return res.status(500).json({ error: "Error en la base de datos" })
        res.json(resultados)
    })
})

app.get("/productos/:id", verificarToken, function(req, res) {
    conexion.query("SELECT * FROM productos WHERE id = ?", [req.params.id], function(error, resultados) {
        if (error) return res.status(500).json({ error: "Error en la base de datos" })
        if (resultados.length === 0) return res.status(404).json({ mensaje: "Producto no encontrado" })
        res.json(resultados[0])
    })
})

app.post("/productos", verificarToken, soloAdmin, upload.single("imagen"), function(req, res) {
    let { nombre, precio, stock, descripcion, categoria } = req.body
    let imagen = req.file ? "/public/imagenes/" + req.file.filename : null
    conexion.query(
        "INSERT INTO productos (nombre, precio, stock, descripcion, categoria, imagen) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, precio, stock, descripcion, categoria, imagen],
        function(error, resultado) {
            if (error) return res.status(500).json({ error: "Error al crear producto" })
            res.json({ mensaje: "Producto creado", id: resultado.insertId })
        }
    )
})

app.put("/productos/:id", verificarToken, soloAdmin, upload.single("imagen"), function(req, res) {
    let { nombre, precio, stock, descripcion, categoria } = req.body
    let imagen = req.file ? "/public/imagenes/" + req.file.filename : null
    let query = "UPDATE productos SET nombre=?, precio=?, stock=?, descripcion=?, categoria=?"
    let params = [nombre, precio, stock, descripcion, categoria]
    if (imagen) { query += ", imagen=?"; params.push(imagen) }
    query += " WHERE id=?"
    params.push(req.params.id)
    conexion.query(query, params, function(error) {
        if (error) return res.status(500).json({ error: "Error al actualizar" })
        res.json({ mensaje: "Producto actualizado" })
    })
})

app.delete("/productos/:id", verificarToken, soloAdmin, function(req, res) {
    conexion.query("DELETE FROM productos WHERE id = ?", [req.params.id], function(error) {
        if (error) return res.status(500).json({ error: "Error al eliminar" })
        res.json({ mensaje: "Producto eliminado" })
    })
})

app.post("/pedidos", verificarToken, function(req, res) {
    const { items, total, tipo_envio, destinatario, cedula, telefono, departamento, ciudad, barrio, direccion, indicaciones } = req.body
    const usuario_id = req.usuario.id

    conexion.query(
        `INSERT INTO pedidos (usuario_id, total, tipo_envio, destinatario, cedula, telefono, departamento, ciudad, barrio, direccion, indicaciones) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [usuario_id, total, tipo_envio, destinatario, cedula, telefono, departamento, ciudad, barrio, direccion, indicaciones],
        function(error, resultado) {
            if (error) return res.status(500).json({ error: "Error al crear pedido" })

            const pedido_id = resultado.insertId
            const valores = items.map(item => [pedido_id, item.id, item.nombre, item.precio, item.cantidad])

            conexion.query(
                "INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio, cantidad) VALUES ?",
                [valores],
                function(error) {
                    if (error) return res.status(500).json({ error: "Error al guardar items" })
                    items.forEach(function(item) {
                        conexion.query("UPDATE productos SET stock = stock - ? WHERE id = ?", [item.cantidad, item.id])
                    })
                    res.json({ mensaje: "Pedido creado correctamente", id: pedido_id })
                }
            )
        }
    )
})

app.get("/pedidos", verificarToken, soloAdmin, function(req, res) {
    conexion.query(
        `SELECT p.id, p.total, p.estado, p.created_at, p.tipo_envio,
         p.destinatario, p.cedula, p.telefono, p.departamento, p.ciudad, 
         p.barrio, p.direccion, p.indicaciones,
         u.nombre as usuario, u.email as email_usuario
         FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id 
         ORDER BY p.created_at DESC`,
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al obtener pedidos" })
            res.json(resultados)
        }
    )
})

app.put("/pedidos/:id", verificarToken, soloAdmin, function(req, res) {
    conexion.query("UPDATE pedidos SET estado = ? WHERE id = ?", [req.body.estado, req.params.id], function(error) {
        if (error) return res.status(500).json({ error: "Error al actualizar" })
        res.json({ mensaje: "Estado actualizado" })
    })
})

app.get("/mis-pedidos", verificarToken, function(req, res) {
    const usuario_id = req.usuario.id
    conexion.query(
        `SELECT p.id, p.total, p.estado, p.created_at FROM pedidos p WHERE p.usuario_id = ? ORDER BY p.created_at DESC`,
        [usuario_id],
        function(error, pedidos) {
            if (error) return res.status(500).json({ error: error.message })
            if (pedidos.length === 0) return res.json([])
            let completados = 0
            const resultado = []
            pedidos.forEach(function(pedido) {
                conexion.query(
                    "SELECT nombre, precio, cantidad FROM pedido_items WHERE pedido_id = ?",
                    [pedido.id],
                    function(error, items) {
                        resultado.push({ ...pedido, items: items || [] })
                        completados++
                        if (completados === pedidos.length) res.json(resultado)
                    }
                )
            })
        }
    )
})

app.get("/estadisticas", verificarToken, soloAdmin, function(req, res) {
    const stats = {}
    conexion.query("SELECT COUNT(*) as total FROM productos", function(err, r) {
        stats.productos = r[0].total
        conexion.query("SELECT COUNT(*) as total FROM usuarios", function(err, r) {
            stats.usuarios = r[0].total
            conexion.query("SELECT COUNT(*) as total FROM pedidos", function(err, r) {
                stats.pedidos = r[0].total
                conexion.query("SELECT SUM(total) as total FROM pedidos", function(err, r) {
                    stats.ventas = r[0].total || 0
                    res.json(stats)
                })
            })
        })
    })
})

app.get("/usuarios", verificarToken, soloAdmin, function(req, res) {
    conexion.query("SELECT id, nombre, email, rol FROM usuarios", function(error, resultados) {
        if (error) return res.status(500).json({ error: "Error al obtener usuarios" })
        res.json(resultados)
    })
})

app.put("/usuarios/:id/rol", verificarToken, soloAdmin, function(req, res) {
    conexion.query("UPDATE usuarios SET rol = ? WHERE id = ?", [req.body.rol, req.params.id], function(error) {
        if (error) return res.status(500).json({ error: "Error al actualizar rol" })
        res.json({ mensaje: "Rol actualizado" })
    })
})
app.post("/resenas", verificarToken, function(req, res) {
    const { producto_id, calificacion, comentario } = req.body
    const usuario_id = req.usuario.id

    if (calificacion < 1 || calificacion > 5) {
        return res.status(400).json({ error: "La calificación debe ser entre 1 y 5" })
    }

    conexion.query(
        "INSERT INTO resenas (producto_id, usuario_id, calificacion, comentario) VALUES (?, ?, ?, ?)",
        [producto_id, usuario_id, calificacion, comentario],
        function(error) {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(400).json({ error: "Ya dejaste una reseña para este producto" })
                }
                return res.status(500).json({ error: "Error al guardar reseña" })
            }
            res.json({ mensaje: "Reseña guardada correctamente" })
        }
    )
})

app.get("/resenas/:producto_id", verificarToken, function(req, res) {
    conexion.query(
        `SELECT r.id, r.calificacion, r.comentario, r.created_at, u.nombre,
         (SELECT COUNT(*) FROM resenas_likes WHERE resena_id = r.id) as likes,
         (SELECT COUNT(*) > 0 FROM resenas_likes WHERE resena_id = r.id AND usuario_id = ?) as liked
         FROM resenas r
         JOIN usuarios u ON r.usuario_id = u.id
         WHERE r.producto_id = ?
         ORDER BY r.created_at DESC`,
        [req.usuario.id, req.params.producto_id],
        function(error, resenas) {
            if (error) return res.status(500).json({ error: "Error al obtener reseñas" })

            if (resenas.length === 0) return res.json([])

            let completados = 0
            const resultado = []

            resenas.forEach(function(resena) {
                conexion.query(
                    `SELECT rr.id, rr.comentario, rr.es_admin, rr.created_at, u.nombre
                     FROM resenas_respuestas rr
                     JOIN usuarios u ON rr.usuario_id = u.id
                     WHERE rr.resena_id = ?
                     ORDER BY rr.created_at ASC`,
                    [resena.id],
                    function(error, respuestas) {
                        resultado.push({ ...resena, respuestas: respuestas || [] })
                        completados++
                        if (completados === resenas.length) res.json(resultado)
                    }
                )
            })
        }
    )
})
// Rutas para cancelar pedidos
app.put("/mis-pedidos/:id/cancelar", verificarToken, function(req, res) {
    const usuario_id = req.usuario.id

    conexion.query(
        "SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?",
        [req.params.id, usuario_id],
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al buscar pedido" })
            if (resultados.length === 0) return res.status(404).json({ error: "Pedido no encontrado" })

            const pedido = resultados[0]
            if (pedido.estado !== "pendiente") {
                return res.status(400).json({ error: "Solo puedes cancelar pedidos pendientes" })
            }

            conexion.query(
                "UPDATE pedidos SET estado = 'cancelado' WHERE id = ?",
                [req.params.id],
                function(error) {
                    if (error) return res.status(500).json({ error: "Error al cancelar" })

                    // Devolver stock
                    conexion.query(
                        "SELECT * FROM pedido_items WHERE pedido_id = ?",
                        [req.params.id],
                        function(error, items) {
                            items.forEach(function(item) {
                                conexion.query(
                                    "UPDATE productos SET stock = stock + ? WHERE id = ?",
                                    [item.cantidad, item.producto_id]
                                )
                            })
                        }
                    )

                    res.json({ mensaje: "Pedido cancelado correctamente" })
                }
            )
        }
    )
})
// Rutas para reseñas
app.get("/resenas", verificarToken, soloAdmin, function(req, res) {
    conexion.query(
        `SELECT r.id, r.calificacion, r.comentario, r.created_at,
         u.nombre as usuario, p.nombre as producto,
         (SELECT COUNT(*) FROM resenas_likes WHERE resena_id = r.id) as likes
         FROM resenas r
         JOIN usuarios u ON r.usuario_id = u.id
         JOIN productos p ON r.producto_id = p.id
         ORDER BY r.created_at DESC`,
        function(error, resenas) {
            if (error) return res.status(500).json({ error: "Error al obtener reseñas" })

            if (resenas.length === 0) return res.json([])

            let completados = 0
            const resultado = []

            resenas.forEach(function(resena) {
                conexion.query(
                    `SELECT rr.id, rr.comentario, rr.es_admin, rr.created_at, u.nombre
                     FROM resenas_respuestas rr
                     JOIN usuarios u ON rr.usuario_id = u.id
                     WHERE rr.resena_id = ?
                     ORDER BY rr.created_at ASC`,
                    [resena.id],
                    function(error, respuestas) {
                        resultado.push({ ...resena, respuestas: respuestas || [] })
                        completados++
                        if (completados === resenas.length) res.json(resultado)
                    }
                )
            })
        }
    )
})

app.delete("/resenas/:id", verificarToken, soloAdmin, function(req, res) {
    conexion.query(
        "DELETE FROM resenas WHERE id = ?",
        [req.params.id],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al eliminar reseña" })
            res.json({ mensaje: "Reseña eliminada" })
        }
    )
})
// Dar like a reseña
app.post("/resenas/:id/like", verificarToken, function(req, res) {
    conexion.query(
        "INSERT INTO resenas_likes (resena_id, usuario_id) VALUES (?, ?)",
        [req.params.id, req.usuario.id],
        function(error) {
            if (error && error.code === "ER_DUP_ENTRY") {
                // Ya dio like, quitarlo
                conexion.query(
                    "DELETE FROM resenas_likes WHERE resena_id = ? AND usuario_id = ?",
                    [req.params.id, req.usuario.id],
                    function(error) {
                        if (error) return res.status(500).json({ error: "Error" })
                        res.json({ mensaje: "Like quitado", liked: false })
                    }
                )
                return
            }
            if (error) return res.status(500).json({ error: "Error" })
            res.json({ mensaje: "Like agregado", liked: true })
        }
    )
})

// Obtener respuestas de una reseña
app.get("/resenas/:id/respuestas", verificarToken, function(req, res) {
    conexion.query(
        `SELECT r.id, r.comentario, r.es_admin, r.created_at, u.nombre
         FROM resenas_respuestas r
         JOIN usuarios u ON r.usuario_id = u.id
         WHERE r.resena_id = ?
         ORDER BY r.created_at ASC`,
        [req.params.id],
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error" })
            res.json(resultados)
        }
    )
})

// Responder reseña
app.post("/resenas/:id/respuestas", verificarToken, function(req, res) {
    const { comentario } = req.body
    const es_admin = req.usuario.rol === "admin" || req.usuario.rol === "superadmin" ? 1 : 0

    conexion.query(
        "INSERT INTO resenas_respuestas (resena_id, usuario_id, comentario, es_admin) VALUES (?, ?, ?, ?)",
        [req.params.id, req.usuario.id, comentario, es_admin],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al responder" })
            res.json({ mensaje: "Respuesta agregada" })
        }
    )
})

// Contar likes de una reseña
app.get("/resenas/:id/likes", verificarToken, function(req, res) {
    conexion.query(
        "SELECT COUNT(*) as total FROM resenas_likes WHERE resena_id = ?",
        [req.params.id],
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error" })
            conexion.query(
                "SELECT * FROM resenas_likes WHERE resena_id = ? AND usuario_id = ?",
                [req.params.id, req.usuario.id],
                function(error, liked) {
                    res.json({ total: resultados[0].total, liked: liked.length > 0 })
                }
            )
        }
    )
})
// Rutas para cambiar nombre
app.put("/auth/cambiar-nombre", verificarToken, function(req, res) {
    const { nombre } = req.body
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" })

    conexion.query(
        "UPDATE usuarios SET nombre = ? WHERE id = ?",
        [nombre, req.usuario.id],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al actualizar" })
            res.json({ mensaje: "Nombre actualizado correctamente" })
        }
    )
})
// Rutas para administración de usuarios y solicitudes de cambio
app.put("/auth/cambiar-dato", verificarToken, soloSuperAdmin, async function(req, res) {
    const { campo, valor } = req.body
    const camposPermitidos = ["nombre", "password"]
    
    if (!camposPermitidos.includes(campo)) {
        return res.status(400).json({ error: "Campo no permitido" })
    }

    let valorFinal = valor
    if (campo === "password") {
        const bcrypt = require("bcryptjs")
        valorFinal = await bcrypt.hash(valor, 10)
    }

    conexion.query(
        `UPDATE usuarios SET ${campo} = ? WHERE id = ?`,
        [valorFinal, req.usuario.id],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al actualizar" })
            res.json({ mensaje: campo === "password" ? "Contraseña actualizada" : "Nombre actualizado" })
        }
    )
})

//Admin 

const crypto = require("crypto")

// Generar invitación
app.post("/invitaciones", verificarToken, soloSuperAdmin, function(req, res) {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: "Email requerido" })

    const token = crypto.randomBytes(32).toString("hex")
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000)

    conexion.query(
        "INSERT INTO invitaciones (email, token, expires_at) VALUES (?, ?, ?)",
        [email, token, expires_at],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al generar invitación" })
            res.json({
                mensaje: "Invitación generada",
                link: `${req.headers.origin}/src/views/activar.html?token=${token}`
            })
        }
    )
})

// Verificar token de invitación
app.get("/invitaciones/:token", function(req, res) {
    conexion.query(
        "SELECT * FROM invitaciones WHERE token = ? AND usado = 0 AND expires_at > NOW()",
        [req.params.token],
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al verificar" })
            if (resultados.length === 0) return res.status(404).json({ error: "Link inválido o expirado" })
            res.json({ email: resultados[0].email })
        }
    )
})

// Activar cuenta con invitación
app.post("/invitaciones/:token/activar", async function(req, res) {
    const { nombre, password } = req.body

    conexion.query(
        "SELECT * FROM invitaciones WHERE token = ? AND usado = 0 AND expires_at > NOW()",
        [req.params.token],
        async function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al verificar" })
            if (resultados.length === 0) return res.status(404).json({ error: "Link inválido o expirado" })

            const invitacion = resultados[0]
            const bcrypt = require("bcryptjs")
            const hash = await bcrypt.hash(password, 10)

            conexion.query(
                "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, 'admin')",
                [nombre, invitacion.email, hash],
                function(error) {
                    if (error) {
                        if (error.code === "ER_DUP_ENTRY") {
                            return res.status(400).json({ error: "Este email ya tiene una cuenta" })
                        }
                        return res.status(500).json({ error: "Error al crear cuenta" })
                    }

                    conexion.query("UPDATE invitaciones SET usado = 1 WHERE token = ?", [req.params.token])
                    res.json({ mensaje: "Cuenta activada correctamente" })
                }
            )
        }
    )
})

// Solicitar cambio de datos
app.post("/solicitudes-cambio", verificarToken, function(req, res) {
    const { campo, valor_nuevo } = req.body
    const usuario_id = req.usuario.id

    conexion.query(
        "INSERT INTO solicitudes_cambio (usuario_id, campo, valor_nuevo) VALUES (?, ?, ?)",
        [usuario_id, campo, valor_nuevo],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al enviar solicitud" })
            res.json({ mensaje: "Solicitud enviada al administrador principal" })
        }
    )
})

// Ver solicitudes pendientes
app.get("/solicitudes-cambio", verificarToken, soloSuperAdmin, function(req, res) {
    conexion.query(
        `SELECT s.id, s.campo, s.valor_nuevo, s.estado, s.created_at, u.nombre, u.email
        FROM solicitudes_cambio s
        JOIN usuarios u ON s.usuario_id = u.id
        WHERE s.estado = 'pendiente'
        ORDER BY s.created_at DESC`,
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al obtener solicitudes" })
            res.json(resultados)
        }
    )
})

// Aprobar o rechazar solicitud
app.put("/solicitudes-cambio/:id", verificarToken, soloSuperAdmin, async function(req, res) {
    const { estado } = req.body

    if (estado === "aprobado") {
        conexion.query(
            `SELECT s.*, u.id as uid FROM solicitudes_cambio s 
            JOIN usuarios u ON s.usuario_id = u.id 
            WHERE s.id = ?`,
            [req.params.id],
            async function(error, resultados) {
                if (error) return res.status(500).json({ error: "Error" })
                const solicitud = resultados[0]

                let valor = solicitud.valor_nuevo
                if (solicitud.campo === "password") {
                    const bcrypt = require("bcryptjs")
                    valor = await bcrypt.hash(valor, 10)
                }

                conexion.query(
                    `UPDATE usuarios SET ${solicitud.campo} = ? WHERE id = ?`,
                    [valor, solicitud.uid],
                    function(error) {
                        if (error) return res.status(500).json({ error: "Error al actualizar" })
                        conexion.query("UPDATE solicitudes_cambio SET estado = 'aprobado' WHERE id = ?", [req.params.id])
                        res.json({ mensaje: "Solicitud aprobada" })
                    }
                )
            }
        )
    } else {
        conexion.query(
            "UPDATE solicitudes_cambio SET estado = 'rechazado' WHERE id = ?",
            [req.params.id],
            function(error) {
                if (error) return res.status(500).json({ error: "Error" })
                res.json({ mensaje: "Solicitud rechazada" })
            }
        )
    }
})

app.listen(PORT, function() {
    console.log("Servidor corriendo en http://localhost:" + PORT)
})