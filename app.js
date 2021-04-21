const express = require('express');
const app = express();
app.use(express.json());
const {
  models: { User, Note },
} = require('./db');
const path = require('path');

// review how this middleware function works
// return is not used here bc the function keeps running and will be used as a callback
const requireToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization; // checks if there is a header
    const user = await User.byToken(token); // tried to find user on header --- token is your user, with hashing involved
    req.user = user; // if user exists, add user to request
    next(); // prevents an infinite loop and allows request to move onto the next function
  } catch (error) {
    next(error);
  }
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/auth', async (req, res, next) => {
  try {
    res.send({ token: await User.authenticate(req.body) });
  } catch (ex) {
    next(ex);
  }
});

// you can add additional functions before the request reaches responds to the client
// app.get('/api/auth', isAdmin, isLoggedIn, requireToken, async (req, res, next) => { ...
app.get('/api/auth', requireToken, async (req, res, next) => {
  try {
    res.send(req.user);
  } catch (ex) {
    next(ex);
  }
});

app.get('/api/users/:id/notes', requireToken, async (req, res, next) => {
  try {
    res.send(await Note.byToken(req.user, req.params.id));
  } catch (ex) {
    next(ex);
  }
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.status || 500).send({ error: err.message });
});

module.exports = app;
