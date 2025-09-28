// src/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: { // Apenas para fins de teste, use criptografia em produção!
        type: String,
        required: true
    }
});

module.exports = mongoose.model('User', UserSchema);