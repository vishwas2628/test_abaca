const port = 3001;

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose')
const app = express();

app.use(express.json());

const companyRouter = require('./router/companyRouter');
const questionAnsRespoRouter = require('./router/questionAnsRespo');
const groupRouter = require('./router/groupRouter');

// MongoDB Connection using Mongo Atlas URI from environment variables
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error('Error: MONGO_URI is not defined in environment variables');
    process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB Atlas successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Use Company Routes
app.use('/companies', companyRouter);

// Use Matching Routes
app.use('/matching', questionAnsRespoRouter);

// Use Group/Company List Routes
app.use('/user/company-lists', groupRouter);

const affiliateRouter = require('./router/affiliateRouter');
app.use('/sdg/affiliate-program-entries', affiliateRouter);

const fcmRouter = require('./router/fcmRouter');
app.use('/', fcmRouter);


app.listen(port, () => {
    console.log(`Mini service listening at http://localhost:${port}`);
});

module.exports = app;
