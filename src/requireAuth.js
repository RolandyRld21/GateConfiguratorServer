import jwt from 'jsonwebtoken';
import { jwtConfig } from './utils.js';
import { logger } from './logger.js';

export const requireAuth = async (ctx, next) => {
    const authHeader = ctx.headers.authorization;
    const requestPath = ctx.path;
    const requestMethod = ctx.method;

    logger.info(`[AUTH][REQUIRE_AUTH] Path: ${requestMethod} ${requestPath}`);

    if (!authHeader) {
        logger.warn(`[AUTH][REQUIRE_AUTH_FAIL] Path: ${requestMethod} ${requestPath}, Missing token`);
        ctx.status = 401;
        ctx.body = { message: 'Token lipsă' };
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const user = jwt.verify(token, jwtConfig.secret);
        ctx.state.user = user; // 👈 aici atașezi email-ul la context

        logger.info(`[AUTH][REQUIRE_AUTH_SUCCESS] Email: ${user.email}, Path: ${requestMethod} ${requestPath}`);
        await next();
    } catch (err) {
        logger.warn(`[AUTH][REQUIRE_AUTH_FAIL] Path: ${requestMethod} ${requestPath}, Invalid or expired token: ${err.message}`);
        ctx.status = 401;
        ctx.body = { message: 'Token invalid sau expirat' };
    }
};