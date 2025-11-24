const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    room: {
        type: String,
        required: true,
        default: 'general'
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

messageSchema.statics.getRoomHistory = function (roomName, limit = 50) {
    return this.find({ room: roomName})
        .populate('sender', 'username')
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
};

module.exports = mongoose.model('Message', messageSchema);