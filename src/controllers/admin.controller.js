// src/controllers/admin.controller.js
const Route = require('../models/Route');
const portscanner = require('portscanner');
const { setupGatewayRoutes } = require('./proxy.controller'); 
// const bcrypt = require('bcryptjs'); // Mantido se usado em outras partes


// --- Funções de Ajuda ---

const generateRandomPath = (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
};

// --- Checagem de Saúde (Health Check) ---
const checkRouteHealth = async (routes) => {
    const HOST = process.env.PORT_CHECK_HOST || '127.0.0.1';
    
    // Mapeia e executa todas as checagens em paralelo
    const routesWithHealth = await Promise.all(routes.map(async (route) => {
        let isHealthy = false;
        
        if (route.is_active && route.check_port) {
            try {
                const status = await portscanner.checkPortStatus(route.check_port, HOST);
                isHealthy = (status === 'open');
            } catch (e) {
                isHealthy = false;
            }
        }

        // Retorna a rota com o novo campo 'is_healthy'
        return { 
            ...route.toObject(),
            is_healthy: isHealthy 
        };
    }));

    return routesWithHealth;
};


// --- CRUD DE ROTAS: Descoberta de Portas ---
const discoverAvailablePorts = async (req, res) => {
    try {
        const ALL_PORTS_TO_CHECK = [3000, 3001, 3002, 3003, 4000, 4001, 8080, 8081]; 
        const HOST = process.env.PORT_CHECK_HOST || '127.0.0.1';
        
        const registeredRoutes = await Route.find().select('check_port');
        const registeredPorts = registeredRoutes.map(r => r.check_port);
        
        const availableActivePorts = [];

        for (const port of ALL_PORTS_TO_CHECK) {
            const status = await portscanner.checkPortStatus(port, HOST);
            
            if (status === 'open' && !registeredPorts.includes(port)) {
                availableActivePorts.push(port);
            }
        }

        res.status(200).json(availableActivePorts);

    } catch (error) {
        console.error("Erro na descoberta de portas:", error);
        res.status(500).json({ message: "Erro ao escanear portas." });
    }
};


// --- CRUD DE ROTAS: CREATE (Modificado para Nome da Rota) ---

const createRoute = async (req, res) => {
    try {
        const { name, check_port } = req.body; 

        if (!check_port || !name) {
             return res.status(400).json({ message: "O nome da rota e a porta para o serviço (check_port) são obrigatórios." });
        }
        
        const newRoutePath = generateRandomPath();
        const newTargetUrl = `http://${process.env.PORT_CHECK_HOST || 'localhost'}:${check_port}`;
        
        // Checagem de Conflito de Nome
        const existingName = await Route.findOne({ name });
        if(existingName) {
            return res.status(400).json({ message: `O nome "${name}" já está em uso.` });
        }

        // Checagem de Conflito de Porta
        const existingPort = await Route.findOne({ check_port });
        if(existingPort) {
            return res.status(400).json({ message: `A porta ${check_port} já está registrada na rota ${existingPort.route_path}.` });
        }

        const newRoute = new Route({
            name: name, 
            route_path: `/service/${newRoutePath}`, 
            target_url: newTargetUrl,
            check_port: check_port,
            is_active: true
        });
        
        await newRoute.save();
        
        await setupGatewayRoutes({ PORT_CHECK_HOST: process.env.PORT_CHECK_HOST });
        
        res.status(201).json({ 
            message: "Rota criada e Gateway reiniciado com sucesso.", 
            route: newRoute 
        });

    } catch (err) {
        res.status(500).json({ message: "Erro ao criar rota.", error: err.message });
    }
};


// --- CRUD DE ROTAS: READ (Modificado) ---

const getAllRoutes = async (req, res) => {
    try {
        const routes = await Route.find();
        
        const routesWithHealth = await checkRouteHealth(routes);

        res.status(200).json(routesWithHealth);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar rotas.", error: err.message });
    }
};

const getRouteById = async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        res.status(200).json(route);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar rota.", error: err.message });
    }
};


// --- CRUD DE ROTAS: UPDATE (Modificado para Nome da Rota) ---

const updateRoute = async (req, res) => {
    try {
        // Checa unicidade do nome no update
        if (req.body.name) {
            const existingName = await Route.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
            if (existingName) {
                return res.status(400).json({ message: `O nome "${req.body.name}" já está em uso por outra rota.` });
            }
        }

        const updatedRoute = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        
        if (!updatedRoute) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        
        await setupGatewayRoutes({ PORT_CHECK_HOST: process.env.PORT_CHECK_HOST });

        res.status(200).json({ message: "Rota atualizada e Gateway reiniciado com sucesso.", route: updatedRoute });
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar rota.", error: err.message });
    }
};


// --- CRUD DE ROTAS: DELETE ---

const deleteRoute = async (req, res) => {
    try {
        const deletedRoute = await Route.findByIdAndDelete(req.params.id);

        if (!deletedRoute) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        
        await setupGatewayRoutes({ PORT_CHECK_HOST: process.env.PORT_CHECK_HOST });

        res.status(200).json({ message: "Rota deletada e Gateway reiniciado com sucesso." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao deletar rota.", error: err.message });
    }
};


module.exports = {
    discoverAvailablePorts, 
    createRoute,            
    getAllRoutes, 
    getRouteById,
    updateRoute,
    deleteRoute
};