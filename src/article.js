import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { broadcast } from './wss.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export const articleRouter = new Router();

// Get all articles by user
articleRouter.get('/', async (ctx) => {
  const userId = ctx.state.user._id;
  const { data, error } = await supabase
      .from('gates')
      .select('*')
      .eq('userId', userId);

  if (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: error.message };
    return;
  }
  ctx.response.body = data;
});

// Get all articles (admin)
articleRouter.get('/all', async (ctx) => {
  const { data, error } = await supabase.from('gates').select('*');
  if (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: error.message };
    return;
  }
  ctx.response.body = data;
});

// Get one article by ID
articleRouter.get('/:id', async (ctx) => {

  const { data, error } = await supabase
      .from('gates')
      .select('*')
      .eq('_id', ctx.params.id)
      .single();

  if (error || !data) {
    console.warn('❌ Not found or error:', error);
    ctx.response.status = 404;
    ctx.response.body = { message: 'Not found' };
    return;
  }

  ctx.response.body = data;
});



// Insert new article
articleRouter.post('/', async (ctx) => {
  const userId = ctx.state.user._id;
  const article = { ...ctx.request.body, userId, date: new Date(), version: 1, isUseful: true };
  const { data, error } = await supabase.from('gates').insert([article]).select().single();
  if (error) {
    ctx.response.status = 400;
    ctx.response.body = { message: error.message };
    return;
  }
  ctx.response.body = data;
  broadcast(userId, { type: 'created', payload: data });
});

// Update article
articleRouter.put('/:id', async (ctx) => {
  const id = ctx.params.id;
  const article = { ...ctx.request.body, version: ctx.request.body.version + 1 };
  const { data, error } = await supabase.from('gates').update(article).eq('_id', id).select().single();
  if (error || !data) {
    ctx.response.status = 404;
    ctx.response.body = { message: 'Not found' };
    return;
  }
  ctx.response.body = data;
  broadcast(article.userId, { type: 'updated', payload: data });
});

// Delete article
articleRouter.del('/:id', async (ctx) => {
  const { error } = await supabase.from('gates').delete().eq('_id', ctx.params.id);
  if (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: error.message };
    return;
  }
  ctx.response.status = 204;
});
