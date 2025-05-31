import Router from 'koa-router';
import fetch from 'node-fetch';
import { logger } from './logger.js';

const routeRouter = new Router();

routeRouter.get('/', async (ctx) => {
    const { start, end } = ctx.query;
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[ROUTE][GET_ROUTE] Email: ${userEmail}, Start: ${start}, End: ${end}`);

    try {
        if (!start || !end) {
            logger.warn(`[ROUTE][GET_ROUTE_FAIL] Email: ${userEmail}, Missing coordinates - Start: ${start}, End: ${end}`);
            ctx.status = 400;
            ctx.body = { error: 'Missing start or end coordinates' };
            return;
        }

        const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${start}&end=${end}`;
        logger.info(`[ROUTE][FETCH_ROUTE_API] Email: ${userEmail}, URL: ${url}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': '5b3ce3597851110001cf62488b28c1e436864c7792612ed948ae3afb'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[ROUTE][FETCH_ROUTE_API_ERROR] Email: ${userEmail}, Status: ${response.status}, Error: ${errorText}`);
            throw new Error(`Fetch error: ${errorText}`);
        }

        const data = await response.json();
        const routeDistance = data.features?.[0]?.properties?.segments?.[0]?.distance || 'N/A';
        const routeDuration = data.features?.[0]?.properties?.segments?.[0]?.duration || 'N/A';

        logger.info(`[ROUTE][GET_ROUTE_SUCCESS] Email: ${userEmail}, Distance: ${routeDistance}m, Duration: ${routeDuration}s`);
        ctx.body = data;

    } catch (err) {
        logger.error(`[ROUTE][GET_ROUTE_ERROR] Email: ${userEmail}, Start: ${start}, End: ${end}, Error: ${err.message}`);
        ctx.status = 500;
        ctx.body = { error: 'Failed to fetch route', details: err.message };
    }
});

export default routeRouter;