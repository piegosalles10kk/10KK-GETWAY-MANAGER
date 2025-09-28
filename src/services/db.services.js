// config/dbConnect.js

import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/api-gateway-db";

const dbConnect = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Conexão com MongoDB estabelecida com sucesso.");
    } catch (error) {
        // Em caso de falha de conexão (ex: MongoDB não está pronto), 
        // a aplicação Node.js é encerrada para que o Docker possa tentar reiniciar (restart: always).
        console.error("Erro ao conectar com MongoDB:", error.message);
        process.exit(1);
    }
}

export default dbConnect;