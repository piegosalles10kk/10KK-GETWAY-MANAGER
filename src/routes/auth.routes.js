// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const { 
    checkFirstAccess,
    registerFirstUser,
    login,
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    createUser, 
    getAllUsers, 
    updateUser, 
    deleteUser 
} = require('../controllers/auth.controller');

// --- ROTAS DE PRIMEIRO ACESSO ---
// GET /api/first-access - Verifica se precisa de registro inicial
router.get('/first-access', checkFirstAccess);

// POST /api/register-first - Registro obrigatório do primeiro usuário
router.post('/register-first', registerFirstUser);

// --- ROTA DE AUTENTICAÇÃO ---
// POST /api/login
router.post('/login', login); 

// --- ROTAS DE RECUPERAÇÃO DE SENHA ---
// POST /api/password-reset/request - Solicita recuperação
router.post('/password-reset/request', requestPasswordReset);

// GET /api/password-reset/validate/:token - Valida token
router.get('/password-reset/validate/:token', validateResetToken);

// POST /api/password-reset/reset - Redefine a senha
router.post('/password-reset/reset', resetPassword);

// --- ROTAS DE GERENCIAMENTO DE USUÁRIOS (CRUD) ---
// POST /api/users
router.post('/users', createUser);

// GET /api/users
router.get('/users', getAllUsers);

// PUT /api/users/:id
router.put('/users/:id', updateUser);

// DELETE /api/users/:id
router.delete('/users/:id', deleteUser);

module.exports = router;