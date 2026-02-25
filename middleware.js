const jwt = require("jsonwebtoken")

function verificarToken(req, res, next) {
    const token = req.headers["authorization"]
    if (!token) return res.status(401).json({ error: "Acceso denegado, token requerido" })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.usuario = decoded
        next()
    } catch (error) {
        res.status(401).json({ error: "Token inválido" })
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== "admin" && req.usuario.rol !== "superadmin") {
        return res.status(403).json({ error: "Acceso denegado" })
    }
    next()
}

function soloSuperAdmin(req, res, next) {
    if (req.usuario.rol !== "superadmin") {
        return res.status(403).json({ error: "Solo el administrador principal puede hacer esto" })
    }
    next()
}

module.exports = { verificarToken, soloAdmin, soloSuperAdmin }