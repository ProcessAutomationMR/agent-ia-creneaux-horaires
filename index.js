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

// Define working hours
const WORKDAY_START = "08:00:00";
const WORKDAY_END = "16:00:00";

// Default route to check server status
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Route to identify free slots
app.post('/occupied-slots', (req, res) => {
  const { value: occupiedSlots } = req.body;

  if (!occupiedSlots || !Array.isArray(occupiedSlots) || occupiedSlots.length === 0) {
    return res.status(400).json({ message: "Invalid input, 'value' is required and should contain slots." });
  }

  const date = occupiedSlots[0].start.split("T")[0];
  const workDayStart = new Date(`${date}T${WORKDAY_START}Z`);
  const workDayEnd = new Date(`${date}T${WORKDAY_END}Z`);

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

  // Check if there is free time after the last occupied slot
  if (currentTime < workDayEnd) {
    freeSlots.push({
      start: currentTime.toISOString(),
      end: workDayEnd.toISOString(),
    });
  }

  res.status(200).json({ free_slots: freeSlots.length ? freeSlots : "0" });
});

// Route to extend a slot to the next working day
app.post('/extend-slots', (req, res) => {
  const { requested_datetime } = req.body;

  if (!requested_datetime) {
    return res.status(400).json({ message: "Invalid input, 'requested_datetime' is required." });
  }

  let requestedDate = new Date(`${requested_datetime}Z`);
  if (isNaN(requestedDate.getTime())) {
    return res.status(400).json({ message: "Invalid input, 'requested_datetime' must be a valid ISO date." });
  }

  // Move to the next day and skip weekends
  requestedDate.setUTCDate(requestedDate.getUTCDate() + 1);
  while (requestedDate.getUTCDay() === 6 || requestedDate.getUTCDay() === 0) {
    requestedDate.setUTCDate(requestedDate.getUTCDate() + 1);
  }

  const year = requestedDate.getUTCFullYear();
  const month = String(requestedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(requestedDate.getUTCDate()).padStart(2, '0');

  res.status(200).json({
    start: `${year}-${month}-${day}T08:00:00Z`,
    end: `${year}-${month}-${day}T16:00:00Z`,
  });
});

// Route to convert a given date into fixed start and end times
app.post('/convert-date', (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.status(400).json({ error: "Missing 'date' parameter." });
  }

  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Please provide a valid ISO date string." });
  }

  const datePart = inputDate.toISOString().split("T")[0];
  const startTime = `${datePart}T09:00:00Z`;
  const endTime = `${datePart}T18:00:00Z`;

  res.status(200).json({ startTime, endTime });
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
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f0f8ff;
          color: #333;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background-color: #ffffff;
          padding: 2em;
          border-radius: 10px;
          box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          text-align: center;
        }
        h1 {
          color: #4682b4;
        }
        label, input, button {
          font-size: 1rem;
          margin: 10px 0;
        }
        input {
          width: calc(100% - 20px);
          padding: 10px;
          border: 1px solid #b0c4de;
          border-radius: 5px;
          cursor: pointer;
        }
        button:hover {
          background-color: #5a9bd4;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirmez votre adresse email</h1>
        <form action="/submit-email" method="POST">
          <input type="hidden" name="clientKey" value="${clientKey}">
          <label for="email">Entrez votre e-mail :</label></br>
          <input type="email" id="email" name="email" required><br>
          <button type="submit">Confirme</button>
        </form>
      </div>
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
  console.log(`Server running on port ${port}`);
});
