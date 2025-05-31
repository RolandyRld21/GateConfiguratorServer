import Router from 'koa-router';
import Stripe from 'stripe';
import { logger } from './logger.js';

export const paymentRouter = new Router();
const stripe = new Stripe('sk_test_51RMbDPRqZEV0vEeLHX4fm6spg5kagWHy7IYLe7Bl8euc4VIXgORhkH9buLZRvT9xvdkjNwAyhiHzwwfz0Sg0OQxR00CAjcUtaw', {
    apiVersion: '2022-11-15',
});

paymentRouter.post('/create-payment-intent', async (ctx) => {
    const { amount } = ctx.request.body;
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[PAYMENT][CREATE_INTENT] Email: ${userEmail}, Amount: ${amount} RON`);

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // ex: 5000 = 50.00 lei
            currency: 'ron',
        });

        logger.info(`[PAYMENT][CREATE_INTENT_SUCCESS] Email: ${userEmail}, Amount: ${amount} RON, PaymentIntentId: ${paymentIntent.id}`);
        ctx.body = {
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error) {
        logger.error(`[PAYMENT][CREATE_INTENT_ERROR] Email: ${userEmail}, Amount: ${amount} RON, Error: ${error.message}`);
        ctx.status = 500;
        ctx.body = { error: error.message };
    }
});