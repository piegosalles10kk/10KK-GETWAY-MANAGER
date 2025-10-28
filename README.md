# 🚀 API Gateway Manager

**Sistema completo de gerenciamento de API Gateway com proxy reverso dinâmico, controle de tráfego e interface web moderna.**

[Features](#-features) • [Demo](#-demo) • [Instalação](#-instalação) • [Documentação](#-documentação) • [Arquitetura](#-arquitetura)


---

## 📋 Sobre o Projeto

O **API Gateway Manager** é uma solução completa para gerenciar microsserviços através de um proxy reverso dinâmico. Ele oferece descoberta automática de serviços, balanceamento de carga, rate limiting, circuit breaker e uma interface web intuitiva para administração.

### 🎯 Problema que Resolve

- **Centralização**: Unifica o acesso a múltiplos microsserviços
- **Descoberta Automática**: Detecta serviços ativos automaticamente
- **Proteção**: Rate limiting, throttling e circuit breaker
- **Monitoramento**: Health checks em tempo real
- **Facilidade**: Interface web para gerenciamento visual

---

## ✨ Features

### 🔐 Autenticação e Segurança
- ✅ Sistema completo de autenticação de usuários
- ✅ Recuperação de senha via email com tokens
- ✅ Primeiro acesso guiado
- ✅ Senhas criptografadas com bcrypt
- ✅ Rate limiting por usuário/IP

### 🌐 Gerenciamento de Rotas
- ✅ **Rotas Dinâmicas**: Configuradas por porta local
- ✅ **Rotas Externas**: URLs completas de terceiros
- ✅ Descoberta automática de serviços ativos (port scanning)
- ✅ Health checks em tempo real
- ✅ Ativação/desativação de rotas via interface

### 🛡️ Request Manager Avançado
- ✅ **Rate Limiting**: Limite de requisições por tempo
- ✅ **Throttling**: Controle de requisições concorrentes
- ✅ **Queue System**: Fila de requisições com timeout
- ✅ **Circuit Breaker**: Proteção contra sobrecarga
- ✅ **Redis Integration**: Cache e persistência (com fallback)

### 🎨 Interface Web
- ✅ Dashboard moderno e responsivo
- ✅ Dark/Light mode
- ✅ Busca e filtros em tempo real
- ✅ Estatísticas de uso
- ✅ Gerenciamento visual de rotas

### 🐳 DevOps Ready
- ✅ Docker Compose completo
- ✅ MongoDB + Redis + App
- ✅ Volumes para persistência
- ✅ Health check endpoint

---

## 🎬 Demo

### Dashboard Principal
```
┌─────────────────────────────────────────────────────────────┐
│  🔥 API Gateway Manager                          🌙 Admin ⚙│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Visão Geral do Serviço                                  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ 🔌 Ativas   │  │ 🔍 Disponív.│  │ 📋 Total   │          │
│  │     15      │  │      8      │  │     23      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│  🎛️ Controle de Rotas                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [+] Criar Rota                                        │  │
│  │  Nome: [Service Produtos_______]                      │  │
│  │  Porta: [▼ 3001 - Serviço Rodando]                    │  │
│  │  [Adicionar Rota Dinâmica]                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  📋 Rotas Cadastradas                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Status  │ Nome         │ Caminho        │ Destino       ││
│  ├─────────┼──────────────┼────────────────┼───────────────┤│
│  │ 🟢 ON   │ Products API │ /api/products  │ localhost:3001││
│  │ 🟢 ON   │ Users API    │ /api/users     │ localhost:3002││
│  │ 🔴 OFF  │ Orders API   │ /api/orders    │ localhost:3003││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Requisição
```
Cliente                Gateway               Microsserviço
  │                      │                         │
  │──── GET /api/users ─→│                         │
  │                      │─── Rate Limit Check ────│
  │                      │─── Queue Check ─────────│
  │                      │─── Health Check ────────│
  │                      │                         │
  │                      │──── GET /users ────────→│
  │                      │                         │
  │                      │←──── 200 OK ────────────│
  │←──── 200 OK ─────────│                         │
```

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js** >= 20.0.0
- **Docker** & **Docker Compose** (recomendado)
- **MongoDB** 4.4+
- **Redis** 7+ (opcional, mas recomendado)

### Opção 1: Docker (Recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/piegosalles10kk/10KK-GETWAY-MANAGER
cd 10KK-GETWAY-MANAGER

# 2. Configure as variáveis de ambiente
cp .env.example .env

# 3. Inicie os containers
docker-compose up -d

# 4. Acesse o dashboard
# http://localhost:8000/index.html
```

### Opção 2: Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/piegosalles10kk/10KK-GETWAY-MANAGER
cd 10KK-GETWAY-MANAGER

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env

# 4. Certifique-se que MongoDB e Redis estão rodando
# MongoDB: mongodb://localhost:27017
# Redis: redis://localhost:6379

# 5. Inicie o servidor
npm start

# Para desenvolvimento com hot-reload:
npm run dev
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Servidor
PORT=8000

# MongoDB
MONGO_URI=mongodb://localhost:27017/api_gateway_db

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Autenticação
JWT_SECRET=sua-chave-secreta-super-segura

# Admin Padrão (apenas para teste)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123

# Port Scanner
PORT_CHECK_HOST=127.0.0.1

# Request Manager
RATE_LIMIT_WINDOW=60000          # 1 minuto em ms
RATE_LIMIT_MAX_REQUESTS=100      # Max requests por janela
MAX_CONCURRENT_REQUESTS=50       # Max concurrent por usuário
GLOBAL_MAX_CONCURRENT=1000       # Max global
QUEUE_TIMEOUT=30000              # Timeout da fila (30s)
MAX_QUEUE_SIZE=200               # Tamanho máximo da fila
FAILURE_THRESHOLD=5              # Falhas para abrir circuit breaker
CIRCUIT_TIMEOUT=60000            # Tempo do circuit breaker (1 min)
```

### Docker Compose

#### Desenvolvimento (`docker-compose-dev.yml`)
```yaml
services:
  gateway:
    environment:
      PORT_CHECK_HOST: host.docker.internal  # Para macOS/Windows
```

#### Produção (`docker-compose.yml`)
```yaml
services:
  gateway:
    environment:
      PORT_CHECK_HOST: 172.17.0.1  # IP do Docker Bridge
  redis:
    command: redis-server --appendonly yes --requirepass yourPassword
```

---

## 📖 Documentação

### API Endpoints

#### Autenticação

```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

# Response
{
  "message": "Login bem-sucedido",
  "token": "fake-jwt-token-...",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@gateway.local",
    "name": "Administrador"
  }
}
```

#### Recuperação de Senha

```http
POST /api/password-reset/request
Content-Type: application/json

