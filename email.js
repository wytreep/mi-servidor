const { Resend } = require("resend")
const resend = new Resend(process.env.RESEND_API_KEY)

async function enviarConfirmacionPedido(pedido) {
    const { email, nombre, id, total, items, tipo_envio, destinatario, direccion, ciudad, departamento, barrio } = pedido
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px">${item.nombre}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:center">${item.cantidad}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;font-weight:600">$${Number(item.precio * item.cantidad).toLocaleString()}</td>
        </tr>
    `).join("")

    const direccionHtml = tipo_envio === "nacional"
        ? `${direccion}, ${barrio}, ${ciudad}, ${departamento}`
        : `${direccion}, ${barrio} (Entrega local)`

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f0f4f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,34,71,0.1)">
            
            <!-- Header -->
            <div style="background:linear-gradient(120deg,#0d2247 0%,#1a4480 60%,#2560a8 100%);padding:32px 28px;text-align:center">
                <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Confirmación de pedido</div>
                <div style="font-size:28px;font-weight:700;color:#fff">¡Gracias, ${nombre}!</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px">Tu pedido ha sido recibido correctamente</div>
                <div style="display:inline-block;margin-top:16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 20px">
                    <span style="color:#e8c06a;font-size:12px;letter-spacing:1px">PEDIDO #${id}</span>
                </div>
            </div>

            <!-- Productos -->
            <div style="padding:24px 28px 0">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Resumen del pedido</div>
                <table style="width:100%;border-collapse:collapse;background:#fafbfd;border-radius:10px;overflow:hidden;border:1px solid #dde3ec">
                    <thead>
                        <tr style="background:#f0f4f9">
                            <th style="padding:10px 16px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Producto</th>
                            <th style="padding:10px 16px;text-align:center;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cant.</th>
                            <th style="padding:10px 16px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                    <tfoot>
                        <tr style="background:#f0f4f9">
                            <td colspan="2" style="padding:12px 16px;font-weight:700;font-size:14px;color:#0d2247">Total</td>
                            <td style="padding:12px 16px;font-weight:700;font-size:18px;color:#0d2247;text-align:right">$${Number(total).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Dirección -->
            <div style="padding:20px 28px 0">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Datos de entrega</div>
                <div style="background:#f8fafc;border:1px solid #dde3ec;border-radius:10px;padding:14px 16px;font-size:13px;color:#334155;line-height:1.7">
                    <div><strong>${destinatario || nombre}</strong></div>
                    <div>📍 ${direccionHtml}</div>
                    <div style="margin-top:6px">
                        <span style="background:${tipo_envio === 'nacional' ? '#dbeafe' : '#e4f5ec'};color:${tipo_envio === 'nacional' ? '#1e40af' : '#1e7d4e'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">
                            ${tipo_envio === 'nacional' ? '🚚 Envío nacional' : '🏪 Entrega local'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Estado -->
            <div style="padding:20px 28px 0">
                <div style="background:#fff9e6;border:1px solid #fcd34d;border-radius:10px;padding:14px 16px;font-size:13px;color:#92400e">
                    ⏳ Tu pedido está <strong>pendiente</strong> — te notificaremos cuando sea procesado.
                </div>
            </div>

            <!-- Footer -->
            <div style="padding:24px 28px;text-align:center;margin-top:8px">
                <div style="font-size:12px;color:#94a3b8;line-height:1.6">
                    Si tienes alguna pregunta sobre tu pedido, responde a este correo.<br>
                    <strong style="color:#64748b">¡Gracias por tu compra!</strong>
                </div>
            </div>

        </div>
    </body>
    </html>
    `

    await resend.emails.send({
        from: "Tu Tienda <onboarding@resend.dev>",
        to: email,
        subject: `✅ Pedido #${id} confirmado — $${Number(total).toLocaleString()}`,
        html
    })
}

async function enviarActualizacionEstado(pedido) {
    const { email, nombre, id, estado } = pedido

    const mensajes = {
        procesando: { emoji: "⚙️", texto: "Tu pedido está siendo procesado", color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
        empacado:   { emoji: "📦", texto: "Tu pedido ya fue empacado", color: "#7e22ce", bg: "#f3e8ff", border: "#c4b5fd" },
        enviado:    { emoji: "🚚", texto: "Tu pedido está en camino", color: "#1e40af", bg: "#dbeafe", border: "#93c5fd" },
        entregado:  { emoji: "✅", texto: "Tu pedido fue entregado", color: "#1e7d4e", bg: "#e4f5ec", border: "#86efac" },
        cancelado:  { emoji: "❌", texto: "Tu pedido fue cancelado", color: "#c0392b", bg: "#fdecea", border: "#fca5a5" }
    }

    const info = mensajes[estado]
    if (!info) return

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#f0f4f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,34,71,0.1)">
            <div style="background:linear-gradient(120deg,#0d2247,#1a4480);padding:28px;text-align:center">
                <div style="font-size:36px">${info.emoji}</div>
                <div style="font-size:20px;font-weight:700;color:#fff;margin-top:10px">${info.texto}</div>
                <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px">Pedido #${id}</div>
            </div>
            <div style="padding:28px;text-align:center">
                <p style="font-size:15px;color:#334155">Hola <strong>${nombre}</strong>, tu pedido ha cambiado de estado:</p>
                <div style="display:inline-block;margin:16px auto;background:${info.bg};border:1px solid ${info.border};border-radius:8px;padding:10px 24px;color:${info.color};font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.5px">
                    ${info.emoji} ${estado}
                </div>
                <p style="font-size:13px;color:#94a3b8;margin-top:8px">¿Preguntas? Responde a este correo.</p>
            </div>
        </div>
    </body>
    </html>
    `

    await resend.emails.send({
        from: "Tu Tienda <onboarding@resend.dev>",
        to: email,
        subject: `${info.emoji} Pedido #${id} — ${estado}`,
        html
    })
}

module.exports = { enviarConfirmacionPedido, enviarActualizacionEstado }