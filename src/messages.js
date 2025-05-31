import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './requireAuth.js';
import { logger } from './logger.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const messageRouter = new Router();

// Get all messages for a specific final_cart_id
messageRouter.get('/:finalCartId', requireAuth, async (ctx) => {
    const finalCartId = ctx.params.finalCartId;
    const email = ctx.state.user.email;
    logger.info(`[MESSAGE][GET_MESSAGES] Email: ${email}, FinalCartId: ${finalCartId}`);

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('final_cart_id', Number(finalCartId))
            .order('timestamp', { ascending: true });

        if (error) {
            logger.error(`[MESSAGE][GET_MESSAGES_ERROR] Email: ${email}, FinalCartId: ${finalCartId}, Error: ${error.message}`);
            ctx.status = 500;
            ctx.body = { message: 'Failed to fetch messages'};
            return;
        }

        logger.info(`[MESSAGE][GET_MESSAGES_SUCCESS] Email: ${email}, FinalCartId: ${finalCartId}, Count: ${data.length}`);
        ctx.body = data;

    } catch (err) {
        logger.error(`[MESSAGE][GET_MESSAGES_ERROR] Email: ${email}, FinalCartId: ${finalCartId}, Error: ${err.message}`);
        ctx.status = 500;
        ctx.body = { message: err.message };
    }
});

// Send a new message to a specific final cart
messageRouter.post('/:finalCartId', requireAuth, async (ctx) => {
    const { finalCartId } = ctx.params;
    const { text } = ctx.request.body;
    const email = ctx.state.user.email;
    logger.info(`[MESSAGE][SEND_MESSAGE] Email: ${email}, FinalCartId: ${finalCartId}, TextLength: ${text?.length || 0}`);

    try {
        if (!text) {
            logger.warn(`[MESSAGE][SEND_MESSAGE_FAIL] Email: ${email}, FinalCartId: ${finalCartId}, Missing text`);
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
            logger.warn(`[MESSAGE][SEND_MESSAGE_FAIL] Email: ${email}, FinalCartId: ${finalCartId}, User not found or unauthorized`);
            ctx.status = 403;
            ctx.body = { message: 'User not found or unauthorized' };
            return;
        }

        const sender = user.role === 'admin' ? 'admin' : 'client';
        logger.info(`[MESSAGE][SEND_MESSAGE_ATTEMPT] Email: ${email}, FinalCartId: ${finalCartId}, Sender: ${sender}`);

        const { error: insertError } = await supabase
            .from('messages')
            .insert([{ final_cart_id: finalCartId, text, sender }]);

        if (insertError) {
            logger.error(`[MESSAGE][SEND_MESSAGE_ERROR] Email: ${email}, FinalCartId: ${finalCartId}, Sender: ${sender}, Error: ${insertError.message}`);
            ctx.status = 500;
            ctx.body = { message: 'Failed to send message' };
        } else {
            logger.info(`[MESSAGE][SEND_MESSAGE_SUCCESS] Email: ${email}, FinalCartId: ${finalCartId}, Sender: ${sender}`);
            ctx.status = 201;
            ctx.body = { message: 'Message sent' };
        }

    } catch (err) {
        logger.error(`[MESSAGE][SEND_MESSAGE_ERROR] Email: ${email}, FinalCartId: ${finalCartId}, Error: ${err.message}`);
        ctx.status = 500;
        ctx.body = { message: err.message };
    }
});

export default messageRouter;