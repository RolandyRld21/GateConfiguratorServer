import jwt from 'jsonwebtoken';
import { jwtConfig } from './utils.js';

export const requireAuth = async (ctx, next) => {
    const authHeader = ctx.headers.authorization;

    if (!authHeader) {
        ctx.status = 401;
        ctx.body = { message: 'Token lipsă' };
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const user = jwt.verify(token, jwtConfig.secret);
        ctx.state.user = user; // 👈 aici atașezi email-ul la context
        await next();
    } catch (err) {
        ctx.status = 401;
        ctx.body = { message: 'Token invalid sau expirat' };
    }
};
