// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const { 
    login, 
    createUser, 
    getAllUsers, 
    updateUser, 
    deleteUser 
} = require('../controllers/auth.controller');

// --- ROTA DE AUTENTICAÇÃO ---

// POST /api/login
router.post('/login', login); 


// --- ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD) ---
// Em uma aplicação real, estas rotas teriam middlewares de autenticação
// e autorização (ex: garantir que apenas um Admin possa acessar)

// POST /api/users
router.post('/users', createUser);     // Criar Usuário

// GET /api/users
router.get('/users', getAllUsers);     // Listar Usuários

// PUT /api/users/:id
router.put('/users/:id', updateUser);  // Atualizar Usuário

// DELETE /api/users/:id
router.delete('/users/:id', deleteUser); // Deletar Usuário

module.exports = router;