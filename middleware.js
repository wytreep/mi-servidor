const jwt = require("jsonwebtoken")
const SECRET = process.env.JWT_SECRET
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

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== "admin") {
        return res.status(403).json({ error: "Acceso prohibido, se requiere rol de administrador" })
    }
    next()
}

module.exports = { verificarToken, soloAdmin }