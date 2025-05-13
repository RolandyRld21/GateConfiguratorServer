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
    console.log(ctx.response.body);
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
    const { email, order_id, score, text } = ctx.request.body;
    console.log(ctx.response.body);
    console.log(email,order_id,score,text);

    if (!email || !order_id || !score || !text) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Missing required fields' };
        return;
    }

    // Fetch the user_id using the email
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)  // Find the user by email
        .single();

    if (userError || !userData) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'User not found' };
        return;
    }

    const user_id = userData.id; // Use the user ID from the query

    // Now insert the review using the user_id
    const { data, error } = await supabase
        .from('reviews')
        .insert([
            {
                user_id,
                order_id,
                score,
                text,
                time: new Date().toISOString(), // Timestamp when the review is created
            }
        ])
        .select()
        .single();

    if (error) {
        ctx.response.status = 400;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.body = data;  // Return the review data
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
    const reviewId = parseInt(ctx.params.id);
    if (isNaN(reviewId)) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Invalid review ID' };
        return;
    }

    const { user_id } = ctx.state.user;

    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)       // acum e integer


    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.status = 204;
});

// GET /reviews/gate/:gateId
reviewRouter.get('/gate/:gateId', async (ctx) => {
    const gateId = ctx.params.gateId;
    const sortField = ctx.query.sortField === 'score' ? 'score' : 'time';
    const sortOrder = ctx.query.sortOrder === 'asc';

    const { data, error } = await supabase
        .from('reviews')
        .select('*, orders!inner(gate_id)')
        .eq('orders.gate_id', gateId)
        .order(sortField, { ascending: sortOrder }); // ✅ FĂRĂ range

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.body = { reviews: data }; // ✅ FĂRĂ total
});



reviewRouter.get('/all', async (ctx) => {
    const offset = parseInt(ctx.query.offset) || 0;
    const limit = parseInt(ctx.query.limit) || 2;
    const sortField = ctx.query.sortField === 'score' ? 'score' : 'time'; // default: time
    const sortOrder = ctx.query.sortOrder === 'asc';

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order(sortField, { ascending: sortOrder })
        .range(offset, offset + limit - 1);

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.body = data;
});
