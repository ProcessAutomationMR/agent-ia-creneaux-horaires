const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// Middleware
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

// Route to suggest the first three available slots
app.post('/suggest-slots', (req, res) => {
  const { free_slots } = req.body;

  if (!free_slots || !Array.isArray(free_slots) || free_slots.length === 0) {
    return res.status(400).json({ message: "Invalid input, 'free_slots' is required and should contain an array of slots." });
  }

  res.status(200).json({ suggested_slots: free_slots.slice(0, 3) });
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

// Route to convert time slots to UTC+1 and generate a French response
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

// Execute Endpoint: Handles both "code" execution and "startTime" conversion
app.post("/execute", (req, res) => {
    console.log("DEBUG: Received request body:", req.body); // Debugging log

    const { code, startTime } = req.body;

    if (!code && !startTime) {
        console.log("DEBUG: Missing parameters - code & startTime are both missing");
        return res.status(400).json({ error: "Missing required parameters: either 'code' or 'startTime' must be provided." });
    }

    // If 'startTime' is provided, convert it into an end time
    if (startTime) {
        const startDate = new Date(startTime);
        if (isNaN(startDate.getTime())) {
            console.log("DEBUG: Invalid startTime format:", startTime);
            return res.status(400).json({ error: "Invalid ISO format for 'startTime'." });
        }

        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        return res.json({
            startTime: startTime,
            endTime: endDate.toISOString().slice(0, 19)
        });
    }

    // If 'code' is provided, execute it safely
    try {
        const safeFunction = new Function(`"use strict"; return (${code})`);
        const result = safeFunction();
        return res.json({ result });
    } catch (error) {
        return res.status(500).json({ error: error.message, trace: error.stack });
    }
});

// Route to convert a given date into 2 separate time slots
app.post('/convert-date', (req, res) => {
    const { date } = req.body;

    if (!date) {
        return res.status(400).json({ message: "Missing 'date' parameter." });
    }

    // Convert input to Date object
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) {
        return res.status(400).json({ message: "Invalid ISO date format." });
    }

    // Extract date part in YYYY-MM-DD format
    const datePart = inputDate.toISOString().split("T")[0];

    // Define 2 time slots
    const timeSlots = [
        { label: "timeMin", time: "09:00:00" },
        { label: "timeMax", time: "18:00:00" }
    ];

    // Generate JSON response
    const response = timeSlots.map(slot => ({
        label: slot.label,
        date: `${datePart}T${slot.time}Z`
    }));

    res.status(200).json(response);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
