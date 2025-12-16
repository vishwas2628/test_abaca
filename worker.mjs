
import serverless from 'serverless-http';
import app from './index.js';

const handler = serverless(app);

export default {
    fetch(request, env, ctx) {
        return handler(request, env, ctx);
    }
};
