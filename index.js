require('dotenv').config();
const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

const companyRouter = require('./router/companyRouter');
const questionAnsRespoRouter = require('./router/questionAnsRespo');

// Use Company Routes
app.use('/companies', companyRouter);

// Use Matching Routes
app.use('/matching', questionAnsRespoRouter);

app.listen(port, () => {
    console.log(`Mini service listening at http://localhost:${port}`);
});
