// app.js

// --- 1. Dependências e Configuração de Ambiente ---
require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');

// Importa funções essenciais e routers
const { dynamicRouter, setupGatewayRoutes, notFoundFallback } = require('./src/controllers/proxy.controller');
const { createTestUser } = require('./src/controllers/auth.controller');
const authRouter = require('./src/routes/auth.routes');         
const routeAdminRouter = require('./src/routes/admin.routes'); 

// --- 2. Variáveis de Configuração ---
const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/api_gateway_db'; 
const PORT_CHECK_HOST = process.env.PORT_CHECK_HOST || '127.0.0.1'; 

// --- 3. Instância Principal do Express e Middlewares ---
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- 4. Conexão com o MongoDB ---

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ MongoDB conectado com sucesso.");
    } catch (err) {
        console.error("❌ Erro fatal ao conectar ao MongoDB. Verifique se o servidor DB está rodando e se a MONGO_URI está correta.");
        console.error("Detalhes do Erro:", err.message);
        process.exit(1); 
    }
};


// --- 5. Roteamento da API ---

// Rotas de Autenticação e Usuários (Auth Router cobre login e CRUD de users)
app.use('/api', authRouter); 

// Rotas de Administração do Gateway (CRUD de Rotas)
app.use('/admin', routeAdminRouter); 

// Roteamento do Gateway (PROXY DINÂMICO)
const apiRouter = dynamicRouter;
apiRouter.use(notFoundFallback); 
app.use('/', apiRouter); 


/**
 * 6. Inicialização do Servidor
 */
const startServer = async () => {
    // 1. Conecta ao DB
    await connectDB();
    
    // 2. Cria o usuário de teste e pega a senha (Se for a primeira vez, ele retorna a senha aleatória)
    const testUser = await createTestUser(); 
    
    // 3. Configura o Proxy
    await setupGatewayRoutes({ PORT_CHECK_HOST }); 
    
    // 4. Inicia o Express
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🔥 API Gateway rodando em http://localhost:${PORT}`);
        console.log(`Acesse o Dashboard: http://localhost:${PORT}/index.html`);
        
        // Loga a senha aleatória para o primeiro uso
        if (testUser) {
            console.log(`👉 **LOGIN ADMIN**: admin / ${testUser.password}`);
        } else {
            console.log(`👉 **LOGIN ADMIN**: admin / (use a senha anterior)`);
        }
        console.log(`======================================================`);
    });
};

// Inicia o processo
startServer().catch(err => {
    console.error("Erro fatal ao iniciar a Gateway:", err);
    process.exit(1);
});