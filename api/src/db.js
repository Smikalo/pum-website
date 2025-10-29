// api/src/db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query','info','warn','error'],
});
module.exports = { prisma };
