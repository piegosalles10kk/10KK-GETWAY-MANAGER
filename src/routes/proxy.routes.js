// src/routes/api.routes.js
const express = require('express');
const { 
    dynamicRouter, 
    notFoundFallback 
} = require('../controllers/proxy.controller');

const router = express.Router();

// A rota principal do Gateway: usa o roteador dinâmico para capturar *todas* as rotas.
// Isso simula o roteamento para /api/users, /api/products, etc., de forma unificada.
// O 'dynamicRouter' contém os middlewares de proxy configurados.
router.use('/', dynamicRouter); 

// O Fallback 404: será chamado APENAS se o dynamicRouter não encontrar uma rota configurada.
router.use(notFoundFallback);

module.exports = router;