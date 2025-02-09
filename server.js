const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Import routes from index.js
const routes = require('./index');
app.use('/api', routes);  // Adjust base route if necessary

// Default route to check if the server is running
app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Server is running on port ${port}`);
});
