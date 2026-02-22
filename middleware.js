const jwt = require("jsonwebtoken")
const SECRET = "mi_clave_secreta_2026"

function verificarToken(req, res, next) {
    const token = req.headers["authorization"]

    if (!token) {
        return res.status(401).json({ error: "Acceso denegado, token requerido" })
    }

    try {
        const decoded = jwt.verify(token, SECRET)
        req.usuario = decoded
        next()
    } catch (error) {
        res.status(401).json({ error: "Token inválido o expirado" })
    }
}

module.exports = verificarToken