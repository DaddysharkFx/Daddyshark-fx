const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.json());
app.use(express.static("."));

let ws;

function connect(token) {
    ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

    ws.onopen = () => {
        console.log("Connected to Deriv");

        ws.send(JSON.stringify({
            authorize: token
        }));
    };

    let lastDigit = null;

ws.onmessage = (msg) => {
    let data = JSON.parse(msg.data);

    // After authorization, subscribe to ticks
    if (data.msg_type === "authorize") {
        ws.send(JSON.stringify({
            ticks: "R_100"
        }));
    }

    // Receive ticks
    if (data.msg_type === "tick") {
        let price = data.tick.quote.toString();
        let digit = price[price.length - 1];

        console.log("Last digit:", digit);

        // Simple strategy: if digit is high, predict low
        if (digit > 7) {
            buy("DIGITUNDER", 5);
        }
    }
};

function buy(type, barrier) {
    ws.send(JSON.stringify({
        buy: 1,
        price: 1,
        parameters: {
            amount: 1,
            basis: "stake",
            contract_type: type,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: "R_100",
            barrier: barrier
        }
    }));
}
}

app.post("/connect", (req, res) => {
    connect(req.body.token);
    res.send("Bot started");
});

app.listen(3000, () => console.log("Server running"));
