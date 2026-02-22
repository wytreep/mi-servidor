const express = require("express")

const mysql = require("mysql2")
const app = express()
const cors = require("cors")
app.use(cors())
const authRoutes = require("./auth")
const verificarToken = require("./middleware")
const PORT = 3000

app.use(express.json())

const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "tienda"
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
app.post("/productos", verificarToken, function(req, res) {
    let { nombre, precio, stock } = req.body
    conexion.query(
        "INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)",
        [nombre, precio, stock],
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
app.put("/productos/:id", verificarToken, function(req, res) {
    let id = req.params.id
    let { nombre, precio, stock } = req.body
    conexion.query(
        "UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?",
        [nombre, precio, stock, id],
        function(error, resultado) {
            if (error) {
                res.status(500).json({ error: "Error al actualizar" })
                return
            }
            res.json({ mensaje: "Producto actualizado" })
        }
    )
})

// Eliminar producto
app.delete("/productos/:id", verificarToken, function(req, res) {
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

app.listen(PORT, function() {
    console.log("Servidor corriendo en http://localhost:3000")
})