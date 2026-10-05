import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { requestId } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { categoriesRouter } from './routes/categories.js';
import { adminInventoryRouter } from './routes/adminInventory.js';
import { healthRouter } from './routes/health.js';
import { cartRouter } from './routes/cart.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter, paymentWebhookRouter } from './routes/payments.js';
import { adminCatalogRouter } from './routes/adminCatalog.js';
import { adminOperationsRouter } from './routes/adminOperations.js';
import {
publicReviewsRouter,
customerReviewsRouter,
adminReviewsRouter,
} from './routes/reviews.js';

import { uploadDir } from './lib/imageUpload.js';
import { forbidden } from './utils/httpError.js';
import { logger } from './utils/logger.js';

export function createApp(env, pool) {
const app = express();

app.disable('x-powered-by');

if (env.TRUST_PROXY) {
app.set('trust proxy', 1);
}

app.use(requestId);

app.use((req, res, next) => {
const start = process.hrtime.bigint();


res.on('finish', () => {
  logger.info('request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    status: res.statusCode,
    ms: Number((process.hrtime.bigint() - start) / 1_000_000n),
  });
});

next();

});

app.use(
helmet({
contentSecurityPolicy: {
directives: {
defaultSrc: ["'none'"],
frameAncestors: ["'none'"],
},
},
hsts: env.isProd
? { maxAge: 15552000, includeSubDomains: true }
: false,
referrerPolicy: { policy: 'no-referrer' },
crossOriginResourcePolicy: { policy: 'same-site' },
}),
);

app.use((req, res, next) => {
res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
next();
});

app.use(
cors({
origin(origin, cb) {
if (!origin || env.corsOrigins.includes(origin)) {
return cb(null, true);
}


    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
  maxAge: 600,
}),


);

app.use('/webhooks/payment', paymentWebhookRouter(env, pool));

app.use(express.json({ limit: '50kb', strict: true }));
app.use(cookieParser());

// CSRF protection: state-changing browser requests must use an allowed origin.
app.use((req, res, next) => {
if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
return next();
}


const origin = req.get('origin');

if (origin && !env.corsOrigins.includes(origin)) {
  logger.warn('origin_blocked', {
    origin,
    allowedOrigins: env.corsOrigins,
  });

  return next(forbidden('This request was blocked.'));
}

return next();

});

app.use(
'/uploads/products',
express.static(uploadDir, {
maxAge: '7d',
index: false,
dotfiles: 'deny',
}),
);

app.use('/health', healthRouter(pool));

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter(env, pool));
app.use('/api/categories', categoriesRouter(pool));
app.use('/api/products', productsRouter(pool));
app.use('/api/reviews', publicReviewsRouter(pool));
app.use('/api/cart', cartRouter(pool));

app.use(
'/api/orders',
authenticate(env, pool),
ordersRouter(pool),
paymentsRouter(env, pool),
);

app.use(
'/api/my-reviews',
authenticate(env, pool),
customerReviewsRouter(pool),
);

app.use('/api/admin', authenticate(env, pool));
app.use('/api/admin/inventory', adminInventoryRouter(pool));
app.use('/api/admin', adminCatalogRouter(pool));
app.use('/api/admin', adminOperationsRouter(pool));
app.use('/api/admin/reviews', adminReviewsRouter(pool));

app.use(notFoundHandler);
app.use(errorHandler);

return app;
}
