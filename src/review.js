import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { broadcast } from './wss.js';
import { logger } from './logger.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const reviewRouter = new Router();

// Get all reviews for a specific order (admin or user)
reviewRouter.get('/', async (ctx) => {
    const { order_id } = ctx.query;
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[REVIEW][GET_ORDER_REVIEWS] Email: ${userEmail}, OrderId: ${order_id}`);

    try {
        if (!order_id) {
            logger.warn(`[REVIEW][GET_ORDER_REVIEWS_FAIL] Email: ${userEmail}, Missing order_id`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'Order ID is required' };
            return;
        }

        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('order_id', order_id);

        if (error || !data) {
            logger.warn(`[REVIEW][GET_ORDER_REVIEWS_FAIL] Email: ${userEmail}, OrderId: ${order_id}, No reviews found`);
            ctx.response.status = 404;
            ctx.response.body = { message: 'No reviews found for this order' };
            return;
        }

        logger.info(`[REVIEW][GET_ORDER_REVIEWS_SUCCESS] Email: ${userEmail}, OrderId: ${order_id}, Count: ${data.length}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[REVIEW][GET_ORDER_REVIEWS_ERROR] Email: ${userEmail}, OrderId: ${order_id}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Create a new review
reviewRouter.post('/', async (ctx) => {
    const { email, order_id, score, text } = ctx.request.body;
    logger.info(`[REVIEW][CREATE_REVIEW] Email: ${email}, OrderId: ${order_id}, Score: ${score}`);

    try {
        if (!email || !order_id || !score || !text) {
            logger.warn(`[REVIEW][CREATE_REVIEW_FAIL] Email: ${email}, Missing required fields`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'Missing required fields' };
            return;
        }

        // Fetch the user_id using the email
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            logger.warn(`[REVIEW][CREATE_REVIEW_FAIL] Email: ${email}, User not found`);
            ctx.response.status = 404;
            ctx.response.body = { message: 'User not found' };
            return;
        }

        const user_id = userData.id;

        // Now insert the review using the user_id
        const { data, error } = await supabase
            .from('reviews')
            .insert([
                {
                    user_id,
                    order_id,
                    score,
                    text,
                    time: new Date().toISOString(),
                }
            ])
            .select()
            .single();

        if (error) {
            logger.error(`[REVIEW][CREATE_REVIEW_ERROR] Email: ${email}, OrderId: ${order_id}, Error: ${error.message}`);
            ctx.response.status = 400;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[REVIEW][CREATE_REVIEW_SUCCESS] Email: ${email}, ReviewId: ${data.id}, OrderId: ${order_id}, Score: ${score}`);
        ctx.response.body = data;
        broadcast(user_id, { type: 'review_created', payload: data });

    } catch (err) {
        logger.error(`[REVIEW][CREATE_REVIEW_ERROR] Email: ${email}, OrderId: ${order_id}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Update a review (this is optional and based on your needs)
reviewRouter.put('/:id', async (ctx) => {
    const reviewId = ctx.params.id;
    const reviewUpdate = ctx.request.body;
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[REVIEW][UPDATE_REVIEW] Email: ${userEmail}, ReviewId: ${reviewId}`);

    try {
        const { data, error } = await supabase
            .from('reviews')
            .update(reviewUpdate)
            .eq('id', reviewId)
            .select()
            .single();

        if (error || !data) {
            logger.warn(`[REVIEW][UPDATE_REVIEW_FAIL] Email: ${userEmail}, ReviewId: ${reviewId}, Review not found`);
            ctx.response.status = 404;
            ctx.response.body = { message: 'Review not found or not yours' };
            return;
        }

        logger.info(`[REVIEW][UPDATE_REVIEW_SUCCESS] Email: ${userEmail}, ReviewId: ${reviewId}`);
        ctx.response.body = data;
        broadcast(reviewUpdate.user_id, { type: 'review_updated', payload: data });

    } catch (err) {
        logger.error(`[REVIEW][UPDATE_REVIEW_ERROR] Email: ${userEmail}, ReviewId: ${reviewId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Delete a review
reviewRouter.del('/:id', async (ctx) => {
    const reviewId = parseInt(ctx.params.id);
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[REVIEW][DELETE_REVIEW] Email: ${userEmail}, ReviewId: ${reviewId}`);

    try {
        if (isNaN(reviewId)) {
            logger.warn(`[REVIEW][DELETE_REVIEW_FAIL] Email: ${userEmail}, Invalid review ID: ${ctx.params.id}`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'Invalid review ID' };
            return;
        }

        const { user_id } = ctx.state.user;

        const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', reviewId);

        if (error) {
            logger.error(`[REVIEW][DELETE_REVIEW_ERROR] Email: ${userEmail}, ReviewId: ${reviewId}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[REVIEW][DELETE_REVIEW_SUCCESS] Email: ${userEmail}, ReviewId: ${reviewId}`);
        ctx.response.status = 204;

    } catch (err) {
        logger.error(`[REVIEW][DELETE_REVIEW_ERROR] Email: ${userEmail}, ReviewId: ${reviewId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// GET /reviews/gate/:gateId
reviewRouter.get('/gate/:gateId', async (ctx) => {
    const gateId = ctx.params.gateId;
    const sortField = ctx.query.sortField === 'score' ? 'score' : 'time';
    const sortOrder = ctx.query.sortOrder === 'asc';
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[REVIEW][GET_GATE_REVIEWS] Email: ${userEmail}, GateId: ${gateId}, Sort: ${sortField} ${sortOrder ? 'asc' : 'desc'}`);

    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*, orders!inner(gate_id)')
            .eq('orders.gate_id', gateId)
            .order(sortField, { ascending: sortOrder });

        if (error) {
            logger.error(`[REVIEW][GET_GATE_REVIEWS_ERROR] Email: ${userEmail}, GateId: ${gateId}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[REVIEW][GET_GATE_REVIEWS_SUCCESS] Email: ${userEmail}, GateId: ${gateId}, Count: ${data.length}`);
        ctx.response.body = { reviews: data };

    } catch (err) {
        logger.error(`[REVIEW][GET_GATE_REVIEWS_ERROR] Email: ${userEmail}, GateId: ${gateId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

reviewRouter.get('/all', async (ctx) => {
    const offset = parseInt(ctx.query.offset) || 0;
    const limit = parseInt(ctx.query.limit) || 2;
    const sortField = ctx.query.sortField === 'score' ? 'score' : 'time';
    const sortOrder = ctx.query.sortOrder === 'asc';
    const userEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[REVIEW][GET_ALL_REVIEWS] Email: ${userEmail}, Offset: ${offset}, Limit: ${limit}, Sort: ${sortField} ${sortOrder ? 'asc' : 'desc'}`);

    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .order(sortField, { ascending: sortOrder })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error(`[REVIEW][GET_ALL_REVIEWS_ERROR] Email: ${userEmail}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[REVIEW][GET_ALL_REVIEWS_SUCCESS] Email: ${userEmail}, Count: ${data.length}, Offset: ${offset}, Limit: ${limit}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[REVIEW][GET_ALL_REVIEWS_ERROR] Email: ${userEmail}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});