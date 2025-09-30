// src/controllers/auth.controller.js
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// Certifique-se de importar o 'node-fetch' ou 'axios' se estiver usando o código
// para a chamada HTTP. Vou assumir que 'fetch' está definido globalmente (ou use require('node-fetch'))

// Função de ajuda para gerar uma senha aleatória simples
const generateRandomPassword = (length = 8) => {
    return Math.random().toString(36).slice(-length);
};

// Função para gerar token de recuperação
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// --- FUNÇÃO 1: VERIFICAR SE É PRIMEIRO ACESSO ---
const checkFirstAccess = async (req, res) => {
    try {
        // Verifica se existe algum usuário. Se for 0, o primeiro admin precisa ser registrado.
        // Se for 1 (apenas o usuário de teste 'admin' existe), a tela de registro inicial também pode ser mostrada.
        const userCount = await User.countDocuments();
        const needsRegistration = userCount === 0; 
        
        res.status(200).json({ 
            needsRegistration,
            message: needsRegistration ? 'Registro obrigatório' : 'Sistema configurado'
        });
    } catch (error) {
        res.status(500).json({ message: "Erro ao verificar status do sistema." });
    }
};

// --- FUNÇÃO 2: REGISTRO DE PRIMEIRO USUÁRIO ---
const registerFirstUser = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        
        // Bloqueia se já existir qualquer usuário
        if (userCount > 0) {
            return res.status(403).json({ message: "O registro inicial já foi realizado. Use o login." });
        }

        const { name, email, username, password } = req.body;

        // Validações
        if (!name || !email || !username || !password) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios." });
        }

        // Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Cria o novo usuário
        const newUser = new User({
            name,
            email,
            username,
            password: hashedPassword,
            isFirstAccess: false,
            role: 'admin'
        });

        await newUser.save();

        console.log(`✅ Novo usuário registrado: ${username} (${email})`);

        res.status(201).json({ 
            message: "Usuário registrado com sucesso! Você já pode fazer login.",
            user: { 
                id: newUser._id, 
                username: newUser.username, 
                email: newUser.email,
                name: newUser.name
            }
        });

    } catch (error) {
        if (error.code === 11000) {
             return res.status(400).json({ message: "Nome de usuário ou email já existe." });
        }
        console.error("Erro no registro:", error);
        res.status(500).json({ message: "Erro ao registrar usuário.", error: error.message });
    }
};

// --- FUNÇÃO 3: LOGIN ---
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
            user: { 
                id: user._id, 
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Erro interno no servidor." });
    }
};

