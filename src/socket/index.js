module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`New client connected: ${socket.id}`);

        socket.emit('welcome', {
            message: 'Welcome to the Real-time Chat API!',
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });

        socket.broadcast.emit('user_joined', {
            socketId: socket.id,
            message: 'A new user has joined the chat!',
            timestamp: new Date().toISOString()
        });

        socket.on('send_message', (data) => {
            console.log('Received message:', data);

            io.emit('new_message', {
                id: Date.now(),
                socketId: socket.id,
                text: data.text,
                username: data.username || 'Anonymous',
                timestamp: new Date().toISOString()
            });
        });

        socket.on('create_room', (roomData) => {
            console.log('Creating room:', roomData);

            socket.join(roomData.name);

            io.to(roomData.name).emit('room_created', {
                room: roomData.name,
                createdBy: socket.id,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('disconnect', (reason) => {
            console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);

            socket.broadcast.emit('user_left', {
                socketId: socket.id,
                message: 'A user has left the chat.',
                timestamp: new Date().toISOString()
            });
        });

        socket.on('error', (error) => {
            console.error(`Socket error (${socket.id}):`, error);
        });
    });
};