{
  "email": "usuario@exemplo.com"
}
```

#### Gerenciamento de Rotas

```http
# Listar todas as rotas
GET /admin/routes

# Criar nova rota (dinâmica)
POST /admin/routes
Content-Type: application/json

{
  "name": "Service Produtos",
  "check_port": 3001
}

# Criar rota externa
POST /admin/routes
Content-Type: application/json

{
  "name": "API Externa",
  "route_path": "/api/externa",
  "target_url": "https://api.terceiros.com",
  "check_port": 0
}

# Atualizar rota
PUT /admin/routes/:id
Content-Type: application/json

{
  "name": "Novo Nome",
  "route_path": "/novo/caminho",
  "target_url": "http://localhost:3001",
  "check_port": 3001,
  "is_active": true
}

# Deletar rota
DELETE /admin/routes/:id

# Descobrir portas disponíveis
GET /admin/discover
```

#### Health Check

```http
GET /health

# Response
{
  "status": "healthy",
  "timestamp": "2025-10-28T...",
  "metrics": {
    "globalConcurrentRequests": 15,
    "circuitBreakerOpen": false,
    "circuitBreakerFailures": 0,
    "activeQueues": 3,
    "redisConnected": true
  }
}
```

### Uso do Dashboard

#### 1. Primeiro Acesso

Ao acessar pela primeira vez, você será solicitado a criar o usuário administrador principal:

```
Nome Completo: João Silva
Email: joao@empresa.com
Usuário: admin
Senha: ********
```

#### 2. Criar Rota Dinâmica

1. Faça login no dashboard
2. Na seção "Controle de Rotas"
3. **Desmarque** "Criar Rota Externa"
4. Digite o nome da rota: `Service Produtos`
5. Selecione uma porta disponível: `3001`
6. Clique em "Adicionar Rota Dinâmica"

A rota será criada automaticamente como `/service/abc123`

#### 3. Criar Rota Externa

1. **Marque** "Criar Rota Externa"
2. Digite o nome: `API Terceiros`
3. Caminho: `/api/externa`
4. URL Completa: `https://api.terceiros.com`
5. Clique em "Adicionar Rota Externa"

#### 4. Gerenciar Rotas

- **Editar**: Clique no botão amarelo "Editar"
- **Excluir**: Clique no botão vermelho "Excluir"
- **Buscar**: Use a barra de busca para filtrar rotas

