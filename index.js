const port = 3001;

require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

const companyRouter = require('./router/companyRouter');
const questionAnsRespoRouter = require('./router/questionAnsRespo');
const groupRouter = require('./router/groupRouter');

// Use Company Routes
app.use('/companies', companyRouter);

// Use Matching Routes
app.use('/matching', questionAnsRespoRouter);

// Use Group/Company List Routes
app.use('/user/company-lists', groupRouter);

const affiliateRouter = require('./router/affiliateRouter');
app.use('/sdg/affiliate-program-entries', affiliateRouter);


app.listen(port, () => {
    console.log(`Mini service listening at http://localhost:${port}`);
});

module.exports = app;
