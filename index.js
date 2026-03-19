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

    ws.onmessage = (msg) => {
        let data = JSON.parse(msg.data);
        console.log(data);
    };
}

app.post("/connect", (req, res) => {
    connect(req.body.token);
    res.send("Bot started");
});

app.listen(3000, () => console.log("Server running"));
