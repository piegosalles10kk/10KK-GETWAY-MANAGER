// src/models/PasswordReset.js (VERSÃO CORRIGIDA)

const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    
    email: {
        type: String,
        required: true,
        lowercase: true
    },

    token: {
        type: String,
        required: true,
        unique: true
    },

    // O campo é requerido, mas será preenchido no Controller
    expiresAt: {
        type: Date,
        required: true, 
        // Indexa para exclusão automática pelo MongoDB após 1 hora
        index: { expires: '1h' } 
    },
    
    // Indica se o token já foi usado
    used: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true 
});


module.exports = mongoose.model('PasswordReset', PasswordResetSchema);