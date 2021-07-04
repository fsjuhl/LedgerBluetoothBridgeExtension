let debug = true,
    messagesToSend = [],
    tabId,
    tabPort,
    connectionPromise,
    modifiedScript

fetch("https://metamask.github.io/eth-ledger-bridge-keyring/bundle.js")
    .then(res => res.text())
    .then(async script => {
        const modification = await fetch(chrome.runtime.getURL("modification.js"))
            .then(res => res.text())
        
        script = script
            .replace("var _WebSocketTransport2 = _interopRequireDefault(_WebSocketTransport);", modification)
            .replace("window.open('ledgerlive://bridge?appName=Ethereum');", "")

        modifiedScript = { redirectUrl: "data:text/javascript," + encodeURIComponent(script) }

        console.log("Successfully modified bundle")
    })

const handleMessage = async message => {
    if (typeof message == "string") return
    if (message.type == "open") {
        openConnectionTab()
    } else if (message.type == "exchange") {
        if (tabPort) {
            tabPort.postMessage(message)
        } else {
            await new Promise(resolve => connectionPromise = resolve)
            tabPort.postMessage(message)
        }
    }
}
const sendMessage = message => messagesToSend.push(message)

chrome.webRequest.onBeforeRequest.addListener(request => {
    if (request.url == "https://metamask.github.io/eth-ledger-bridge-keyring/bundle.js") {
        if (debug && request.frameId != 0) console.log(`Injected modified bundle`)
        return request.frameId != 0 ? modifiedScript : { cancel: false }
    } else {
        const input = JSON.parse(atob(request.url.split(".com/")[1]))
        input.forEach(handleMessage)

        if (debug && input.length > 0 || messagesToSend.length > 0) console.log(`BluetoothBridgeTransport: Got messages ${JSON.stringify(input)} | Sending messages ${JSON.stringify(messagesToSend)}`)
        const output = btoa(JSON.stringify(messagesToSend))
        messagesToSend = []

        return { redirectUrl: `data:text/plain;base64,${output}` }
    }
}, { urls: [
    "https://metamask.github.io/eth-ledger-bridge-keyring/bundle.js",
    "https://ledgerbluetoothbridge.example.com/*"
] }, ["blocking"])

async function openConnectionTab() {
    if (debug) console.log(`Opening Bridge tab`)
    if (tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true })
            tabPort.postMessage({ type: "open" })
            return
        } catch (e) {
            console.error("good error", e)
        }
    }

    chrome.tabs.create({ url: chrome.extension.getURL("connect/index.html") }, tab => {
        tabId = tab.id
    })
}

chrome.runtime.onConnect.addListener(port => {
    if (port.sender.tab.id == tabId) {
        tabPort = port
        port.onDisconnect.addListener(() => { tabPort = null; sendMessage({ type: "closed" }) })
        port.onMessage.addListener(info => {
            if (debug) console.log(`Message from Bridge tab: ${JSON.stringify(info)}`)
            sendMessage(info)
            if (connectionPromise) connectionPromise()
        })
    }
})