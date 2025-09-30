// src/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true 
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        // Adiciona um validador de formato de e-mail básico (opcional)
        match: [/.+\@.+\..+/, "Por favor, preencha um e-mail válido"] 
    },

    password: {
        type: String,
        required: true
    },
    
    // Novo campo: Nome completo/de exibição do usuário
    name: {
        type: String,
        required: true,
        trim: true
    },

    // Novo campo: Nível de permissão (ex: admin, user, viewer)
    role: {
        type: String,
        enum: ['admin', 'user', 'viewer'], // Enumeração dos papéis permitidos
        default: 'user'
    },

    // Novo campo: Indica se o usuário está em seu primeiro acesso (usado em createTestUser/registerFirstUser)
    isFirstAccess: {
        type: Boolean,
        default: false
    },
}, { 
    timestamps: true // Adiciona createdAt e updatedAt automaticamente
});

module.exports = mongoose.model('User', UserSchema);