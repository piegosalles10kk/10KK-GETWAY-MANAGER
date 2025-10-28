// src/middleware/requestManager.js
const redis = require('redis');

let redisClient = null;
try {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
    });
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    redisClient.connect().catch(console.error);
} catch (error) {
    console.warn('⚠️  Redis não disponível, usando memória local');
}

// Fallback: armazenamento em memória
const memoryStore = new Map();
const requestQueue = new Map();

// Configurações
const CONFIG = {
    // Rate Limiting
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minuto
    RATE_LIMIT_MAX_REQUESTS: 100, // requests por janela
    
    // Throttling
    MAX_CONCURRENT_REQUESTS: 50, // Por usuário/IP
    GLOBAL_MAX_CONCURRENT: 1000, // Global
    
    // Queue
    QUEUE_TIMEOUT: 30000, // 30 segundos
    MAX_QUEUE_SIZE: 200,
    
    // Circuit Breaker
    FAILURE_THRESHOLD: 5,
    CIRCUIT_TIMEOUT: 60000, // 1 minuto
};

// Contador global de requisições
let globalConcurrentRequests = 0;

// Circuit Breaker State
const circuitBreaker = {
    failures: 0,
    isOpen: false,
    lastFailureTime: null
};

/**
 * Obtém a chave única do cliente (userId ou IP)
 */
const getClientKey = (req) => {
    return req.user?._id?.toString() || 
           req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
};

/**
 * Rate Limiting - Limita número de requisições por tempo
 */
const checkRateLimit = async (clientKey) => {
    const now = Date.now();
    const key = `ratelimit:${clientKey}`;
    
    try {
        if (redisClient?.isOpen) {
            const requests = await redisClient.incr(key);
            if (requests === 1) {
                await redisClient.expire(key, Math.ceil(CONFIG.RATE_LIMIT_WINDOW / 1000));
            }
            return requests <= CONFIG.RATE_LIMIT_MAX_REQUESTS;
        }
    } catch (error) {
        console.error('Redis rate limit error:', error);
    }
    
    // Fallback para memória
    const record = memoryStore.get(key) || { count: 0, resetTime: now + CONFIG.RATE_LIMIT_WINDOW };
    
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + CONFIG.RATE_LIMIT_WINDOW;
    } else {
        record.count++;
    }
    
    memoryStore.set(key, record);
    return record.count <= CONFIG.RATE_LIMIT_MAX_REQUESTS;
};

/**
 * Verifica concorrência por cliente
 */
const checkConcurrency = (clientKey) => {
    const queue = requestQueue.get(clientKey) || { active: 0, waiting: [] };
    return queue.active < CONFIG.MAX_CONCURRENT_REQUESTS;
};

/**
 * Adiciona requisição à fila
 */
const queueRequest = (clientKey) => {
    return new Promise((resolve, reject) => {
        const queue = requestQueue.get(clientKey) || { active: 0, waiting: [] };
        
        if (queue.waiting.length >= CONFIG.MAX_QUEUE_SIZE) {
            return reject(new Error('QUEUE_FULL'));
        }
        
        const timeout = setTimeout(() => {
            const index = queue.waiting.findIndex(item => item.resolve === resolve);
            if (index !== -1) {
                queue.waiting.splice(index, 1);
                reject(new Error('QUEUE_TIMEOUT'));
            }
        }, CONFIG.QUEUE_TIMEOUT);
        
        queue.waiting.push({ resolve, reject, timeout });
        requestQueue.set(clientKey, queue);
    });
};

/**
 * Processa próxima requisição da fila
 */
const processQueue = (clientKey) => {
    const queue = requestQueue.get(clientKey);
    if (!queue || queue.waiting.length === 0) return;
    
    if (queue.active < CONFIG.MAX_CONCURRENT_REQUESTS) {
        const next = queue.waiting.shift();
        clearTimeout(next.timeout);
        next.resolve();
    }
};

/**
 * Incrementa contador de requisições ativas
 */
const incrementActive = (clientKey) => {
    const queue = requestQueue.get(clientKey) || { active: 0, waiting: [] };
    queue.active++;
    requestQueue.set(clientKey, queue);
    globalConcurrentRequests++;
};

/**
 * Decrementa contador de requisições ativas
 */
const decrementActive = (clientKey) => {
    const queue = requestQueue.get(clientKey);
    if (queue) {
        queue.active--;
        globalConcurrentRequests--;
        if (queue.active === 0 && queue.waiting.length === 0) {
            requestQueue.delete(clientKey);
        } else {
            processQueue(clientKey);
        }
    }
};

/**
 * Verifica Circuit Breaker
 */
