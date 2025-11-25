const { authenticateSocket } = require('../auth/middleware');
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');

const onlineUsers = new Map();

module.exports = (io) => {

    const getAllRooms = async () => {
        try {
            const rooms = await Room.find({})
                .populate('createdBy', 'username')
                .lean();

            const roomsWithUserCount = await Promise.all(rooms.map(async (room) => {
                try {
                    const sockets = await io.in(room.name).fetchSockets();
                    return {
                        name: room.name,
                        description: room.description,
                        createdAt: room.createdAt,
                        userCount: sockets.length,
                        isPrivate: room.isPrivate
                    };
                } catch (error) {
                    console.error(`Error counting users in room ${room.name}:`, error);
                    return {
                        ...room,
                        userCount: 0
                    };
                }
            }));

            return roomsWithUserCount;
        } catch (error) {
            console.error('Error fetching rooms from database:', error);
            return [];
        }
    };

    const broadcastRoomsUpdate = async () => {
        try {
            const rooms = await getAllRooms();
            console.log('Broadcasting rooms update:', rooms.map(r => r.name));
            io.emit('rooms_updated', rooms);
        } catch (error) {
            console.error('Error broadcasting rooms update:', error);
        }
    };

    const sendRoomsToUser = async (socket) => {
        try {
            const rooms = await getAllRooms();
            console.log('Sending rooms to user:', rooms.map(r => r.name));
            socket.emit('rooms_updated', rooms);
        } catch (error) {
            console.error('Error sending rooms to user:', error);
        }
    };

    io.use(authenticateSocket);

    io.on('connection', async (socket) => {
        console.log(`User connected: ${socket.username} (${socket.userId})`);

        try {
            await User.findByIdAndUpdate(socket.userId, {
                online: true,
                lastSeen: new Date()
            });

            onlineUsers.set(socket.userId, {
                id: socket.userId,
                username: socket.username,
                socketId: socket.id,
                connectedAt: new Date()
            });

            socket.join('general');
            socket.currentRoom = 'general';

            let generalRoom = await Room.findOne({ name: 'general' });
            if (!generalRoom) {
                generalRoom = new Room({
                    name: 'general',
                    description: 'General chat room',
                    createdBy: socket.userId,
                    members: [{
                        user: socket.userId,
                        role: 'admin'
                    }]
                });
                await generalRoom.save();
                console.log('Created general room');
            }

            await sendRoomsToUser(socket);

            socket.emit('welcome', {
                message: `Welcome, ${socket.username}!`,
                user: {
                    id: socket.userId,
                    username: socket.username
                },
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

            const messageHistory = await Message.find({ room: 'general' })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('sender', 'username')
                .lean();

            const formattedHistory = messageHistory.reverse().map(msg => ({
                id: msg._id,
                userId: msg.sender?._id?.toString() || msg.sender?.toString(),
                username: msg.sender?.username || 'Unknown',
                text: msg.content,
                timestamp: msg.createdAt.toISOString(),
                room: msg.room
            }));

            socket.emit('room_joined', {
                room: 'general',
                messages: formattedHistory,
                roomInfo: {
                    name: 'general',
                    description: 'General chat room'
                }
            });

            await broadcastRoomsUpdate();

        } catch (error) {
            console.error('Error during connection setup:', error);
            socket.emit('error', { message: 'Connection setup failed' });
        }

        socket.on('send_message', async (data) => {
            try {
                if (!data.text || data.text.trim().length === 0) {
                    socket.emit('error', { message: 'Message cannot be empty' });
                    return;
                }

                if (data.text.length > 1000) {
                    socket.emit('error', { message: 'Message too long' });
                    return;
                }

                const message = new Message({
                    content: data.text.trim(),
                    room: data.room || 'general',
                    sender: socket.userId
                });

                await message.save();
                await message.populate('sender', 'username');

                const messageData = {
                    id: message._id,
                    userId: socket.userId,
                    username: socket.username,
                    text: message.content,
                    timestamp: message.createdAt.toISOString(),
                    room: message.room
                };

                io.to(message.room).emit('new_message', messageData);

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('join_room', async (roomData) => {
            try {
                const roomName = roomData.name.trim().toLowerCase();

                if (!roomName) {
                    socket.emit('error', { message: 'Room name is required' });
                    return;
                }

                if (socket.currentRoom && socket.currentRoom !== roomName) {
                    socket.leave(socket.currentRoom);

                    socket.to(socket.currentRoom).emit('user_left_room', {
                        room: socket.currentRoom,
                        user: {
                            id: socket.userId,
                            username: socket.username
                        },
                        message: `${socket.username} left the room`,
                        timestamp: new Date().toISOString()
                    });
                }

                socket.join(roomName);
                socket.currentRoom = roomName;

                let room = await Room.findOne({ name: roomName });

                if (!room) {
                    room = new Room({
                        name: roomName,
                        createdBy: socket.userId,
                        description: roomData.description || `Room ${roomName}`,
                        members: [{
                            user: socket.userId,
                            role: 'admin'
                        }]
                    });
                    await room.save();
                    console.log(`Created new room: ${roomName}`);
                }

                const isMember = room.members.some(member =>
                    member.user.toString() === socket.userId.toString()
                );

                if (!isMember) {
                    room.members.push({
                        user: socket.userId,
                        role: 'member'
                    });
                    await room.save();
                }

                const messageHistory = await Message.find({ room: roomName })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .populate('sender', 'username')
                    .lean();

                const formattedHistory = messageHistory.reverse().map(msg => ({
                    id: msg._id,
                    userId: msg.sender?._id?.toString() || msg.sender?.toString(),
                    username: msg.sender?.username || 'Unknown',
                    text: msg.content,
                    timestamp: msg.createdAt.toISOString(),
                    room: msg.room
                }));

                socket.emit('room_joined', {
                    room: roomName,
                    messages: formattedHistory,
                    roomInfo: {
                        name: room.name,
                        description: room.description,
                        createdAt: room.createdAt,
                        createdBy: room.createdBy
                    }
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

                await broadcastRoomsUpdate();

            } catch (error) {
                console.error(`Error joining room ${roomData.name}:`, error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        socket.on('get_rooms', async () => {
            await sendRoomsToUser(socket);
        });

        socket.on('get_online_users', () => {
            socket.emit('online_users', Array.from(onlineUsers.values()));
        });

        socket.on('disconnect', async (reason) => {
            console.log(`User disconnected: ${socket.username} (${socket.id}), reason: ${reason}`);

            try {
                await User.findByIdAndUpdate(socket.userId, {
                    online: false,
                    lastSeen: new Date()
                });

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

                await broadcastRoomsUpdate();

            } catch (error) {
                console.error('Error during disconnect cleanup:', error);
            }
        });

        socket.on('error', (error) => {
            console.error(`Socket error (${socket.username}):`, error);
        });
    });

    setInterval(() => {
        broadcastRoomsUpdate();
    }, 30000);

    console.log('Socket.io handlers configured successfully');
};