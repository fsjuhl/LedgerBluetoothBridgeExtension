const { Buffer } = require('buffer');
class BluetoothBridgeTransport {
    constructor() {
        this.default = this
        this.queue = []
        this.syncInterval = 1000
        this.interval = null
        this.state = "closed"

        this.startSync()
    }

    startSync() {
        const _this = this
        const handleMessage = async message => {
            console.log(message)
            if (message.type == "opened") {
                _this.state = "open"
            } else if (message.type == "closed") {
                _this.state = "closed"
            } else if (message.type == "exchangeResponse") {
                _this.hook.resolveExchange(Buffer.from(message.response, "hex"))
            }
        }
        const sync = async () => {
            const messages = btoa(JSON.stringify(_this.queue))
            _this.queue = []

            try {
                const messagesRecieved = await fetch(`https://ledgerbluetoothbridge.example.com/${messages}`)
                    .then(res => JSON.parse(atob(res.url.replace("data:text/plain;base64,", ""))))
    
                messagesRecieved.forEach(handleMessage)
            } catch (err) {
                console.error(err)
                _this.stopSync()
            }
        }

        this.interval = setInterval(sync, this.syncInterval)
    }

    stopSync() {
        clearInterval(this.interval)
    }

    async send(data) {
        this.queue.push(data)
    }

    async connect() {
        this.state = "connecting"
        this.send({ type: "open" })
    }

    async check(unusedBridgeURL) {
        if (this.state == "closed") await this.connect()
        if (this.state != "open") throw new Error("Not open")
    }

    async open(unusedBridgeURL) {
        this.hook = {
            resolveExchange: _b => {},
            rejectExchange: _e => {},
            onDisconnect: () => {},
            close: () => this.send({ type: "closed" }),
            send: msg => this.send({ type: "exchange", data: msg })
        }

        return new _WebSocketTransport.default(this.hook)
    }
}

var _WebSocketTransport2 = new BluetoothBridgeTransport()