const { MercadoPagoConfig, Preference } = require("mercadopago")

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
})

async function crearPreferencia(pedido) {
    const { items, pedido_id, usuario_email, back_url } = pedido

    const preference = new Preference(client)

    const resultado = await preference.create({
        body: {
            items: items.map(item => ({
                id: String(item.id),
                title: item.nombre,
                quantity: item.cantidad,
                unit_price: Number(item.precio),
                currency_id: "COP"
            })),
            payer: {
                email: usuario_email
            },
            external_reference: String(pedido_id),
            back_urls: {
                success: back_url + "/src/views/pago-exitoso.html",
                failure: back_url + "/src/views/pago-fallido.html",
                pending: back_url + "/src/views/pago-pendiente.html"
            },
            auto_return: "approved",
            notification_url: process.env.RENDER_URL + "/mp/webhook"
        }
    })

    return resultado
}

module.exports = { crearPreferencia }