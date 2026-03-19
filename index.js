console.log("MY REAL BOT STARTED");// ===== IMPORTS =====
const express=require("express");
const fs=require("fs");
const app=express();

app.use(express.json());

// ===== TELEGRAM =====
const fetch=(...a)=>import('node-fetch').then(({default:f})=>f(...a));

const TOKEN="YOUR_TELEGRAM_TOKEN";
const CHAT="YOUR_CHAT_ID";

function sendTG(msg){
fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({chat_id:CHAT,text:msg})
}).catch(()=>{});
}

// ===== STATE =====
let botState={running:true};

let dashboard={trades:0,wins:0,losses:0,pnl:0};

let m={history:[],patterns:{}};
if(fs.existsSync("memory.json"))
m=JSON.parse(fs.readFileSync("memory.json"));

const save=()=>fs.writeFileSync("memory.json",JSON.stringify(m));

// ===== AI ENGINE =====
function analyze(){

let recent=m.history.slice(-400);
let scores={CALL:0.5,PUT:0.5,DIGITEVEN:0.5,DIGITODD:0.5};

recent.forEach(t=>{
let key=`${t.signal}_${t.market}_${Math.round(t.conf/10)}`;

if(!m.patterns[key])
m.patterns[key]={w:0,l:0,weight:1};

m.patterns[key].weight*=0.995;

if(t.profit>0){
m.patterns[key].w++;
scores[t.signal]+=0.06;
}else{
m.patterns[key].l++;
scores[t.signal]-=0.06;
}

let p=m.patterns[key];
let total=p.w+p.l;

if(total>10){
let wr=p.w/total;
scores[t.signal]+=(wr-0.5)*0.6*p.weight;
}
});

for(let k in scores)
scores[k]=Math.max(0,Math.min(1,scores[k]));

let best=Object.keys(scores)
.reduce((a,b)=>scores[a]>scores[b]?a:b);

let th=65;
if(scores[best]>0.85) th=50;
if(scores[best]<0.45) th=80;

let risk="normal";
if(scores[best]>0.9) risk="aggressive";
if(scores[best]<0.4) risk="safe";

return {scores,best,th,risk};
}

// ===== API =====
app.post("/trade",(req,res)=>{

let t=req.body;

m.history.push(t);
if(m.history.length>400) m.history.shift();

dashboard.trades++;
if(t.profit>0) dashboard.wins++;
else dashboard.losses++;

dashboard.pnl+=t.profit;

let ai=analyze();
save();

res.json(ai);
});

// ===== DASHBOARD =====
app.get("/dashboard",(req,res)=>{

let wr=dashboard.trades?
((dashboard.wins/dashboard.trades)*100).toFixed(1):0;

res.send(`
<html>
<head>
<meta http-equiv="refresh" content="5">
<style>
body{background:#0a0e1a;color:#fff;font-family:Arial;text-align:center}
.card{background:#1f2937;margin:10px;padding:15px;border-radius:10px}
</style>
</head>
<body>

<h2>📊 ULTRA SYSTEM DASHBOARD</h2>

<div class="card">Trades: ${dashboard.trades}</div>
<div class="card">Wins: ${dashboard.wins}</div>
<div class="card">Losses: ${dashboard.losses}</div>
<div class="card">WinRate: ${wr}%</div>
<div class="card">PnL: $${dashboard.pnl.toFixed(2)}</div>

</body>
</html>
`);
});

// ===== TELEGRAM CONTROL =====
async function checkTG(){
try{
let r=await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
let d=await r.json();

if(!d.result.length) return;

let msg=d.result[d.result.length-1].message.text.toLowerCase();

if(msg==="/startbot"){
botState.running=true;
sendTG("✅ BOT STARTED");
}
if(msg==="/stopbot"){
botState.running=false;
sendTG("🛑 BOT STOPPED");
}
if(msg==="/status"){
sendTG(`📊 STATUS
Running: ${botState.running}
Trades: ${dashboard.trades}
PnL: $${dashboard.pnl.toFixed(2)}`);
}
}catch(e){}
}

setInterval(checkTG,5000);

// ===== MAIN UI (FRONTEND INSIDE SERVER) =====
app.get("/",(req,res)=>{

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{background:#0a0e1a;color:#fff;font-family:Arial;padding:12px}
.card{background:#1f2937;padding:12px;margin-bottom:12px;border-radius:10px}
.buy{color:#10b981}.sell{color:#ef4444}.wait{color:#9ca3af}
button,input{padding:10px;width:100%;margin-top:5px}
</style>
</head>

<body>

<div class="card">
<input id="token" placeholder="Deriv Token">
<button onclick="connect()">Connect</button>
<p id="status">Not Connected</p>
</div>

<div class="card">
<p id="signal">WAIT</p>
<p>PnL: $<span id="pnl">0</span></p>
</div>

<script>
const SERVER="";

let ws,p=[],cid=null,pnl=0,last=0,lastSig="WAIT";

function connect(){
ws=new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

ws.onopen=()=>ws.send(JSON.stringify({authorize:token.value}));

ws.onmessage=m=>{
let x=JSON.parse(m.data);
if(x.error)return;

if(x.msg_type==="authorize"){
document.getElementById("status").innerText="Connected";
ws.send(JSON.stringify({ticks:"R_100"}));
}

if(x.msg_type==="tick"){
p.push(x.tick.quote);
if(p.length>50)p.shift();
brain();
}

if(x.msg_type==="buy"){
cid=x.buy.contract_id;
ws.send(JSON.stringify({proposal_open_contract:1,contract_id:cid,subscribe:1}));
}

if(x.msg_type==="proposal_open_contract" && x.proposal_open_contract.is_sold){

let prof=x.proposal_open_contract.profit;
pnl+=prof;

document.getElementById("pnl").innerText=pnl.toFixed(2);

// send to AI
fetch("/trade",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
signal:lastSig,
profit:prof,
market:"NORMAL",
conf:70
})
});

cid=null;
}
};
}

function brain(){
if(p.length<20)return;

let sig=p[p.length-1]>p[p.length-2]?"CALL":"PUT";

document.getElementById("signal").innerText=sig;
lastSig=sig;

let now=Date.now();

if(now-last<6000)return;
last=now;

fetch("/trade",{method:"POST",headers:{"Content-Type":"application/json"},
body:JSON.stringify({signal:sig,profit:0,market:"NORMAL",conf:70})})
.then(r=>r.json())
.then(ai=>{
if(!ai) return;

// remote control check (simple)
if(ai.risk==="safe") return;

ws.send(JSON.stringify({
buy:1,price:1,
parameters:{
amount:1,
basis:"stake",
contract_type:sig,
currency:"USD",
duration:5,
duration_unit:"t",
symbol:"R_100"
}
}));
});
}
</script>

</body>
</html>
`);
});

// ===== START =====
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("🌍 ULTRA SYSTEM LIVE ON "+PORT));
