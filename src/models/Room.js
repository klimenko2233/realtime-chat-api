const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    description: {
        type: String,
        maxlength: 200
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        role: {
            type: String,
            enum: ['admin', 'member','moderator'],
            default: 'member'
        }
    }],
    settings: {
        maxMembers: {
            type: Number,
            default: 100
        },
        allowGuests: {
            type: Boolean,
            default: false
        }
    }
}, { timestamps: true });

roomSchema.statics.findByName = function (name) {
    return this.findOne({ name: name.toLowerCase() });
};

roomSchema.statics.getPublicRooms = function () {
    return this.find({ isPrivate: false })
        .populate('createdBy', 'username')
        .populate('members.user', 'username')
        .exec();
};

module.exports = mongoose.model('Room', roomSchema);