const checkCircuitBreaker = () => {
    if (!circuitBreaker.isOpen) return true;
    
    const now = Date.now();
    if (now - circuitBreaker.lastFailureTime > CONFIG.CIRCUIT_TIMEOUT) {
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
        return true;
    }
    
    return false;
};

/**
 * Registra falha no Circuit Breaker
 */
const recordFailure = () => {
    circuitBreaker.failures++;
    if (circuitBreaker.failures >= CONFIG.FAILURE_THRESHOLD) {
        circuitBreaker.isOpen = true;
        circuitBreaker.lastFailureTime = Date.now();
        console.warn('⚠️  Circuit Breaker ABERTO - Sistema em sobrecarga');
    }
};

/**
 * Middleware principal de gerenciamento de requisições
 */
const requestManager = (options = {}) => {
    const config = { ...CONFIG, ...options };
    
    return async (req, res, next) => {
        const clientKey = getClientKey(req);
        const startTime = Date.now();
        
        // Headers de informação
        res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT_MAX_REQUESTS);
        
        try {
            // 1. Verifica Circuit Breaker
            if (!checkCircuitBreaker()) {
                return res.status(503).json({
                    error: 'SERVICE_UNAVAILABLE',
                    message: 'Sistema temporariamente indisponível. Tente novamente em instantes.',
                    retryAfter: Math.ceil((config.CIRCUIT_TIMEOUT - (Date.now() - circuitBreaker.lastFailureTime)) / 1000)
                });
            }
            
            // 2. Verifica limite global
            if (globalConcurrentRequests >= config.GLOBAL_MAX_CONCURRENT) {
                recordFailure();
                return res.status(503).json({
                    error: 'SERVER_OVERLOAD',
                    message: 'Servidor em alta demanda. Tente novamente em instantes.'
                });
            }
            
            // 3. Rate Limiting
            const withinRateLimit = await checkRateLimit(clientKey);
            if (!withinRateLimit) {
                return res.status(429).json({
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'Muitas requisições. Tente novamente em alguns segundos.',
                    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000)
                });
            }
            
            // 4. Verifica concorrência
            if (!checkConcurrency(clientKey)) {
                try {
                    await queueRequest(clientKey);
                } catch (error) {
                    if (error.message === 'QUEUE_FULL') {
                        return res.status(429).json({
                            error: 'QUEUE_FULL',
                            message: 'Muitas requisições simultâneas. Aguarde a conclusão das anteriores.'
                        });
                    }
                    if (error.message === 'QUEUE_TIMEOUT') {
                        return res.status(408).json({
                            error: 'QUEUE_TIMEOUT',
                            message: 'Tempo de espera na fila excedido.'
                        });
                    }
                    throw error;
                }
            }
            
            // 5. Incrementa contadores
            incrementActive(clientKey);
            
            // 6. Adiciona informações de monitoramento
            req.requestMetrics = {
                clientKey,
                startTime,
                queueTime: Date.now() - startTime
            };
            
            // 7. Cleanup ao finalizar
            const cleanup = () => {
                decrementActive(clientKey);
                const duration = Date.now() - startTime;
                
                // Log para monitoramento
                if (duration > 5000) {
                    console.warn(`⚠️  Requisição lenta: ${req.method} ${req.path} - ${duration}ms`);
                }
                
                // Remove listeners
                res.removeListener('finish', cleanup);
                res.removeListener('close', cleanup);
            };
            
            res.on('finish', cleanup);
            res.on('close', cleanup);
            
            // 8. Headers de status
            res.setHeader('X-RateLimit-Remaining', config.RATE_LIMIT_MAX_REQUESTS - (memoryStore.get(`ratelimit:${clientKey}`)?.count || 0));
            res.setHeader('X-Concurrent-Requests', globalConcurrentRequests);
            
            next();
            
        } catch (error) {
            console.error('Request Manager Error:', error);
            recordFailure();
            res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: 'Erro ao processar requisição'
            });
        }
    };
};

/**
 * Middleware de health check
 */
const healthCheck = (req, res) => {
    const health = {
        status: circuitBreaker.isOpen ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
            globalConcurrentRequests,
            circuitBreakerOpen: circuitBreaker.isOpen,
            circuitBreakerFailures: circuitBreaker.failures,
            activeQueues: requestQueue.size,
            redisConnected: redisClient?.isOpen || false
        }
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
};

/**
 * Limpa caches periodicamente
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
        if (value.resetTime && now > value.resetTime) {
            memoryStore.delete(key);
        }
    }
}, 60000); // A cada minuto

module.exports = {
    requestManager,
    healthCheck,
    CONFIG
};