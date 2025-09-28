// mock-service.js
const express = require('express');
const app = express();
const PORT = 3001; // Porta 3001 para ser acessada pelo Gateway

// --- Dados Mockados (Simulando um Banco de Dados de Produtos) ---
const mockProducts = [
    { id: 1, name: "Teclado Mecânico", price: 350.00, category: "Hardware" },
    { id: 2, name: "Mouse Gamer Sem Fio", price: 180.00, category: "Hardware" },
    { id: 3, name: "Monitor 27 Polegadas", price: 1200.00, category: "Periféricos" },
    { id: 4, name: "Webcam Full HD", price: 150.00, category: "Periféricos" },
];

// --- Configuração ---
app.use(express.json());

// Middleware simples para logar que a requisição chegou
app.use((req, res, next) => {
    console.log(`[SERVICE 3001] Recebida requisição: ${req.method} ${req.url}`);
    next();
});

// --- Rota 1: GET Todos os Produtos ---
app.get('/products', (req, res) => {
    res.status(200).json({
        message: "Lista completa de produtos do serviço 3001.",
        data: mockProducts
    });
});

// --- Rota 2: GET Produto por ID ---
app.get('/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const product = mockProducts.find(p => p.id === id);

    if (product) {
        return res.status(200).json({
            message: `Produto ID ${id} encontrado.`,
            data: product
        });
    }

    res.status(404).json({ message: `Produto com ID ${id} não encontrado.` });
});


// --- Inicialização do Servidor Mock ---
app.listen(PORT, () => {
    console.log(`
======================================================
🚀 MOCK SERVICE (PRODUTOS) rodando em http://localhost:${PORT}
======================================================
`);
});