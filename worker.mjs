
import { httpServerHandler } from 'cloudflare:node';
import app from './index.js';

export default {
    fetch: httpServerHandler(app)
};
