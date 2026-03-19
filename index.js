const WebSocket = require("ws");

let token = "";
let ws;

let stake = 0.35;
let stopLoss = 10;
let takeProfit = 15;

let profit = 0;
let running = false;

function connect(apiToken){
    token = apiToken;

    ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=1089`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if(data.msg_type === "authorize"){
            console.log("CONNECTED");
            running = true;

            ws.send(JSON.stringify({
                ticks: "R_100",
                subscribe: 1
            }));
        }

        if(data.msg_type === "tick" && running){
            let digit = parseInt(data.tick.quote.toString().slice(-1));

            // SIMPLE LOGIC
            if(digit >= 5){
                trade("PUT");
            } else {
                trade("CALL");
            }
        }

        if(data.msg_type === "buy"){
            console.log("TRADE PLACED");
        }

        if(data.msg_type === "proposal_open_contract"){
            let pnl = data.proposal_open_contract.profit || 0;

            profit = pnl;

            console.log("PnL:", profit);

            if(profit <= -stopLoss){
                console.log("STOP LOSS HIT");
                running = false;
                ws.close();
            }

            if(profit >= takeProfit){
                console.log("TAKE PROFIT HIT");
                running = false;
                ws.close();
            }
        }
    };
}

function trade(type){
    ws.send(JSON.stringify({
        buy: 1,
        price: stake,
        parameters: {
            amount: stake,
            basis: "stake",
            contract_type: type,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: "R_100"
        }
    }));
}

module.exports = { connect };
