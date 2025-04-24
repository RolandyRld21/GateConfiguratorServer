import http from 'http';
import Koa from 'koa';
import WebSocket from 'ws';
import Router from 'koa-router';
import bodyParser from "koa-bodyparser";
import jwt from 'koa-jwt';
import cors from '@koa/cors';
import { jwtConfig, timingLogger, exceptionHandler } from './utils.js';
import { initWss } from './wss.js';
import { articleRouter } from './article.js';
import { authRouter } from './auth.js';
import { gateRouter } from './gate.js'; // Import your gate router

const app = new Koa();
const server = http.createServer(app.callback());
const wss = new WebSocket.Server({ server });
initWss(wss);

app.use(cors());
app.use(timingLogger);
app.use(exceptionHandler);
// Modify koa-bodyparser to increase the limit
app.use(bodyParser({
    jsonLimit: '10mb',   // Allow JSON payloads up to 10MB
    textLimit: '10mb',   // Allow text payloads up to 10MB
    formLimit: '10mb',   // Allow form-data (multipart) up to 10MB
}));

const prefix = '/api';

// public
const publicApiRouter = new Router({ prefix });
publicApiRouter
    .use('/auth', authRouter.routes());
app
    .use(publicApiRouter.routes())
    .use(publicApiRouter.allowedMethods());

// Add your gateRouter to the public or protected routes depending on requirements
publicApiRouter
    .use('/gate', gateRouter.routes()); // Register gateRouter here for public access

app
    .use(publicApiRouter.routes())
    .use(publicApiRouter.allowedMethods());

app.use(jwt(jwtConfig));

// protected
const protectedApiRouter = new Router({ prefix });
protectedApiRouter
    .use('/article', articleRouter.routes());
app
    .use(protectedApiRouter.routes())
    .use(protectedApiRouter.allowedMethods());

server.listen(3000);
console.log('started on port 3000');