---

## 🏗️ Arquitetura

### Estrutura do Projeto

```
api-gateway-manager/
├── 📁 public/                    # Frontend (Dashboard Web)
│   ├── index.html               # Interface principal
│   ├── script.js                # Lógica do dashboard
│   └── style.css                # Estilos (Dark/Light mode)
│
├── 📁 src/
│   ├── 📁 controllers/          # Lógica de negócio
│   │   ├── admin.controller.js  # CRUD de rotas
│   │   ├── auth.controller.js   # Autenticação
│   │   └── proxy.controller.js  # Proxy dinâmico
│   │
│   ├── 📁 middleware/           # Middlewares
│   │   └── requestManager.js    # Rate limiting, Queue, Circuit Breaker
│   │
│   ├── 📁 models/               # Modelos MongoDB
│   │   ├── Route.js             # Schema de rotas
│   │   ├── User.js              # Schema de usuários
│   │   └── PasswordReset.js     # Schema de recuperação
│   │
│   ├── 📁 routes/               # Rotas da API
│   │   ├── admin.routes.js      # Rotas administrativas
│   │   ├── auth.routes.js       # Rotas de autenticação
│   │   └── proxy.routes.js      # Rotas do proxy
│   │
│   └── 📁 services/             # Serviços auxiliares
│       └── db.services.js       # Conexão com MongoDB
│
├── 📄 app.js                     # Aplicação principal
├── 📄 package.json               # Dependências
├── 📄 Dockerfile                 # Imagem Docker
├── 📄 docker-compose.yml         # Orquestração (Produção)
├── 📄 docker-compose-dev.yml     # Orquestração (Desenvolvimento)
└── 📄 .env                       # Variáveis de ambiente
```

### Fluxo de Dados

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────┐
│      Request Manager Middleware     │
│  • Rate Limiting                    │
│  • Throttling                       │
│  • Queue System                     │
│  • Circuit Breaker                  │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│      Dynamic Router (Proxy)         │
│  • Path Matching                    │
│  • Health Check                     │
│  • Target Resolution                │
└──────┬──────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│         http-proxy-middleware       │
│  • Request Forwarding               │
│  • Response Interception            │
│  • HTML Path Rewriting              │
└──────┬──────────────────────────────┘
       │
       ↓
┌──────────────┐
│ Microsserviço│
└──────────────┘
```

### Diagrama de Componentes

```
┌────────────────────────────────────────────────────────┐
│                    API Gateway Manager                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   Backend    │  │  Database    │  │
│  │  (Dashboard) │  │   (Express)  │  │  (MongoDB)   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬──────┘  │
│         │                 │                  │         │
│         └──────────┬──────┴──────────────────┘         │
│                    │                                   │
│         ┌──────────▼──────────┐                        │
│         │  Request Manager    │                        │
│         │  • Rate Limiting    │                        │
│         │  • Circuit Breaker  │                        │
│         └──────────┬──────────┘                        │
│                    │                                   │
│         ┌──────────▼──────────┐                        │
│         │   Dynamic Proxy     │                        │
│         │  • Route Matching   │                        │
│         │  • Health Checks    │                        │
│         └──────────┬──────────┘                        │
│                    │                                   │
└────────────────────┼───────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌────▼────┐
    │ Service │            │ Service │
    │   #1    │            │   #2    │
    └─────────┘            └─────────┘
```

### Padrões de Design Utilizados

- **MVC (Model-View-Controller)**: Separação de responsabilidades
- **Circuit Breaker**: Proteção contra falhas em cascata
- **Rate Limiting**: Controle de tráfego
- **Queue Pattern**: Gerenciamento de requisições concorrentes
- **Fallback Pattern**: Redis → Memory storage
- **Health Check Pattern**: Verificação de disponibilidade

---

## 🔧 Request Manager

### Configuração Padrão

```javascript
{
  RATE_LIMIT_WINDOW: 60 * 1000,        // 1 minuto
  RATE_LIMIT_MAX_REQUESTS: 100,        // 100 requests/minuto
  MAX_CONCURRENT_REQUESTS: 50,         // 50 por usuário
  GLOBAL_MAX_CONCURRENT: 1000,         // 1000 global
  QUEUE_TIMEOUT: 30000,                // 30s timeout
  MAX_QUEUE_SIZE: 200,                 // 200 na fila
  FAILURE_THRESHOLD: 5,                // 5 falhas = circuit open
  CIRCUIT_TIMEOUT: 60000               // 1 minuto de circuit
}
```

### Headers de Resposta

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-Concurrent-Requests: 45
```

