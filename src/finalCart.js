import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import {requireAuth} from "./requireAuth.js";
import { logger } from './logger.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const finalCartRouter = new Router();

// Finalize current cart into a final_cart group
finalCartRouter.post('/', async (ctx) => {
    const email = ctx.state.user.email;
    const { address_id, delivery_fee } = ctx.request.body;
    logger.info(`[FINAL_CART][FINALIZE_CART] Email: ${email}, AddressId: ${address_id}, DeliveryFee: ${delivery_fee}`);

    try {
        // Get user_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logger.warn(`[FINAL_CART][FINALIZE_CART_FAIL] Email: ${email}, User not found`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'User not found' };
            return;
        }

        const userId = user.id;

        // Get orders in cart (final_cart_id IS NULL)
        const { data: pendingOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, total_price')
            .eq('user_id', userId)
            .is('final_cart_id', null);

        if (ordersError || !pendingOrders || pendingOrders.length === 0) {
            logger.warn(`[FINAL_CART][FINALIZE_CART_FAIL] Email: ${email}, No orders to finalize`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'No orders to finalize' };
            return;
        }

        const totalProductPrice = pendingOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const totalPrice = totalProductPrice + delivery_fee;
        logger.info(`[FINAL_CART][CALCULATE_TOTAL] Email: ${email}, OrdersCount: ${pendingOrders.length}, ProductTotal: ${totalProductPrice}, FinalTotal: ${totalPrice}`);

        // Create final_cart entry
        const { data: finalCart, error: insertError } = await supabase
            .from('final_cart')
            .insert([{
                user_id: userId,
                address_id,
                delivery_fee,
                total_price: totalPrice,
                created_at: new Date()
            }])
            .select()
            .single();

        if (insertError || !finalCart) {
            logger.error(`[FINAL_CART][FINALIZE_CART_ERROR] Email: ${email}, Error: ${insertError?.message || 'Failed to create final_cart'}`);
            ctx.response.status = 500;
            ctx.response.body = { message: 'Failed to create final_cart' };
            return;
        }

        // Update orders with final_cart_id
        const { error: updateError } = await supabase
            .from('orders')
            .update({ final_cart_id: finalCart.id })
            .eq('user_id', userId)
            .is('final_cart_id', null);

        if (updateError) {
            logger.error(`[FINAL_CART][FINALIZE_CART_ERROR] Email: ${email}, FinalCartId: ${finalCart.id}, Error: ${updateError.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: 'Failed to link orders to final_cart' };
            return;
        }

        logger.info(`[FINAL_CART][FINALIZE_CART_SUCCESS] Email: ${email}, FinalCartId: ${finalCart.id}, OrdersLinked: ${pendingOrders.length}`);
        ctx.response.status = 201;
        ctx.response.body = { message: 'Cart finalized', final_cart: finalCart };

    } catch (err) {
        logger.error(`[FINAL_CART][FINALIZE_CART_ERROR] Email: ${email}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Get all final carts for the current user
finalCartRouter.get('/', async (ctx) => {
    const email = ctx.state.user.email;
    logger.info(`[FINAL_CART][GET_USER_CARTS] Email: ${email}`);

    try {
        // Fetch user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logger.warn(`[FINAL_CART][GET_USER_CARTS_FAIL] Email: ${email}, User not found`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'User not found' };
            return;
        }

        const userId = user.id;

        // Get all final carts for this user
        const { data: carts, error: cartError } = await supabase
            .from('final_cart')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (cartError) {
            logger.error(`[FINAL_CART][GET_USER_CARTS_ERROR] Email: ${email}, Error: ${cartError.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: cartError.message };
            return;
        }

        logger.info(`[FINAL_CART][GET_USER_CARTS_SUCCESS] Email: ${email}, Count: ${carts.length}`);
        ctx.response.body = carts;

    } catch (err) {
        logger.error(`[FINAL_CART][GET_USER_CARTS_ERROR] Email: ${email}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

finalCartRouter.patch('/admin/:id', requireAuth, async (ctx) => {
    const cartId = ctx.params.id;
    const { status } = ctx.request.body;
    const requesterEmail = ctx.state.user.email;
    logger.info(`[FINAL_CART][UPDATE_STATUS] Admin: ${requesterEmail}, CartId: ${cartId}, NewStatus: ${status}`);

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('email', requesterEmail)
            .single();

        if (userError || user.role !== 'admin') {
            logger.warn(`[FINAL_CART][UPDATE_STATUS_DENIED] Requester: ${requesterEmail} (Not admin)`);
            ctx.status = 403;
            ctx.body = { message: 'Access denied' };
            return;
        }

        const { error } = await supabase
            .from('final_cart')
            .update({ status })
            .eq('id', cartId);

        if (error) {
            logger.error(`[FINAL_CART][UPDATE_STATUS_ERROR] Admin: ${requesterEmail}, CartId: ${cartId}, Error: ${error.message}`);
            ctx.status = 500;
            ctx.body = { message: 'Failed to update status' };
        } else {
            logger.info(`[FINAL_CART][UPDATE_STATUS_SUCCESS] Admin: ${requesterEmail}, CartId: ${cartId}, Status: ${status}`);
            ctx.status = 200;
            ctx.body = { message: 'Status updated' };
        }

    } catch (err) {
        logger.error(`[FINAL_CART][UPDATE_STATUS_ERROR] Admin: ${requesterEmail}, CartId: ${cartId}, Error: ${err.message}`);
        ctx.status = 500;
        ctx.body = { message: err.message };
    }
});

// GET /api/final-cart/admin - toate comenzile pentru admin
finalCartRouter.get('/admin', requireAuth, async (ctx) => {
    const requesterEmail = ctx.state.user.email;
    logger.info(`[FINAL_CART][GET_ALL_CARTS] Admin: ${requesterEmail}`);

    try {
        // verifică dacă e admin
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('email', requesterEmail)
            .single();

        if (userError || user?.role !== 'admin') {
            logger.warn(`[FINAL_CART][GET_ALL_CARTS_DENIED] Requester: ${requesterEmail} (Not admin)`);
            ctx.status = 403;
            ctx.body = { message: 'Access denied' };
            return;
        }

        const { data, error } = await supabase
            .from('final_cart')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error(`[FINAL_CART][GET_ALL_CARTS_ERROR] Admin: ${requesterEmail}, Error: ${error.message}`);
            ctx.status = 500;
            ctx.body = { message: 'Failed to fetch final carts' };
        } else {
            logger.info(`[FINAL_CART][GET_ALL_CARTS_SUCCESS] Admin: ${requesterEmail}, Count: ${data.length}`);
            ctx.status = 200;
            ctx.body = data;
        }

    } catch (err) {
        logger.error(`[FINAL_CART][GET_ALL_CARTS_ERROR] Admin: ${requesterEmail}, Error: ${err.message}`);
        ctx.status = 500;
        ctx.body = { message: err.message };
    }
});