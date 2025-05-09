import Router from 'koa-router';
import Stripe from 'stripe';

export const paymentRouter = new Router();
const stripe = new Stripe('sk_test_51RMbDPRqZEV0vEeLHX4fm6spg5kagWHy7IYLe7Bl8euc4VIXgORhkH9buLZRvT9xvdkjNwAyhiHzwwfz0Sg0OQxR00CAjcUtaw', {
    apiVersion: '2022-11-15',
});


paymentRouter.post('/create-payment-intent', async (ctx) => {
    const { amount } = ctx.request.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // ex: 5000 = 50.00 lei
            currency: 'ron',
        });

        ctx.body = {
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error) {
        console.error(error);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});