### Códigos de Status

- **429 Too Many Requests**: Rate limit excedido
- **429 Queue Full**: Fila de requisições cheia
- **408 Queue Timeout**: Timeout na fila
- **503 Service Unavailable**: Circuit breaker aberto
- **503 Server Overload**: Limite global atingido

---

## 🔐 Segurança

### Implementações Atuais

✅ **Senhas Criptografadas**: Bcrypt com salt
✅ **Rate Limiting**: Proteção contra DDoS
✅ **Tokens de Recuperação**: Expirando em 1 hora
✅ **Validação de Entrada**: Sanitização de dados
✅ **HTTPS Ready**: Suporte a SSL/TLS

### Melhorias Recomendadas

⚠️ **JWT Real**: Implementar autenticação JWT completa
⚠️ **Middleware de Auth**: Proteger rotas admin
⚠️ **RBAC**: Role-Based Access Control
⚠️ **CORS**: Configuração adequada de CORS
⚠️ **Helmet**: Headers de segurança HTTP
⚠️ **Input Validation**: Joi ou express-validator

### Exemplo de Implementação JWT

```javascript
// Instalar: npm install jsonwebtoken

const jwt = require('jsonwebtoken');

// Gerar token
const token = jwt.sign(
  { userId: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Middleware de verificação
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

// Proteger rotas
router.post('/admin/routes', verifyToken, createRoute);
```

---

## 🧪 Testes

### Estrutura Recomendada

```bash
npm install --save-dev jest supertest

# Estrutura de testes
tests/
├── unit/
│   ├── controllers/
│   ├── middleware/
│   └── models/
├── integration/
│   ├── auth.test.js
│   ├── routes.test.js
│   └── proxy.test.js
└── e2e/
    └── dashboard.test.js
```

### Exemplo de Teste

```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../app');

describe('Authentication', () => {
  test('POST /api/login - deve fazer login com sucesso', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({
        username: 'admin',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
  });
  
  test('POST /api/login - deve rejeitar credenciais inválidas', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({
        username: 'admin',
        password: 'senhaerrada'
      });
    
    expect(response.status).toBe(401);
  });
});
```

---

## 📊 Monitoramento

### Logs Estruturados (Recomendado)

```bash
npm install winston

# src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### Métricas (Prometheus)

```bash
npm install prom-client

# src/middleware/metrics.js
const client = require('prom-client');

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});

module.exports = { httpRequestDuration };
```

---

## 🚀 Deploy

### Docker Production

```bash
# Build da imagem
docker build -t api-gateway-manager:latest .

# Push para registry
docker tag api-gateway-manager:latest registry.exemplo.com/gateway:latest
docker push registry.exemplo.com/gateway:latest

# Deploy
docker-compose -f docker-compose.yml up -d
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name gateway.exemplo.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2 Process Manager

```bash
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api-gateway',
    script: 'app.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};

# Iniciar
pm2 start ecosystem.config.js

# Monitorar
pm2 monit

# Logs
pm2 logs api-gateway
```

---

## ❓ FAQ

**P: Como adicionar um novo microsserviço?**
R: Basta iniciá-lo em uma porta disponível e criar uma rota dinâmica no dashboard.

**P: O Gateway funciona com WebSockets?**
R: Sim, o proxy suporta WebSockets automaticamente.

**P: Como aumentar o limite de rate limiting?**
R: Ajuste as variáveis de ambiente `RATE_LIMIT_*` ou configure no `app.js`.

**P: É possível usar sem Docker?**
R: Sim, basta ter MongoDB e Redis rodando localmente e usar `npm start`.

**P: Como fazer backup do banco de dados?**
R: Use `mongodump` para backup e `mongorestore` para restauração.

---

## 🐛 Problemas Conhecidos

1. **JWT Fake**: Token de autenticação não é validado de verdade
2. **Rotas Admin Desprotegidas**: Qualquer um pode acessar `/admin/routes`
3. **Sem HTTPS**: Produção deve configurar SSL/TLS
4. **HTML Injection**: Pode falhar com SPAs complexas

---

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

**Piego**

- GitHub: [@piego](https://github.com/piego)
- Email: diegosalles@live.com

---

## 🙏 Agradecimentos

- [Express](https://expressjs.com/) - Framework web
- [MongoDB](https://www.mongodb.com/) - Banco de dados
- [Redis](https://redis.io/) - Cache e fila
- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) - Proxy reverso
- [Docker](https://www.docker.com/) - Containerização

---


**[⬆ Voltar ao topo](#-api-gateway-manager)**

Feito com ❤️ por Piego
