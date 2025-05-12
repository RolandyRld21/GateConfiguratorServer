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
import { paymentRouter } from './payment.js';
import { finalCartRouter } from './finalCart.js';

import { orderRouter } from './order.js';
import {reviewRouter} from "./review.js"; // Import the order router
import { addressRouter } from './address.js';
import routeRouter from './route.js'; // ✅ This matches the default export
const app = new Koa();
const server = http.createServer(app.callback());
const wss = new WebSocket.Server({ server });
initWss(wss);

app.use(cors());
app.use(timingLogger);
app.use(exceptionHandler);
app.use(bodyParser({
    jsonLimit: '10mb',
    textLimit: '10mb',
    formLimit: '10mb',
}));

const prefix = '/api';

// Public routes
const publicApiRouter = new Router({ prefix });
publicApiRouter
    .use('/auth', authRouter.routes())
    .use('/payment', paymentRouter.routes())
    .use('/route', routeRouter.routes());

app
    .use(publicApiRouter.routes())
    .use(publicApiRouter.allowedMethods());

// Protected routes
app.use(jwt(jwtConfig));

const protectedApiRouter = new Router({ prefix });
protectedApiRouter
    .use('/article', articleRouter.routes())
    .use('/orders', orderRouter.routes())
    .use('/reviews', reviewRouter.routes())
    .use('/addresses', addressRouter.routes())
    .use('/final-cart', finalCartRouter.routes())

app
    .use(protectedApiRouter.routes())
    .use(protectedApiRouter.allowedMethods());

server.listen(3000);
console.log('started on port 3000');