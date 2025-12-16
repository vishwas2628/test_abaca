
const serverless = require('serverless-http');
const app = require('./index.js');

const handler = serverless(app);

export default {
    fetch(request, env, ctx) {
        return handler(request, env, ctx);
    }
};
