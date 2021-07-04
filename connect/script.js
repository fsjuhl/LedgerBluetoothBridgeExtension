const Transport = require("@ledgerhq/hw-transport-web-ble")
const port = chrome.extension.connect()
const setState = state => document.body.dataset.state = state

let transport
async function connect() {
    setState("connecting")

    try {
        transport = await Transport.default.open("")
        deviceName.innerHTML = transport.device.name

        transport.device.ongattserverdisconnected = disconnect
        await transport.inferMTU()
        setState("connected")
        port.postMessage({ type: "opened" })
    } catch (e) {
        console.log(e)
        setState("connect")
    }
}

port.onMessage.addListener(async info => {
    if (info.type == "exchange") {
        const response = await transport.exchange(Buffer.from(info.data, "hex")).then(res => res.toString("hex"))
        port.postMessage({ type: "exchangeResponse", response })
    }
})

async function disconnect() {
    setState("connect")
    port.postMessage({ type: "closed" })
    await transport.close()
    await Transport.default.disconnect(transport.id)
}

document.getElementById("connect").onclick = connect
document.getElementById("cancel").onclick = disconnect
document.getElementById("disconnect").onclick = disconnect