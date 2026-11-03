require("dotenv").config(); // Load environment variables from .env file
const app = require("./src/app.js"); // Import the Express app
const db = require("./src/database/connection");
const logger = require("./src/utils/logger");
const listen = require("./src/utils/listen");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function startServer() {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535");
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is required before the API can start");
    }
    if (process.env.NODE_ENV === "production" && Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32) {
        throw new Error("JWT_SECRET must be at least 32 bytes in production");
    }

    await db.query("SELECT 1");
    const server = await listen(app, PORT);
    logger.info("API server started", { port: PORT });

    let isShuttingDown = false;
    const shutdown = (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        logger.info("API server shutting down", { signal });
        const timeout = setTimeout(() => {
            logger.error("Graceful shutdown timed out");
            process.exit(1);
        }, 10000);
        timeout.unref();

        server.close(async (error) => {
            clearTimeout(timeout);
            if (error) {
                logger.error("Error while closing HTTP server", error);
                process.exitCode = 1;
            }
            try {
                await db.end();
            } catch (dbError) {
                logger.error("Error while closing PostgreSQL pool", dbError);
                process.exitCode = 1;
            }
        });
        server.closeIdleConnections?.();
    };

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => shutdown(signal));
    }
}

startServer().catch(async (error) => {
    logger.error("API server failed to start", error);
    try {
        await db.end();
    } catch (dbError) {
        logger.error("Error while closing PostgreSQL pool after startup failure", dbError);
    }
    process.exitCode = 1;
});
