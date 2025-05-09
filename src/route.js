import Router from 'koa-router';
import fetch from 'node-fetch';

const routeRouter = new Router();

routeRouter.get('/', async (ctx) => {
    const { start, end } = ctx.query;

    if (!start || !end) {
        ctx.status = 400;
        ctx.body = { error: 'Missing start or end coordinates' };
        return;
    }

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${start}&end=${end}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': '5b3ce3597851110001cf62488b28c1e436864c7792612ed948ae3afb' // or from variable
            }
        });


        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fetch error: ${errorText}`);
        }

        const data = await response.json();
        ctx.body = data;
    } catch (err) {
        console.error('Error fetching route:', err.message);
        ctx.status = 500;
        ctx.body = { error: 'Failed to fetch route', details: err.message };
    }
});

export default routeRouter;
