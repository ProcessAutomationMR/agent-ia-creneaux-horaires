const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Default route to check server status
app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

// Route to identify free slots
app.post('/occupied-slots', (req, res) => {
  const { value: occupiedSlots } = req.body;

  if (!occupiedSlots || !Array.isArray(occupiedSlots) || occupiedSlots.length === 0) {
    return res.status(400).json({ message: "Invalid input, 'value' is required and should contain slots." });
  }

  const date = occupiedSlots[0].start.split("T")[0];
  const workDayStart = new Date(`${date}T08:00:00Z`);
  const workDayEnd = new Date(`${date}T16:00:00Z`);

  // Sort occupied slots by start time
  const sortedOccupiedSlots = occupiedSlots
    .map(slot => ({ start: new Date(slot.start), end: new Date(slot.end) }))
    .sort((a, b) => a.start - b.start);

  let freeSlots = [];
  let currentTime = workDayStart;

  for (const slot of sortedOccupiedSlots) {
    if (currentTime < slot.start) {
      freeSlots.push({
        start: currentTime.toISOString(),
        end: slot.start.toISOString(),
      });
    }
    currentTime = slot.end > currentTime ? slot.end : currentTime;
  }

  if (currentTime < workDayEnd) {
    freeSlots.push({
      start: currentTime.toISOString(),
      end: workDayEnd.toISOString(),
    });
  }

  res.status(200).json({ free_slots: freeSlots.length ? freeSlots : "0" });
});

// Route to capture email confirmation
app.get('/capture-email', (req, res) => {
  const clientKey = req.query.key;

  if (!clientKey) {
    return res.status(400).send("Clé client manquante.");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Confirmez votre adresse email</title>
    </head>
    <body>
      <h1>Confirmez votre adresse email</h1>
      <form action="/submit-email" method="POST">
        <input type="hidden" name="clientKey" value="${clientKey}">
        <label for="email">Entrez votre e-mail :</label></br>
        <input type="email" id="email" name="email" required><br>
        <button type="submit">Confirmer</button>
      </form>
    </body>
    </html>
  `);
});

// Route to submit email
app.post('/submit-email', async (req, res) => {
  const { clientKey, email } = req.body;

  if (!clientKey || !email) {
    return res.status(400).send('Informations manquantes.');
  }

  try {
    await axios.post('https://hook.eu2.make.com/79tvxf9j8gge5pqnlhcrgyxm58jpxt9v', { clientKey, email });
    res.send('Merci, votre adresse e-mail a bien été confirmée.');
  } catch (error) {
    console.error('Erreur lors de l\'envoi au webhook :', error);
    res.status(500).send('Erreur lors de l\'envoi de votre e-mail.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
