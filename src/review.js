import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { broadcast } from './wss.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export const reviewRouter = new Router();

// Get all reviews for a specific order (admin or user)
reviewRouter.get('/', async (ctx) => {
    const { order_id } = ctx.query;  // Get order_id from query parameter (e.g., ?order_id=1)

    if (!order_id) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Order ID is required' };
        return;
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('order_id', order_id);

    if (error || !data) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'No reviews found for this order' };
        return;
    }

    ctx.response.body = data;
});

// Create a new review
reviewRouter.post('/', async (ctx) => {
    const { user_id, order_id, score, text } = ctx.request.body;

    if (!user_id || !order_id || !score || !text) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Missing required fields' };
        return;
    }

    const { data, error } = await supabase
        .from('reviews')
        .insert([
            {
                user_id,
                order_id,
                score,
                text,
                time: new Date(),
            }
        ])
        .select()
        .single();

    if (error) {
        ctx.response.status = 400;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.body = data;
    broadcast(user_id, { type: 'review_created', payload: data });
});

// Update a review (this is optional and based on your needs)
reviewRouter.put('/:id', async (ctx) => {
    const reviewId = ctx.params.id;
    const reviewUpdate = ctx.request.body;

    const { data, error } = await supabase
        .from('reviews')
        .update(reviewUpdate)
        .eq('id', reviewId)
        .select()
        .single();

    if (error || !data) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'Review not found or not yours' };
        return;
    }

    ctx.response.body = data;
    broadcast(reviewUpdate.user_id, { type: 'review_updated', payload: data });
});

// Delete a review
reviewRouter.del('/:id', async (ctx) => {
    const reviewId = ctx.params.id;
    const { user_id } = ctx.state.user;  // Get the user ID from context (assuming JWT payload contains user info)

    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user_id);

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.status = 204;
});
