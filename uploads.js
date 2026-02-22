const multer = require("multer")
const path = require("path")

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "public/imagenes/")
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
})

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const tipos = /jpeg|jpg|png|webp/
        const valido = tipos.test(path.extname(file.originalname).toLowerCase())
        if (valido) cb(null, express.static)
        else cb(new Error("Solo se permiten imágenes"))
    }
})

module.exports = upload