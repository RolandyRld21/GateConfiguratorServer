import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import { broadcast } from './wss.js';
import { logger } from './logger.js';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const articleRouter = new Router();

// Get all articles by user
articleRouter.get('/', async (ctx) => {
  const userId = ctx.state.user._id;
  logger.info(`[ARTICLE][GET_USER_ARTICLES] UserId: ${userId}`);

  try {
    const { data, error } = await supabase
        .from('gates')
        .select('*')
        .eq('userId', userId);

    if (error) {
      logger.error(`[ARTICLE][GET_USER_ARTICLES_ERROR] UserId: ${userId}, Error: ${error.message}`);
      ctx.response.status = 500;
      ctx.response.body = { message: error.message };
      return;
    }

    logger.info(`[ARTICLE][GET_USER_ARTICLES_SUCCESS] UserId: ${userId}, Count: ${data.length}`);
    ctx.response.body = data;
  } catch (err) {
    logger.error(`[ARTICLE][GET_USER_ARTICLES_ERROR] UserId: ${userId}, Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

// Get all articles (admin)
articleRouter.get('/all', async (ctx) => {
  logger.info(`[ARTICLE][GET_ALL_ARTICLES] Admin request`);

  try {
    const { data, error } = await supabase.from('gates').select('*');

    if (error) {
      logger.error(`[ARTICLE][GET_ALL_ARTICLES_ERROR] Error: ${error.message}`);
      ctx.response.status = 500;
      ctx.response.body = { message: error.message };
      return;
    }

    logger.info(`[ARTICLE][GET_ALL_ARTICLES_SUCCESS] Count: ${data.length}`);
    ctx.response.body = data;
  } catch (err) {
    logger.error(`[ARTICLE][GET_ALL_ARTICLES_ERROR] Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

// Get one article by ID
articleRouter.get('/:id', async (ctx) => {
  const articleId = ctx.params.id;
  logger.info(`[ARTICLE][GET_ARTICLE_BY_ID] ArticleId: ${articleId}`);

  try {
    const { data, error } = await supabase
        .from('gates')
        .select('*')
        .eq('_id', articleId)
        .single();

    if (error || !data) {
      logger.warn(`[ARTICLE][GET_ARTICLE_BY_ID_FAIL] ArticleId: ${articleId}, Error: ${error?.message || 'Not found'}`);
      ctx.response.status = 404;
      ctx.response.body = { message: 'Not found' };
      return;
    }

    logger.info(`[ARTICLE][GET_ARTICLE_BY_ID_SUCCESS] ArticleId: ${articleId}`);
    ctx.response.body = data;
  } catch (err) {
    logger.error(`[ARTICLE][GET_ARTICLE_BY_ID_ERROR] ArticleId: ${articleId}, Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

// Insert new article
articleRouter.post('/', async (ctx) => {
  const userId = ctx.state.user._id;
  const articleData = ctx.request.body;
  logger.info(`[ARTICLE][CREATE_ARTICLE] UserId: ${userId}, Title: ${articleData.text || 'N/A'}`);

  try {
    const article = { ...articleData, userId, date: new Date(), version: 1, isUseful: true };
    const { data, error } = await supabase.from('gates').insert([article]).select().single();

    if (error) {
      logger.error(`[ARTICLE][CREATE_ARTICLE_ERROR] UserId: ${userId}, Error: ${error.message}`);
      ctx.response.status = 400;
      ctx.response.body = { message: error.message };
      return;
    }

    logger.info(`[ARTICLE][CREATE_ARTICLE_SUCCESS] UserId: ${userId}, ArticleId: ${data._id}, Title: ${data.text}`);
    ctx.response.body = data;
    broadcast(userId, { type: 'created', payload: data });
  } catch (err) {
    logger.error(`[ARTICLE][CREATE_ARTICLE_ERROR] UserId: ${userId}, Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

// Update article
articleRouter.put('/:id', async (ctx) => {
  const articleId = ctx.params.id;
  const articleData = ctx.request.body;
  const userId = articleData.userId;
  logger.info(`[ARTICLE][UPDATE_ARTICLE] ArticleId: ${articleId}, UserId: ${userId}`);

  try {
    const article = { ...articleData, version: articleData.version + 1 };
    const { data, error } = await supabase.from('gates').update(article).eq('_id', articleId).select().single();

    if (error || !data) {
      logger.warn(`[ARTICLE][UPDATE_ARTICLE_FAIL] ArticleId: ${articleId}, Error: ${error?.message || 'Not found'}`);
      ctx.response.status = 404;
      ctx.response.body = { message: 'Not found' };
      return;
    }

    logger.info(`[ARTICLE][UPDATE_ARTICLE_SUCCESS] ArticleId: ${articleId}, Version: ${data.version}`);
    ctx.response.body = data;
    broadcast(article.userId, { type: 'updated', payload: data });
  } catch (err) {
    logger.error(`[ARTICLE][UPDATE_ARTICLE_ERROR] ArticleId: ${articleId}, Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});

// Delete article
articleRouter.del('/:id', async (ctx) => {
  const articleId = ctx.params.id;
  logger.info(`[ARTICLE][DELETE_ARTICLE] ArticleId: ${articleId}`);

  try {
    const { error } = await supabase.from('gates').delete().eq('_id', articleId);

    if (error) {
      logger.error(`[ARTICLE][DELETE_ARTICLE_ERROR] ArticleId: ${articleId}, Error: ${error.message}`);
      ctx.response.status = 500;
      ctx.response.body = { message: error.message };
      return;
    }

    logger.info(`[ARTICLE][DELETE_ARTICLE_SUCCESS] ArticleId: ${articleId}`);
    ctx.response.status = 204;
  } catch (err) {
    logger.error(`[ARTICLE][DELETE_ARTICLE_ERROR] ArticleId: ${articleId}, Error: ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: err.message };
  }
});