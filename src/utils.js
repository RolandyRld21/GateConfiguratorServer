import { logger } from './logger.js';

export const jwtConfig = { secret: 'my-secret' };

export const exceptionHandler = async (ctx, next) => {
  const requestPath = ctx.path;
  const requestMethod = ctx.method;
  const userEmail = ctx.state.user?.email || 'Unknown';

  try {
    return await next();
  } catch (err) {
    logger.error(`[EXCEPTION][HANDLER] Email: ${userEmail}, Path: ${requestMethod} ${requestPath}, Status: ${err.status || 500}, Error: ${err.message}`);
    ctx.body = { message: err.message || 'Unexpected error.' };
    ctx.status = err.status || 500;
  }
};

export const timingLogger = async (ctx, next) => {
  const start = Date.now();
  const requestPath = ctx.path;
  const requestMethod = ctx.method;
  const userEmail = ctx.state.user?.email || 'Unknown';

  logger.info(`[TIMING][REQUEST_START] Email: ${userEmail}, Path: ${requestMethod} ${requestPath}`);

  await next();

  const duration = Date.now() - start;
  const status = ctx.response.status;

  if (duration > 1000) {
    logger.warn(`[TIMING][SLOW_REQUEST] Email: ${userEmail}, Path: ${requestMethod} ${requestPath}, Status: ${status}, Duration: ${duration}ms`);
  } else {
    logger.info(`[TIMING][REQUEST_END] Email: ${userEmail}, Path: ${requestMethod} ${requestPath}, Status: ${status}, Duration: ${duration}ms`);
  }
};