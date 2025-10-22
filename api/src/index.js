const express = require("express");
const app = express();
app.get("/healthz", (_,res)=>res.json({ok:true, service:"api"}));
app.get("/", (_,res)=>res.send("PUM API is live"));
app.listen(3001, ()=>console.log("API on :3001"));
