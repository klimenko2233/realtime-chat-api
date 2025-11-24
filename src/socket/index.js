const { authenticateSocket } = require('../auth/middleware');
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');

const onlineUsers = new Map();

module.exports = (io) => {
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.username} (${socket.userId})`);

        User.findByIdAndUpdate(socket.userId, {
            online: true,
            lastSeen: new Date()
        }).exec();

        onlineUsers.set(socket.userId, {
            id: socket.userId,
            username: socket.username,
            socketId: socket.id,
            connectedAt: new Date()
        });

        socket.emit('welcome', {
            message: `Welcome, ${socket.username}!`,
            user: socket.user,
            onlineUsers: Array.from(onlineUsers.values()),
            timestamp: new Date().toISOString()
        });

        socket.broadcast.emit('user_joined', {
            user: {
                id: socket.userId,
                username: socket.username,
            },
            onlineUsers: Array.from(onlineUsers.values()),
            message: `${socket.username} joined the chat`,
            timestamp: new Date().toISOString()
        });

        socket.on('send_message', async (data) => {
            try {
                console.log('Message from:', socket.username, data);

                const message = await Message.create({
                    content: data.text,
                    room: data.room || 'general',
                    sender: socket.userId,
                    senderUsername: socket.username
                });

                const messageData = {
                    id: message.id,
                    userId: socket.userId,
                    username: socket.username,
                    text: data.text,
                    timestamp: message.createdAt,
                    room: data.room || 'general'
                };

                const targetRoom = data.room || 'general';
                socket.to(targetRoom).emit('new_message', messageData);

                socket.emit('new_message', {
                    ...messageData,
                    isOwn: true
                });
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('join_room',async (roomData) => {
            try {
                const roomName = roomData.name;
                socket.join(roomName);

                let room = await Room.findByName(roomName);
                if (!room) {
                    room = await Room.create({
                        name: roomName,
                        createdBy: socket.userId,
                        description: roomData.description || `Room ${roomName}`
                    });
                }

                console.log(`User ${socket.username} joined room ${roomName}`);

                const messageHistory = await Message.getRoomHistory(roomName);

                socket.emit('room_history', {
                    room: roomName,
                    messages: messageHistory.reverse()
                });

                socket.to(roomName).emit('user_joined_room', {
                    room: roomName,
                    user: {
                        id: socket.userId,
                        username: socket.username
                    },
                    message: `${socket.username} joined the room`,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error(`Error joining room ${roomData.name}:`, error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        socket.on('leave_room', (roomData) => {
            socket.leave(roomData.name);
            socket.to(roomData.name).emit('user_left_room', {
                room: roomData.name,
                user: {
                    id: socket.userId,
                    username: socket.username
                },
                message: `${socket.username} left the room`,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('get_online_users', () => {
            socket.emit('online_users', Array.from(onlineUsers.values()));
        });

        socket.on('disconnect',async (reason) => {
            console.log(`User disconnected: ${socket.username} (${socket.id}), reason: ${reason}`);

            await User.findByIdAndUpdate(socket.userId, {
                online: false,
                lastSeen: new Date()
            }).exec();

            onlineUsers.delete(socket.userId);

            socket.broadcast.emit('user_left', {
                user: {
                    id: socket.userId,
                    username: socket.username
                },
                onlineUsers: Array.from(onlineUsers.values()),
                message: `${socket.username} left the chat`,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('error', (error) => {
            console.error(`Socket error (${socket.username}):`, error);
        });
    })
}