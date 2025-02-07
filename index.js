const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

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
  const sortedOccupiedSlots = occupiedSlots.map(slot => ({
    start: new Date(slot.start),
    end: new Date(slot.end),
  })).sort((a, b) => a.start - b.start);

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

// Route to suggest first three available slots
app.post('/suggest-slots', (req, res) => {
  const { free_slots } = req.body;

  if (!free_slots || !Array.isArray(free_slots) || free_slots.length === 0) {
    return res.status(400).json({ message: "Invalid input, 'free_slots' is required and should contain an array of slots." });
  }

  res.status(200).json({ suggested_slots: free_slots.slice(0, 3) });
});

// Route to extend slots
app.post('/extend-slots', (req, res) => {
  const { requested_datetime } = req.body;

  if (!requested_datetime) {
    return res.status(400).json({ message: "Invalid input, 'requested_datetime' is required." });
  }

  let requestedDate = new Date(`${requested_datetime}Z`);
  if (isNaN(requestedDate.getTime())) {
    return res.status(400).json({ message: "Invalid input, 'requested_datetime' must be a valid ISO date." });
  }

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

// Route to answer in French
app.post('/answer', (req, res) => {
  const { suggested_slots } = req.body;

  if (!suggested_slots || !Array.isArray(suggested_slots) || suggested_slots.length === 0) {
    return res.status(400).json({ message: "Invalid input, 'suggested_slots' is required and should contain an array of slots." });
  }

  let responseText = '';

  suggested_slots.forEach((slot, index) => {
    const startDate = new Date(slot.start);
    const endDate = new Date(slot.end);

    const startUTCPlus1 = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endUTCPlus1 = new Date(endDate.getTime() + 60 * 60 * 1000);

    const day = String(startUTCPlus1.getUTCDate()).padStart(2, '0');
    const month = startUTCPlus1.toLocaleString('fr-FR', { month: 'long' });
    const startHour = startUTCPlus1.getUTCHours();
    const endHour = endUTCPlus1.getUTCHours();

    if (index === 0) {
      responseText += `le ${day} ${month} de ${startHour} heures à ${endHour} heures`;
    } else {
      responseText += ` et de ${startHour} heures à ${endHour} heures`;
    }
  });

  res.status(200).send(responseText);
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
