// src/models/Route.js (Adicione o campo 'name')

const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: false,
        trim: true
    },
    route_path: {
        type: String,
        required: true,
        unique: true,
    },
    target_url: {
        type: String,
        required: true,
    },
    check_port: {
        type: Number,
        required: true,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('Route', RouteSchema);