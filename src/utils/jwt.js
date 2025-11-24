const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret-for-development';
const JWT_EXPIRES_IN = '24h';

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

function extractTokenFromHeader(authHeader) {
    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

module.exports = {
    generateToken,
    verifyToken,
    extractTokenFromHeader,
    JWT_SECRET
};