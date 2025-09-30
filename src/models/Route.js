// src/models/Route.js - Modelo atualizado com suporte a Rotas Externas
const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
    // Nome descritivo da rota (ex: "Service Produtos", "API Terceiros")
    name: {
        type: String,
        required: [true, 'O nome da rota é obrigatório'],
        unique: true, // MUDANÇA: Garante que o nome seja único
        trim: true,
        minlength: [3, 'O nome deve ter no mínimo 3 caracteres'],
        maxlength: [100, 'O nome deve ter no máximo 100 caracteres']
    },
    
    // Caminho da rota no Gateway (ex: "/service/abc123" ou "/api/externa")
    route_path: {
        type: String,
        required: [true, 'O caminho da rota é obrigatório'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^\/[\w\-\/]*$/.test(v); // Valida formato de caminho
            },
            message: 'Caminho inválido. Use apenas letras, números, - e /'
        }
    },
    
    // URL de destino (ex: "http://localhost:3001" ou "https://api.terceiros.com")
    target_url: {
        type: String,
        required: [true, 'A URL de destino é obrigatória'],
        trim: true,
        validate: {
            validator: function(v) {
                try {
                    const url = new URL(v);
                    return url.protocol === 'http:' || url.protocol === 'https:';
                } catch {
                    return false;
                }
            },
            message: 'URL de destino inválida. Use http:// ou https://'
        }
    },
    
    // Porta para health check
    // 0 = Rota Externa (sem health check)
    // > 0 = Rota Dinâmica (com health check na porta local)
    check_port: {
        type: Number,
        required: [true, 'A porta de verificação é obrigatória'],
        min: [0, 'A porta deve ser 0 (externa) ou maior que 0'],
        max: [65535, 'A porta não pode ser maior que 65535'],
        validate: {
            validator: Number.isInteger,
            message: 'A porta deve ser um número inteiro'
        }
    },
    
    // Indica se a rota está ativa no Gateway
    is_active: {
        type: Boolean,
        default: true,
        index: true // Índice para consultas rápidas
    },
    
    // NOVO: Indica se o serviço está respondendo (health check)
    // - true: Serviço está online e respondendo
    // - false: Serviço está offline ou não respondendo
    // - undefined/null: Ainda não foi verificado
    is_healthy: {
        type: Boolean,
        default: false,
        index: true // Índice para consultas rápidas
    },
    
    // NOVO: Timestamp da última verificação de saúde
    last_health_check: {
        type: Date,
        default: null
    },
    
    // NOVO: Mensagem do último health check (para debug)
    last_health_message: {
        type: String,
        default: null,
        maxlength: [500, 'Mensagem muito longa']
    }
    
}, { 
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
    
    // Opções de otimização
    collection: 'routes',
    versionKey: false // Remove o campo __v
});

// ========================================
// ÍNDICES COMPOSTOS (para consultas otimizadas)
// ========================================

// Índice para buscar rotas ativas e saudáveis rapidamente
RouteSchema.index({ is_active: 1, is_healthy: 1 });

// Índice para buscar por porta (garante unicidade de portas > 0)
RouteSchema.index({ check_port: 1 }, { 
    unique: true,
    partialFilterExpression: { check_port: { $gt: 0 } } // Apenas portas > 0 devem ser únicas
});

// ========================================
// MÉTODOS VIRTUAIS
// ========================================

// Virtual para identificar se é rota externa
RouteSchema.virtual('is_external').get(function() {
    return this.check_port === 0;
});

// Virtual para obter o tipo da rota
RouteSchema.virtual('route_type').get(function() {
    return this.check_port === 0 ? 'externa' : 'dinamica';
});

// ========================================
// MÉTODOS DE INSTÂNCIA
// ========================================

/**
 * Atualiza o status de saúde da rota
 */
RouteSchema.methods.updateHealthStatus = function(isHealthy, message = null) {
    this.is_healthy = isHealthy;
    this.last_health_check = new Date();
    if (message) {
        this.last_health_message = message.substring(0, 500); // Limita o tamanho
    }
    return this.save();
};

/**
 * Verifica se a rota precisa de health check
 */
RouteSchema.methods.needsHealthCheck = function() {
    return this.check_port > 0; // Apenas rotas dinâmicas precisam de health check
};

/**
 * Retorna um resumo da rota para logs
 */
RouteSchema.methods.getSummary = function() {
    return `[${this.route_type.toUpperCase()}] ${this.name} (${this.route_path} → ${this.target_url})`;
};

// ========================================
// MÉTODOS ESTÁTICOS
// ========================================

/**
 * Busca todas as rotas ativas
 */
RouteSchema.statics.findActive = function() {
    return this.find({ is_active: true }).sort({ createdAt: -1 });
};

/**
 * Busca todas as rotas saudáveis (online)
 */
RouteSchema.statics.findHealthy = function() {
    return this.find({ is_active: true, is_healthy: true }).sort({ createdAt: -1 });
};

/**
 * Busca rotas por tipo
 */
RouteSchema.statics.findByType = function(type) {
    const query = type === 'externa' 
        ? { check_port: 0 } 
        : { check_port: { $gt: 0 } };
    return this.find(query).sort({ createdAt: -1 });
};

/**
 * Verifica se uma porta já está em uso (apenas para portas > 0)
 */
RouteSchema.statics.isPortInUse = async function(port, excludeId = null) {
    if (port === 0) return false; // Rotas externas não têm conflito de porta
    
    const query = { check_port: port };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    
    const existing = await this.findOne(query);
    return !!existing;
};

/**
 * Verifica se um caminho já está em uso
 */
RouteSchema.statics.isPathInUse = async function(path, excludeId = null) {
    const query = { route_path: path };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    
    const existing = await this.findOne(query);
    return !!existing;
};

// ========================================
// HOOKS (Middleware)
// ========================================

// Pre-save: Validações adicionais
RouteSchema.pre('save', async function(next) {
    // Se for rota externa (porta 0), marca como sempre saudável
    if (this.check_port === 0) {
        this.is_healthy = true;
        this.last_health_message = 'Rota externa - sem health check';
    }
    
    // Normaliza o caminho (sempre começar com /)
    if (this.route_path && !this.route_path.startsWith('/')) {
        this.route_path = '/' + this.route_path;
    }
    
    next();
});

// Post-save: Log de auditoria
RouteSchema.post('save', function(doc) {
    console.log(`✅ Rota salva: ${doc.getSummary()}`);
});

// Post-remove: Log de auditoria
RouteSchema.post('remove', function(doc) {
    console.log(`🗑️  Rota removida: ${doc.getSummary()}`);
});

// ========================================
// CONFIGURAÇÃO DE SERIALIZAÇÃO JSON
// ========================================

// Customiza o JSON retornado (inclui virtuals)
RouteSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        // Remove campos internos do MongoDB
        delete ret.__v;
        return ret;
    }
});

RouteSchema.set('toObject', {
    virtuals: true
});

// ========================================
// EXPORTAÇÃO
// ========================================

module.exports = mongoose.model('Route', RouteSchema);