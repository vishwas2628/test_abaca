
const serverless = require('serverless-http');
const app = require('./index.js');

const handler = serverless(app);

module.exports = {
    fetch(request, env, ctx) {
        return handler(request, env, ctx);
    }
};
