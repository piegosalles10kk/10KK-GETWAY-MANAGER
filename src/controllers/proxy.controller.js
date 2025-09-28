// src/controllers/proxy.controller.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const portscanner = require('portscanner');
const Route = require('../models/Route'); 
const zlib = require('zlib'); // Módulo nativo do Node.js
const dynamicRouter = express.Router();
let activeRoutesCache = [];

// Função de Ajuda: Lida com a substituição de URLs no corpo HTML
const processHtmlForProxy = (htmlContent, route_path) => {
    // 1. Garante o prefixo com a barra final: /service/minharota/
    const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
    
    let modifiedHtml = htmlContent;

    // --- 2. Injeção da Tag <base> (Suporte a Navegação SPA) ---
    const baseTag = `<base href="${basePath}">`;
    modifiedHtml = modifiedHtml.replace(/<head>/i, `<head>${baseTag}`);

    // --- 3. Substituição Agressiva de Assets (CSS/JS/Imagens) ---
    // Encontra: (href|src|action)=" /
    // Substitui por: $1="${basePath}
    // Isso cobre tags HTML padrão que usam URLs absolutas: <link href="/css...">
    const assetRegex = /(href|src|action)=["']\//gi; 
    modifiedHtml = modifiedHtml.replace(assetRegex, `$1="${basePath}`);

    // --- 4. Substituição Ultra-Agressiva (Qualquer URL Absoluta no HTML/JS Inline) ---
    // Encontra: " / (Aspas duplas, seguidas de espaço e barra) ou "/ (Aspas duplas, seguidas de barra)
    // E substitui por: " /service/minharota/
    // A ideia é capturar URLs geradas por JavaScript dentro de strings.
    // É perigoso, mas necessário para alta compatibilidade.
    const genericUrlRegex = /(['"])\/([^\/])/g; 
    modifiedHtml = modifiedHtml.replace(genericUrlRegex, `$1${basePath}$2`);

    return modifiedHtml;
};


/**
 * Função principal para buscar, verificar a saúde e configurar as rotas.
 */
const setupGatewayRoutes = async ({ PORT_CHECK_HOST }) => {
    
    const hostToCheck = PORT_CHECK_HOST || process.env.PORT_CHECK_HOST || '127.0.0.1';

    try {
        const newRoutes = await Route.find({ is_active: true });
        
        if (JSON.stringify(newRoutes) === JSON.stringify(activeRoutesCache)) {
            return; 
        }

        console.log(`\n🔄 Recarregando rotas. Rotas ativas encontradas: ${newRoutes.length}.`);
        activeRoutesCache = newRoutes;

        dynamicRouter.stack = []; 

        await Promise.all(newRoutes.map(async (route) => {
            const { route_path, target_url, check_port } = route;

            // --- 1. Verificação de Porta ---
            let is_service_running = true;
            if (check_port) {
                const status = await portscanner.checkPortStatus(check_port, hostToCheck); 
                is_service_running = status === 'open';
            }

            if (!is_service_running) {
                console.warn(`[⚠️ INATIVO] Serviço para ${route_path} na porta ${check_port} está fechado. Rota ignorada.`);
                return; 
            }
            
            // --- 2. Configuração e Aplicação do Middleware de Proxy ---
            const proxyOptions = {
                target: target_url,
                changeOrigin: true, // Mantém a correção de Host Header
                
                // CRÍTICA: Intercepta a resposta para INJETAR a tag base e lidar com GZIP
                onProxyRes: (proxyRes, req, res) => {
                    const contentType = proxyRes.headers['content-type'];
                    const contentEncoding = proxyRes.headers['content-encoding'];
                    
                    // Somente processa documentos HTML
                    if (contentType && contentType.includes('text/html')) {
                        let decompressor;
                        if (contentEncoding === 'gzip') {
                            decompressor = zlib.createGunzip();
                            delete proxyRes.headers['content-encoding']; 
                        } else if (contentEncoding === 'deflate') {
                            decompressor = zlib.createInflate();
                            delete proxyRes.headers['content-encoding'];
                        }

                        if (decompressor) {
                            let buffer = [];
                            
                            decompressor.on('data', (chunk) => { buffer.push(chunk); });
                            decompressor.on('end', () => {
                                try {
                                    const html = Buffer.concat(buffer).toString('utf8');
                                    
                                    // NOVO: REESCREVE O CORPO MANUALMENTE com todas as regras
                                    const modifiedHtml = processHtmlForProxy(html, route_path);

                                    res.setHeader('content-length', Buffer.byteLength(modifiedHtml));
                                    res.end(modifiedHtml);
                                } catch (e) {
                                    console.error("Erro ao processar GZIP/HTML:", e);
                                    proxyRes.pipe(res); 
                                }
                            });
                            
                            proxyRes.pipe(decompressor);
                        } else {
                            // Se não houver compressão
                            let body = [];
                            proxyRes.on('data', (chunk) => { body.push(chunk); });
                            proxyRes.on('end', () => {
                                try {
                                    const html = Buffer.concat(body).toString('utf8');
                                    const modifiedHtml = processHtmlForProxy(html, route_path);
                                    res.setHeader('content-length', Buffer.byteLength(modifiedHtml));
                                    res.end(modifiedHtml);
                                } catch (e) {
                                    console.error("Erro ao processar HTML simples:", e);
                                    res.end(Buffer.concat(body));
                                }
                            });
                        }
                    } else {
                        // Para CSS, JS, e outros, pipe a resposta original
                        proxyRes.pipe(res);
                    }
                },
                
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] Redirecionando ${req.method} ${req.originalUrl} para ${target_url}`);
                },
            };

            dynamicRouter.use(route_path, createProxyMiddleware(proxyOptions));
            console.log(`[✅ ATIVO] Rota configurada: ${route_path} -> ${target_url}`);
        })); 

    } catch (error) {
        console.error("Erro ao carregar e configurar as rotas do Gateway:", error);
    }
};

/**
 * Handler de Fallback 404 (quando nenhuma rota do proxy corresponde).
 */
const notFoundFallback = (req, res) => {
    res.status(404).send({ 
        error: "Route Not Found", 
        message: "A rota solicitada não foi encontrada na API Gateway." 
    });
};


module.exports = { 
    dynamicRouter, 
    setupGatewayRoutes,
    notFoundFallback
};