// --- FUNÇÃO 4: SOLICITAR RECUPERAÇÃO DE SENHA ---
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email é obrigatório." });
        }

        // Busca o usuário
        const user = await User.findOne({ email: email.toLowerCase() });

        // Por segurança, sempre retorna sucesso (não revela se email existe)
        if (!user) {
            return res.status(200).json({ 
                message: "Se o email estiver cadastrado, você receberá as instruções de recuperação." 
            });
        }

        // 1. Gera token único
        const resetToken = generateResetToken();
        
        // 2. CORREÇÃO CRÍTICA: Define o tempo de expiração (1 hora a partir de agora)
        // Isso resolve o erro 'expiresAt: Path `expiresAt` is required.'
        const expirationTime = 60 * 60 * 1000; // 1 hora em milissegundos
        const expiresAt = new Date(Date.now() + expirationTime); 
        
        // 3. Salva no banco
        // *BOA PRÁTICA:* Apagar tokens anteriores para evitar lixo no DB, mas
        // o `index: { expires: '1h' }` no modelo já lida com a limpeza. 
        // Vamos manter a criação simples no padrão `create`.
        await PasswordReset.create({
            userId: user._id,
            email: user.email,
            token: resetToken,
            expiresAt: expiresAt, // <--- CAMPO CORRIGIDO
            used: false
        });

        // Monta o link de recuperação
        const resetLink = `${req.protocol}://${req.get('host')}/index.html?token=${resetToken}`; // Usando index.html para o frontend

        // Monta o HTML do email (Mantido do seu código original)
        const emailHTML = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a73e8;">Recuperação de Senha - API Gateway Manager</h2>
            <p>Olá, <strong>${user.name}</strong>,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            
            <div style="background-color: #f4f7f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Para redefinir sua senha, clique no link abaixo:</strong></p>
                <p style="margin: 10px 0;">
                    <a href="${resetLink}" 
                        style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                        Redefinir Senha
                    </a>
                </p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                    Ou copie e cole este link no navegador:<br/>
                    <code style="background: #e8e8e8; padding: 5px; display: inline-block; margin-top: 5px;">${resetLink}</code>
                </p>
            </div>

            <p style="color: #e74c3c; font-weight: bold;">⚠️ Este link expira em 1 hora.</p>
            
            <p>Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá a mesma.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"/>
            <small style="color: #888;">
                Este é um email automático. Por favor, não responda.<br/>
                <strong>API Gateway Manager</strong> - Sistema de Gerenciamento
            </small>
        </div>
        `;

        // Envia o email via API externa (Mantido do seu código original)
        try {
            const response = await fetch('https://piegosalles-backend.cloud/enviar-email/api/enviar-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: "API Gateway <suporte@chromatox.com>",
                    to: user.email,
                    subject: "Recuperação de Senha - API Gateway Manager",
                    html: emailHTML
                })
            });

            if (!response.ok) {
                // Loga o erro, mas não o retorna para o cliente
                const errorDetails = await response.text();
                throw new Error(`Falha ao enviar email. Detalhes: ${errorDetails}`);
            }

            console.log(`📧 Email de recuperação enviado para: ${user.email}`);

        } catch (emailError) {
            console.error("Erro ao enviar email:", emailError.message);
            // Continua, pois o token foi salvo, e o usuário receberá a mensagem de sucesso genérica
        }

        res.status(200).json({ 
            message: "Se o email estiver cadastrado, você receberá as instruções de recuperação." 
        });

    } catch (error) {
        console.error("Erro ao solicitar recuperação:", error);
        res.status(500).json({ message: "Erro ao processar solicitação." });
    }
};

// --- FUNÇÃO 5: VALIDAR TOKEN DE RECUPERAÇÃO ---
const validateResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        const resetRequest = await PasswordReset.findOne({
            token,
            used: false,
            // Filtro $gt: new Date() é bom, mas o Mongoose/MongoDB já checa
            // a expiração se você usou o index: { expires: '1h' } no modelo.
            // Manteremos por segurança.
            expiresAt: { $gt: new Date() }
        });

        if (!resetRequest) {
            return res.status(400).json({ 
                valid: false,
                message: "Token inválido ou expirado." 
            });
        }

        res.status(200).json({ 
            valid: true,
            message: "Token válido.",
            email: resetRequest.email
        });

    } catch (error) {
        res.status(500).json({ message: "Erro ao validar token." });
    }
};

// --- FUNÇÃO 6: REDEFINIR SENHA ---
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token e nova senha são obrigatórios." });
        }

        // Valida a senha (mínimo 6 caracteres)
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres." });
        }

        // Busca o token válido
        const resetRequest = await PasswordReset.findOne({
            token,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!resetRequest) {
            return res.status(400).json({ message: "Token inválido ou expirado." });
        }

        // Busca o usuário
        const user = await User.findById(resetRequest.userId);
        if (!user) {
            // Marca o token como usado (por segurança), mesmo que o usuário não exista
            resetRequest.used = true;
            await resetRequest.save();
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        // Criptografa a nova senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Atualiza a senha do usuário
        user.password = hashedPassword;
        await user.save();

        // Marca o token como usado
        resetRequest.used = true;
        await resetRequest.save();

        console.log(`🔐 Senha redefinida para o usuário: ${user.username}`);

        res.status(200).json({ message: "Senha redefinida com sucesso! Você já pode fazer login." });

    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ message: "Erro ao redefinir senha." });
    }
};

// --- FUNÇÃO 7: CRIAR USUÁRIO DE TESTE ---
const createTestUser = async () => {
    try {
        const username = 'admin';
        const existingUser = await User.findOne({ username });
        
        if (!existingUser) {
            const randomPassword = generateRandomPassword(8);
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);
            
            const newUser = new User({
                username: username,
                email: 'admin@gateway.local',
                name: 'Administrador',
                password: hashedPassword,
                role: 'admin',
                isFirstAccess: true
            });
            
            await newUser.save();
            
            console.log(`\n======================================================`);
            console.log(`🛠️ Usuário de teste '${username}' criado com sucesso.`);
            console.log(`🔐 Senha temporária: ${randomPassword}`);
            console.log(`📧 Email: admin@gateway.local`);
            console.log(`======================================================`);
            
            return { username, password: randomPassword };
        }
    } catch (error) {
        console.error("Erro ao criar usuário de teste:", error.message);
    }
    return null; 
};

// --- FUNÇÕES DE CRUD DE USUÁRIOS (mantidas) ---
const createUser = async (req, res) => {
    try {
        const { username, password, email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({ message: "Nome e email são obrigatórios." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            email,
            name,
            password: hashedPassword,
            isFirstAccess: false
        });
        
        await newUser.save();
        
        res.status(201).json({ 
            message: "Usuário criado com sucesso.", 
            user: { 
                username: newUser.username, 
                email: newUser.email,
                name: newUser.name,
                _id: newUser._id 
            } 
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "Nome de usuário ou email já existe." });
        }
        res.status(500).json({ message: "Erro ao criar usuário.", error: err.message });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar usuários.", error: err.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }
        
        const updatedUser = await User.findByIdAndUpdate(id, updates, { 
            new: true, 
            runValidators: true 
        }).select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }
        
        res.status(200).json({ message: "Usuário atualizado com sucesso.", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar usuário.", error: err.message });
    }
};

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
    checkFirstAccess,
    registerFirstUser,
    login,
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    createTestUser
};