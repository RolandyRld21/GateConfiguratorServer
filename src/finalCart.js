import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export const finalCartRouter = new Router();

// Finalize current cart into a final_cart group
finalCartRouter.post('/', async (ctx) => {
    console.log('[🧪] ctx.state.user:', ctx.state.user); // 🔍 vezi dacă e undefined

    const email = ctx.state.user.email;
    const { address_id, delivery_fee } = ctx.request.body;
    console.log("email:", email);
    // Get user_id
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
    console.log(user);
    if (userError || !user) {
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
        ctx.response.status = 400;
        ctx.response.body = { message: 'No orders to finalize' };
        return;
    }

    const totalProductPrice = pendingOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const totalPrice = totalProductPrice + delivery_fee;

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
        ctx.response.status = 500;
        ctx.response.body = { message: 'Failed to link orders to final_cart' };
        return;
    }

    ctx.response.status = 201;
    ctx.response.body = { message: 'Cart finalized', final_cart: finalCart };
});


// Get all final carts for the current user
finalCartRouter.get('/', async (ctx) => {
    const email = ctx.state.user.email;

    // Fetch user ID
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

    const userId = user.id;

    // Get all final carts for this user
    const { data: carts, error: cartError } = await supabase
        .from('final_cart')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (cartError) {
        ctx.response.status = 500;
        ctx.response.body = { message: cartError.message };
        return;
    }

    ctx.response.body = carts;
});

