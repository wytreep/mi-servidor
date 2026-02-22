require("dotenv").config()
const express = require("express")

const mysql = require("mysql2")
const app = express()
const cors = require("cors")
app.use(cors())
const authRoutes = require("./auth")
const { verificarToken, soloAdmin } = require("./middleware")


app.use(express.json())
app.use("/public", express.static("public"))
const PORT = process.env.PORT

const conexion = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})



conexion.connect(function(error) {
    if (error) {
        console.log("Error conectando:", error)
        return
    }
    console.log("Conectado a MySQL correctamente")
})

app.get("/productos", verificarToken, function(req, res) {
    conexion.query("SELECT * FROM productos", function(error, resultados) {
        if (error) {
            res.status(500).json({ error: "Error en la base de datos" })
            return
        }
        res.json(resultados)
    })
})
// Obtener un producto por ID
app.get("/productos/:id", verificarToken, function(req, res) {
    let id = req.params.id
    conexion.query("SELECT * FROM productos WHERE id = ?", [id], function(error, resultados) {
        if (error) {
            res.status(500).json({ error: "Error en la base de datos" })
            return
        }
        if (resultados.length === 0) {
            res.status(404).json({ mensaje: "Producto no encontrado" })
            return
        }
        res.json(resultados[0])
    })
})

// Agregar un producto nuevo
const upload = require("./uploads")

app.post("/productos", verificarToken, soloAdmin, upload.single("imagen"), function(req, res) {
    let { nombre, precio, stock, descripcion, categoria } = req.body
    let imagen = req.file ? "/public/imagenes/" + req.file.filename : null

    conexion.query(
        "INSERT INTO productos (nombre, precio, stock, descripcion, categoria, imagen) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, precio, stock, descripcion, categoria, imagen],
        function(error, resultado) {
            if (error) {
                res.status(500).json({ error: "Error al crear producto" })
                return
            }
            res.json({ mensaje: "Producto creado", id: resultado.insertId })
        }
    )
})
// Actualizar producto
app.put("/productos/:id", verificarToken, soloAdmin, upload.single("imagen"), function(req, res) {
    let { nombre, precio, stock, descripcion, categoria } = req.body
    let imagen = req.file ? "/public/imagenes/" + req.file.filename : null

    let query = "UPDATE productos SET nombre=?, precio=?, stock=?, descripcion=?, categoria=?"
    let params = [nombre, precio, stock, descripcion, categoria]

    if (imagen) {
        query += ", imagen=?"
        params.push(imagen)
    }

    query += " WHERE id=?"
    params.push(req.params.id)

    conexion.query(query, params, function(error) {
        if (error) return res.status(500).json({ error: "Error al actualizar" })
        res.json({ mensaje: "Producto actualizado" })
    })
})

// Eliminar producto
app.delete("/productos/:id", verificarToken, soloAdmin, function(req, res) {
    let id = req.params.id
    conexion.query("DELETE FROM productos WHERE id = ?", [id], function(error, resultado) {
        if (error) {
            res.status(500).json({ error: "Error al eliminar" })
            return
        }
        res.json({ mensaje: "Producto eliminado" })
    })
})


app.use("/auth", authRoutes(conexion))

app.post("/pedidos", verificarToken, async function(req, res) {
    const { items, total } = req.body
    const usuario_id = req.usuario.id

    conexion.query(
        "INSERT INTO pedidos (usuario_id, total) VALUES (?, ?)",
        [usuario_id, total],
        function(error, resultado) {
            if (error) return res.status(500).json({ error: "Error al crear pedido" })

            const pedido_id = resultado.insertId
            const valores = items.map(item => [pedido_id, item.id, item.nombre, item.precio, item.cantidad])

            conexion.query(
                "INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio, cantidad) VALUES ?",
                [valores],
                function(error) {
                    if (error) return res.status(500).json({ error: "Error al guardar items" })
                    res.json({ mensaje: "Pedido creado correctamente", id: pedido_id })
                }
            )
        }
    )
})

app.get("/pedidos", verificarToken, soloAdmin, function(req, res) {
    conexion.query(
        `SELECT p.id, p.total, p.estado, p.created_at, u.nombre as usuario 
         FROM pedidos p 
         JOIN usuarios u ON p.usuario_id = u.id 
         ORDER BY p.created_at DESC`,
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al obtener pedidos" })
            res.json(resultados)
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

app.put("/pedidos/:id", verificarToken, soloAdmin, function(req, res) {
    const { estado } = req.body
    conexion.query(
        "UPDATE pedidos SET estado = ? WHERE id = ?",
        [estado, req.params.id],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al actualizar" })
            res.json({ mensaje: "Estado actualizado" })
        }
    )
})

app.get("/usuarios", verificarToken, soloAdmin, function(req, res) {
    conexion.query(
        "SELECT id, nombre, email, rol FROM usuarios",
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al obtener usuarios" })
            res.json(resultados)
        }
    )
})

app.get("/mis-pedidos", verificarToken, function(req, res) {
    const usuario_id = req.usuario.id
    conexion.query(
        `SELECT p.id, p.total, p.estado, p.created_at,
        JSON_ARRAYAGG(JSON_OBJECT(
            'nombre', pi.nombre,
            'precio', pi.precio,
            'cantidad', pi.cantidad
        )) as items
        FROM pedidos p
        JOIN pedido_items pi ON p.id = pi.pedido_id
        WHERE p.usuario_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
        [usuario_id],
        function(error, resultados) {
            if (error) return res.status(500).json({ error: "Error al obtener pedidos" })
            res.json(resultados)
        }
    )
})

app.put("/usuarios/:id/rol", verificarToken, soloAdmin, function(req, res) {
    const { rol } = req.body
    conexion.query(
        "UPDATE usuarios SET rol = ? WHERE id = ?",
        [rol, req.params.id],
        function(error) {
            if (error) return res.status(500).json({ error: "Error al actualizar rol" })
            res.json({ mensaje: "Rol actualizado" })
        }
    )
})

app.listen(PORT, function() {
    console.log("Servidor corriendo en http://localhost:3000")
})