const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ success: true, message: 'API is healthy' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
