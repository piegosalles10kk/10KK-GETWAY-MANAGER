// src/routes/routeAdmin.routes.js
const express = require('express');
const router = express.Router();

const { 
    createRoute, 
    getAllRoutes, 
    getRouteById, 
    updateRoute, 
    deleteRoute,
    discoverAvailablePorts 
} = require('../controllers/admin.controller'); 

// --- Rota de Descoberta ---
// GET /admin/discover
router.get('/discover', discoverAvailablePorts); 

// Rotas de CRUD para gerenciar as rotas do Gateway
// O Middleware de autenticação de admin (ex: verifyToken, isAdmin) iria aqui
router.post('/routes', createRoute);      // POST /admin/routes
router.get('/routes', getAllRoutes);       // GET /admin/routes
router.get('/routes/:id', getRouteById);  // GET /admin/routes/:id
router.put('/routes/:id', updateRoute);    // PUT /admin/routes/:id
router.delete('/routes/:id', deleteRoute); // DELETE /admin/routes/:id

module.exports = router;