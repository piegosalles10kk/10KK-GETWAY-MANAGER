// src/controllers/auth.controller.js
const User = require('../models/User');
const bcrypt = require('bcryptjs'); 

// Função de ajuda para gerar uma senha aleatória simples
const generateRandomPassword = (length = 8) => {
    return Math.random().toString(36).slice(-length);
};

// --- FUNÇÃO 1: FUNÇÃO DE LOGIN ---

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: "Usuário ou senha inválidos." });
        }

        // Compara a senha fornecida (texto puro) com o hash no DB
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Usuário ou senha inválidos." });
        }

        // Sucesso: Gera um token de simulação
        const fakeToken = `fake-jwt-token-${user._id}-${new Date().getTime()}`;
        
        return res.status(200).json({ 
            message: "Login bem-sucedido. Bem-vindo!",
            token: fakeToken,
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

// --- FUNÇÃO 2: FUNÇÃO DE CRIAÇÃO DO USUÁRIO DE TESTE ---

const createTestUser = async () => {
    try {
        const username = 'admin';
        const existingUser = await User.findOne({ username });
        
        if (!existingUser) {
            const randomPassword = generateRandomPassword(8);
            
            // Criptografa a senha antes de salvar
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);
            
            const newUser = new User({
                username: username,
                password: hashedPassword 
            });
            
            await newUser.save();
            
            console.log(`\n======================================================`);
            console.log(`🛠️ Usuário de teste '${username}' criado com sucesso.`);
            console.log(`🔐 Senha temporária: ${randomPassword}`);
            console.log(`======================================================`);
            
            return { username, password: randomPassword };
        }
    } catch (error) {
        console.error("Erro ao criar usuário de teste:", error.message);
    }
    return null; 
};

// --- FUNÇÕES DE CRUD DE USUÁRIOS ---

/**
 * Cria um novo Usuário (POST /api/users)
 */
const createUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username: username,
            password: hashedPassword
        });
        
        await newUser.save();
        
        res.status(201).json({ message: "Usuário criado com sucesso.", user: { username: newUser.username, _id: newUser._id } });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "Nome de usuário já existe." });
        }
        res.status(500).json({ message: "Erro ao criar usuário.", error: err.message });
    }
};

/**
 * Retorna todos os Usuários (GET /api/users)
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclui a senha
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar usuários.", error: err.message });
    }
};

/**
 * Atualiza um Usuário (PUT /api/users/:id)
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Se a senha for passada, faça o hash antes de atualizar
        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }
        
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }
        
        res.status(200).json({ message: "Usuário atualizado com sucesso.", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar usuário.", error: err.message });
    }
};

/**
 * Deleta um Usuário (DELETE /api/users/:id)
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        res.status(200).json({ message: "Usuário deletado com sucesso." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao deletar usuário.", error: err.message });
    }
};


module.exports = {
    login,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createTestUser
};