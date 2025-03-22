import Router from 'koa-router';
import dataStore from 'nedb-promise';
import { broadcast } from './wss.js';

export class ArticleStore {
  constructor({ filename, autoload }) {
    this.store = dataStore({ filename, autoload });
  }

  // Search based on props
  async find(props) {
    return this.store.find(props);
  }

  // Return a single article
  async findOne(props) {
    return this.store.findOne(props);
  }

  // Add a new article
  async insert(article) {
    if (!article.text) { // Validation
      throw new Error('Missing text property');
    }
    if (article.price === undefined || typeof article.price !== 'number' || article.price < 0) {
      throw new Error('Missing or invalid price property');
    }
    return this.store.insert(article);
  }

  // Modify an article
  async update(props, article) {
    return this.store.update(props, { $set: article }, { multi: false, upsert: false });
  }

  // Delete an article
  async remove(props) {
    return this.store.remove(props);
  }
}

const articleStore = new ArticleStore({ filename: './db/articles_extended.json', autoload: true });
export const articleRouter = new Router();

// Find articles by user
articleRouter.get('/', async (ctx) => {
  console.log("find:");
  const userId = ctx.state.user._id;
  ctx.response.body = await articleStore.find({ userId });
  ctx.response.status = 200; // OK
});

// Find all articles (admin access)
articleRouter.get('/all', async (ctx) => {
  console.log("find all articles:");
  ctx.response.body = await articleStore.find({});
  ctx.response.status = 200; // OK
});

// Find one article by ID
articleRouter.get('/:id', async (ctx) => {
  console.log("findOne:");
  const userId = ctx.state.user._id;
  const article = await articleStore.findOne({ _id: ctx.params.id });

  if (article) {
    if (article.userId === userId) {
      ctx.response.body = article;
      ctx.response.status = 200; // OK
    } else {
      ctx.response.status = 403; // Forbidden
    }
  } else {
    ctx.response.status = 404; // Not Found
  }
});

// Create article helper function
const createArticle = async (ctx, article, response) => {
  try {
    console.log("insert:");
    const userId = ctx.state.user._id;
    article.userId = userId;
    article.date = new Date();
    article.version = 1;
    article.isUseful = true;

    if (article.price === undefined || typeof article.price !== 'number' || article.price < 0) {
      response.body = { message: 'Missing or invalid price property' };
      response.status = 400; // Bad request
      return;
    }

    console.log(article);
    response.body = await articleStore.insert(article);
    console.log(response.body);
    response.status = 201; // Created
    broadcast(userId, { type: 'created', payload: response.body });
  } catch (err) {
    response.body = { message: err.message };
    response.status = 400; // Bad request
  }
};

// Insert a new article
articleRouter.post('/', async ctx => {
  console.log("Received POST request:", ctx.request.body); // LOG REQUEST BODY
  await createArticle(ctx, ctx.request.body, ctx.response);
});

// Update an existing article
articleRouter.put('/:id', async ctx => {
  console.log("update:");
  const article = ctx.request.body;
  const id = ctx.params.id;
  console.log("param's ':id':", id);
  const articleId = article._id;
  console.log("article's '_id':", articleId);
  const response = ctx.response;

  if (articleId && articleId !== id) {
    response.body = { message: 'Param id and body _id should be the same' };
    response.status = 400; // Bad request
    return;
  }

  if (!articleId) {
    console.log("in update - await createArticle");
    await createArticle(ctx, article, response);
  } else {
    const userId = ctx.state.user._id;
    article.version++;

    if (article.price === undefined || typeof article.price !== 'number' || article.price < 0) {
      response.body = { message: 'Missing or invalid price property' };
      response.status = 400; // Bad request
      return;
    }

    console.log("article:", article);

    const updatedCount = await articleStore.update({ _id: id }, article);

    if (updatedCount === 1) {
      response.body = article;
      response.status = 200; // OK
      broadcast(userId, { type: 'updated', payload: article });
    } else {
      response.body = { message: 'Resource no longer exists' };
      response.status = 405; // Method not allowed
    }
  }
});

// Remove an article
articleRouter.del('/:id', async (ctx) => {
  console.log("remove:");
  const userId = ctx.state.user._id;
  const article = await articleStore.findOne({ _id: ctx.params.id });

  if (article && userId !== article.userId) {
    ctx.response.status = 403; // Forbidden
  } else {
    await articleStore.remove({ _id: ctx.params.id });
    ctx.response.status = 204; // No content
  }
});
