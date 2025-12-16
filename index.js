require('dotenv').config();
const express = require('express');
const app = express();
const port = 3001;

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


app.listen(port, () => {
    console.log(`Mini service listening at http://localhost:${port}`);
});
