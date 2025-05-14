import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './requireAuth.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export const messageRouter = new Router();

// Get all messages for a specific final_cart_id
messageRouter.get('/:finalCartId', requireAuth, async (ctx) => {
    const finalCartId = ctx.params.finalCartId;
    console.log("[SERVER] GET /messages/:finalCartId", finalCartId);

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('final_cart_id', Number(finalCartId))
        .order('timestamp', { ascending: true });

    if (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to fetch messages'};
        return;
    }

    ctx.body = data;
});

// Send a new message to a specific final cart
messageRouter.post('/:finalCartId', requireAuth, async (ctx) => {
    const { finalCartId } = ctx.params;
    const { text } = ctx.request.body;
    const email = ctx.state.user.email;

    if (!text) {
        ctx.status = 400;
        ctx.body = { message: 'Text is required' };
        return;
    }

    // Get sender role
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('email', email)
        .single();

    if (userError || !user) {
        ctx.status = 403;
        ctx.body = { message: 'User not found or unauthorized' };
        return;
    }

    const sender = user.role === 'admin' ? 'admin' : 'client';

    const { error: insertError } = await supabase
        .from('messages')
        .insert([{ final_cart_id: finalCartId, text, sender }]);

    if (insertError) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to send message' };
    } else {
        ctx.status = 201;
        ctx.body = { message: 'Message sent' };
    }
});

export default messageRouter;
