import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const orderRouter = new Router();

// Get all orders for current user
orderRouter.get('/', async (ctx) => {
    const email = ctx.state.user.email;
    const finalCartId = ctx.query.final_cart_id;

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !userData) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'User not found' };
        return;
    }

    const userId = userData.id;

    let query = supabase
        .from('orders')
        .select(`
        *,
        gates (
            text
        )
    `)
        .eq('user_id', userId);

    if (finalCartId) {
        const parsedId = parseInt(finalCartId);
        if (!isNaN(parsedId)) {
            query = query.eq('final_cart_id', parsedId);
        }
    }

    const { data, error } = await query;

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Error fetching orders', detail: error.message };
        return;
    }

    ctx.response.body = data;

});

// Get all orders (admin)
orderRouter.get('/all', async (ctx) => {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }
    ctx.response.body = data;
});

// Get one order by ID
orderRouter.get('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', ctx.params.id)
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'Not found' };
        return;
    }

    ctx.response.body = data;
});

// Place a new order
orderRouter.post('/', async (ctx) => {
    const { email } = ctx.state.user;
    const {
        gate_id, width, height, color,
        option1, option2, option3, option4, option5,
        latitude, longitude
    } = ctx.request.body;

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !user) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'User not found' };
        return;
    }

    const { data: gate, error: gateError } = await supabase
        .from('gates')
        .select('price, option1, option2, option3, option4, option5')
        .eq('_id', gate_id)
        .single();

    if (gateError || !gate) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'Gate not found' };
        return;
    }

    const base = gate.price * width * height/10000;
    const extras =
        (option1 ? gate.option1 : 0) +
        (option2 ? gate.option2 : 0) +
        (option3 ? gate.option3 : 0) +
        (option4 ? gate.option4 : 0) +
        (option5 ? gate.option5 : 0);

    const total_price = base + extras;

    const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert([{
            user_id: user.id,
            gate_id,
            width,
            height,
            color,
            option1,
            option2,
            option3,
            option4,
            option5,
            total_price,
            latitude,
            longitude
        }])
        .select()
        .single();

    if (insertError) {
        ctx.response.status = 400;
        ctx.response.body = { message: insertError.message };
        return;
    }

    ctx.response.body = order;
});

// Update an order
orderRouter.put('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const orderId = ctx.params.id;
    const orderUpdate = ctx.request.body;

    const { data, error } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', orderId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error || !data) {
        ctx.response.status = 404;
        ctx.response.body = { message: 'Order not found or not yours' };
        return;
    }

    ctx.response.body = data;
});

orderRouter.del('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const orderId = parseInt(ctx.params.id);

    if (isNaN(orderId)) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Invalid order ID' };
        return;
    }

    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId);

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.status = 204;
});
// Get all orders from a specific final_cart_id (ADMIN)
orderRouter.get('/admin/final-cart/:id', async (ctx) => {
    const finalCartId = parseInt(ctx.params.id);
    if (isNaN(finalCartId)) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Invalid final_cart_id' };
        return;
    }

    // Fetch orders with joined gates table to get gate text
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            gates (
                text
            )
        `)
        .eq('final_cart_id', finalCartId);

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Failed to fetch orders', detail: error.message };
        return;
    }

    ctx.response.body = data;

});

