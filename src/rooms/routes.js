const express = require('express');
const Room = require('../models/Room');
const { authenticate } = require('../auth/middleware');

const router = express.Router();

router.get('/public', authenticate, async (req, res) => {
    try {
        const rooms = await Room.find({ isPrivate: false })
            .populate('createdBy', 'username')
            .populate('members.user', 'username')
            .select('-members.role')
            .lean();

        res.json({
            rooms: rooms.map(room => ({
                id: room._id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                memberCount: room.members.length,
                createdAt: room.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching public rooms:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/create', authenticate, async (req, res) => {
    try {
        const { name, description, isPrivate = false } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        const existingRoom = await Room.findOne({ name: name.toLowerCase() });
        if (existingRoom) {
            return res.status(400).json({ error: 'Room name already exists' });
        }

        const room = new Room({
            name: name.toLowerCase(),
            description,
            isPrivate,
            createdBy: req.user._id,
            members: [{
                user: req.user._id,
                role: 'admin'
            }]
        });

        await room.save();
        await room.populate('createdBy', 'username');

        res.status(201).json({
            message: 'Room created successfully',
            room: {
                id: room._id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                isPrivate: room.isPrivate,
                createdAt: room.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;