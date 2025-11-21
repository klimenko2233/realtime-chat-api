const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "http://localhost:3001"],
            connectSrc: ["'self'", "ws://localhost:3001", "http://localhost:3001"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],        }
    },
    crossOriginEmbedderPolicy: false
}))

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-client.html'));
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Real-time Chat API'
    });
});

require('./socket')(io);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Real-time Chat API is running on port ${PORT}`);
    console.log('Websocket server ready to accept connections')
    console.log(`Health check available at http://localhost:${PORT}/health`)
    console.log(`Test client: http://localhost:${PORT}/test`);
});

module.exports = { app, server, io };
