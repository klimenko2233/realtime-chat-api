const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
    try {
        const token = extractTokenFromHeader(req.headers.authorization);

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Error during authentication:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return next(new Error('Invalid token'));
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return next(new Error('User not found'));
        }

        socket.user = user;
        socket.userId = user.id;
        socket.username = user.username;
        next();
    } catch (error) {
        next(new Error('Authentication failed'))
    }
};

module.exports = { authenticate, authenticateSocket };
