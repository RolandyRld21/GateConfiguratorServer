import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const orderRouter = new Router();

// Get all orders for current user
orderRouter.get('/', async (ctx) => {
    const email = ctx.state.user.email;
    const finalCartId = ctx.query.final_cart_id;
    logger.info(`[ORDER][GET_USER_ORDERS] Email: ${email}, FinalCartId: ${finalCartId || 'N/A'}`);

    try {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            logger.warn(`[ORDER][GET_USER_ORDERS_FAIL] Email: ${email}, User not found`);
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
                logger.info(`[ORDER][GET_USER_ORDERS_FILTER] Email: ${email}, FilterByFinalCartId: ${parsedId}`);
            }
        }

        const { data, error } = await query;

        if (error) {
            logger.error(`[ORDER][GET_USER_ORDERS_ERROR] Email: ${email}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: 'Error fetching orders', detail: error.message };
            return;
        }

        logger.info(`[ORDER][GET_USER_ORDERS_SUCCESS] Email: ${email}, Count: ${data.length}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[ORDER][GET_USER_ORDERS_ERROR] Email: ${email}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Get all orders (admin)
orderRouter.get('/all', async (ctx) => {
    const requesterEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[ORDER][GET_ALL_ORDERS] Admin: ${requesterEmail}`);

    try {
        const { data, error } = await supabase.from('orders').select('*');

        if (error) {
            logger.error(`[ORDER][GET_ALL_ORDERS_ERROR] Admin: ${requesterEmail}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[ORDER][GET_ALL_ORDERS_SUCCESS] Admin: ${requesterEmail}, Count: ${data.length}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[ORDER][GET_ALL_ORDERS_ERROR] Admin: ${requesterEmail}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Get one order by ID
orderRouter.get('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const orderId = ctx.params.id;
    const userEmail = ctx.state.user.email || 'Unknown';
    logger.info(`[ORDER][GET_ORDER_BY_ID] Email: ${userEmail}, OrderId: ${orderId}`);

    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            logger.warn(`[ORDER][GET_ORDER_BY_ID_FAIL] Email: ${userEmail}, OrderId: ${orderId}, Not found`);
            ctx.response.status = 404;
            ctx.response.body = { message: 'Not found' };
            return;
        }

        logger.info(`[ORDER][GET_ORDER_BY_ID_SUCCESS] Email: ${userEmail}, OrderId: ${orderId}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[ORDER][GET_ORDER_BY_ID_ERROR] Email: ${userEmail}, OrderId: ${orderId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Place a new order
orderRouter.post('/', async (ctx) => {
    const { email } = ctx.state.user;
    const {
        gate_id, width, height, color,
        option1, option2, option3, option4, option5,
        latitude, longitude
    } = ctx.request.body;

    logger.info(`[ORDER][CREATE_ORDER] Email: ${email}, GateId: ${gate_id}, Dimensions: ${width}x${height}`);

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logger.warn(`[ORDER][CREATE_ORDER_FAIL] Email: ${email}, User not found`);
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
            logger.warn(`[ORDER][CREATE_ORDER_FAIL] Email: ${email}, GateId: ${gate_id}, Gate not found`);
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

        logger.info(`[ORDER][CALCULATE_PRICE] Email: ${email}, GateId: ${gate_id}, BasePrice: ${base}, Extras: ${extras}, Total: ${total_price}`);

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
            logger.error(`[ORDER][CREATE_ORDER_ERROR] Email: ${email}, GateId: ${gate_id}, Error: ${insertError.message}`);
            ctx.response.status = 400;
            ctx.response.body = { message: insertError.message };
            return;
        }

        logger.info(`[ORDER][CREATE_ORDER_SUCCESS] Email: ${email}, OrderId: ${order.id}, GateId: ${gate_id}, Total: ${total_price}`);
        ctx.response.body = order;

    } catch (err) {
        logger.error(`[ORDER][CREATE_ORDER_ERROR] Email: ${email}, GateId: ${gate_id}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Update an order
orderRouter.put('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const orderId = ctx.params.id;
    const orderUpdate = ctx.request.body;
    const userEmail = ctx.state.user.email || 'Unknown';
    logger.info(`[ORDER][UPDATE_ORDER] Email: ${userEmail}, OrderId: ${orderId}`);

    try {
        const { data, error } = await supabase
            .from('orders')
            .update(orderUpdate)
            .eq('id', orderId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error || !data) {
            logger.warn(`[ORDER][UPDATE_ORDER_FAIL] Email: ${userEmail}, OrderId: ${orderId}, Order not found or not yours`);
            ctx.response.status = 404;
            ctx.response.body = { message: 'Order not found or not yours' };
            return;
        }

        logger.info(`[ORDER][UPDATE_ORDER_SUCCESS] Email: ${userEmail}, OrderId: ${orderId}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[ORDER][UPDATE_ORDER_ERROR] Email: ${userEmail}, OrderId: ${orderId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

orderRouter.del('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const orderId = parseInt(ctx.params.id);
    const userEmail = ctx.state.user.email || 'Unknown';
    logger.info(`[ORDER][DELETE_ORDER] Email: ${userEmail}, OrderId: ${orderId}`);

    try {
        if (isNaN(orderId)) {
            logger.warn(`[ORDER][DELETE_ORDER_FAIL] Email: ${userEmail}, Invalid order ID: ${ctx.params.id}`);
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
            logger.error(`[ORDER][DELETE_ORDER_ERROR] Email: ${userEmail}, OrderId: ${orderId}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[ORDER][DELETE_ORDER_SUCCESS] Email: ${userEmail}, OrderId: ${orderId}`);
        ctx.response.status = 204;

    } catch (err) {
        logger.error(`[ORDER][DELETE_ORDER_ERROR] Email: ${userEmail}, OrderId: ${orderId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Get all orders from a specific final_cart_id (ADMIN)
orderRouter.get('/admin/final-cart/:id', async (ctx) => {
    const finalCartId = parseInt(ctx.params.id);
    const requesterEmail = ctx.state.user?.email || 'Unknown';
    logger.info(`[ORDER][GET_FINAL_CART_ORDERS] Admin: ${requesterEmail}, FinalCartId: ${finalCartId}`);

    try {
        if (isNaN(finalCartId)) {
            logger.warn(`[ORDER][GET_FINAL_CART_ORDERS_FAIL] Admin: ${requesterEmail}, Invalid final_cart_id: ${ctx.params.id}`);
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
            logger.error(`[ORDER][GET_FINAL_CART_ORDERS_ERROR] Admin: ${requesterEmail}, FinalCartId: ${finalCartId}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: 'Failed to fetch orders', detail: error.message };
            return;
        }

        logger.info(`[ORDER][GET_FINAL_CART_ORDERS_SUCCESS] Admin: ${requesterEmail}, FinalCartId: ${finalCartId}, Count: ${data.length}`);
        ctx.response.body = data;

    } catch (err) {
        logger.error(`[ORDER][GET_FINAL_CART_ORDERS_ERROR] Admin: ${requesterEmail}, FinalCartId: ${finalCartId}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});