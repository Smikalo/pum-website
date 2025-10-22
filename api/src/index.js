const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

const app = express();
app.use(express.json({limit: "1mb"}));
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// --- demo in-memory data (replace later with DB) ---
const members = require("./data/members.json");
const projects = require("./data/projects.json");
const events = require("./data/events.json");

app.get("/healthz", (_,res)=>res.json({ok:true, service:"api"}));
app.get("/", (_,res)=>res.send("PUM API is live"));

const bySlug = (arr, slug) => arr.find(x=>x.slug === slug);

// Members list
app.get("/api/members", (req,res)=>{
    const { q, skill, tech, page=1, size=24 } = req.query;
    let items = members.filter(m=>m.visible !== false);
    if (q) {
        const ql = String(q).toLowerCase();
        items = items.filter(m => m.name.toLowerCase().includes(ql) || (m.shortBio||"").toLowerCase().includes(ql));
    }
    if (skill) items = items.filter(m => (m.skills||[]).includes(String(skill)));
    if (tech) items = items.filter(m => (m.techStack||[]).includes(String(tech)));
    const total = items.length;
    const start = (Number(page)-1) * Number(size);
    const slice = items.slice(start, start + Number(size));
    res.json({ items: slice, page: Number(page), size: Number(size), total });
});

app.get("/api/members/:slug", (req,res)=>{
    const m = bySlug(members, req.params.slug);
    if (!m) return res.status(404).json({error:"Not found"});
    const mProjects = (m.projects||[]).map(rel => {
        const p = projects.find(p=>p.id===rel.projectId);
        return p ? {...p, role: rel.role, contribution: rel.contribution} : null;
    }).filter(Boolean);
    res.json({ ...m, projects: mProjects });
});

// Projects
app.get("/api/projects", (req,res)=>{
    const { q, member, tech, event, page=1, size=24 } = req.query;
    let items = projects.slice();
    if (q) {
        const ql = String(q).toLowerCase();
        items = items.filter(p => p.title.toLowerCase().includes(ql) || (p.summary||"").toLowerCase().includes(ql));
    }
    if (member) items = items.filter(p => (p.members||[]).some(r => r.memberId === String(member) || r.memberSlug === String(member)));
    if (tech) items = items.filter(p => (p.techStack||[]).includes(String(tech)));
    if (event) items = items.filter(p => (p.event && (p.event.slug === String(event) || p.event.name === String(event))));
    const total = items.length;
    const start = (Number(page)-1) * Number(size);
    const slice = items.slice(start, start + Number(size));
    res.json({ items: slice, page: Number(page), size: Number(size), total });
});

app.get("/api/projects/:slug", (req,res)=>{
    const p = bySlug(projects, req.params.slug);
    if (!p) return res.status(404).json({error:"Not found"});
    const withMembers = {
        ...p,
        members: (p.members||[]).map(r=>{
            const m = members.find(m=>m.id===r.memberId || m.slug===r.memberSlug);
            return m ? { member: {id:m.id, slug:m.slug, name:m.name, avatarUrl:m.avatarUrl}, role:r.role } : r;
        })
    };
    res.json(withMembers);
});

// Events
app.get("/api/events", (req,res)=>{
    const { q, year } = req.query;
    let items = events.slice();
    if (q) {
        const ql = String(q).toLowerCase();
        items = items.filter(e => e.name.toLowerCase().includes(ql) || (e.locationName||"").toLowerCase().includes(ql));
    }
    if (year) items = items.filter(e => String(e.dateStart).startsWith(String(year)));
    res.json({ items, total: items.length });
});

app.get("/api/events/:slug", (req,res)=>{
    const e = bySlug(events, req.params.slug);
    if (!e) return res.status(404).json({error:"Not found"});
    const eProjects = projects.filter(p => p.event && p.event.slug === e.slug);
    const attendees = members.filter(m => (m.events||[]).some(x=>x.eventSlug === e.slug));
    res.json({ ...e, projects: eProjects, attendees: attendees.map(m=>({id:m.id, slug:m.slug, name:m.name})) });
});

// Search (simple)
app.get("/api/search", (req,res)=>{
    const q = String(req.query.q||"").toLowerCase();
    const mm = members.filter(m => m.name.toLowerCase().includes(q)).map(m=>({type:"member", slug:m.slug, title:m.name}));
    const pp = projects.filter(p => p.title.toLowerCase().includes(q)).map(p=>({type:"project", slug:p.slug, title:p.title}));
    const ee = events.filter(e => e.name.toLowerCase().includes(q)).map(e=>({type:"event", slug:e.slug, title:e.name}));
    res.json({ items: [...mm, ...pp, ...ee] });
});

// Contact
app.post("/api/contact", (req,res)=>{
    const { type, name, email, message } = req.body||{};
    if (!type || !name || !email || !message) return res.status(400).json({error:"Missing fields"});
    const id = Math.random().toString(36).slice(2);
    res.status(201).json({ id, received: true });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, ()=>console.log(`API on :${PORT}`));
