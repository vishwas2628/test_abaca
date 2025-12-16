
import { httpServerHandler } from 'cloudflare:node';
import { createServer } from 'node:http';
import app from './index.js';

const server = createServer(app);

export default {
    fetch: httpServerHandler(server)
};
