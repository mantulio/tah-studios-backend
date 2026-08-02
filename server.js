const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log('Connected to MongoDB successfully.');
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Define Inquiry Schema & Model
const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    service: { type: String, required: true },
    message: { type: String },
    date: { type: Date, default: Date.now }
});

const Inquiry = mongoose.model('Inquiry', inquirySchema);

// Test Route
app.get('/', (req, res) => {
    res.json({ message: 'TAH Studios Backend is running successfully.' });
});

// Get All Inquiries (Admin Route)
app.get('/api/inquiries', async (req, res) => {
    try {
        const inquiries = await Inquiry.find().sort({ date: -1 });
        res.status(200).json(inquiries);
    } catch (err) {
        console.error('Error fetching inquiries:', err);
        res.status(500).json({ error: 'Failed to retrieve inquiries.' });
    }
});

// Inquiry Submission Endpoint
app.post('/api/inquiries', async (req, res) => {
    const { name, email, service, message } = req.body;

    if (!name || !email || !service) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    try {
        // 1. Save to Database
        const newInquiry = new Inquiry({ name, email, service, message });
        await newInquiry.save();

        // 2. Send Email Notification via Resend API (HTTPS)
        if (process.env.RESEND_API_KEY) {
            try {
                const data = await resend.emails.send({
                    from: 'TAH Studios <onboarding@resend.dev>',
                    to: 'tahstudiosabuja@gmail.com',
                    subject: `New Project Inquiry: ${service} - ${name}`,
                    html: `
                        <h2>New Project Inquiry Received</h2>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Selected Service:</strong> ${service}</p>
                        <p><strong>Message:</strong> ${message || 'No additional notes provided.'}</p>
                    `
                });
                console.log('Resend email dispatched successfully:', data);
            } catch (mailErr) {
                console.error('Email notification failed to send, but inquiry was safely saved to DB:', mailErr);
            }
        }

        res.status(201).json({ 
            success: true, 
            message: 'Inquiry received and saved successfully!' 
        });

    } catch (err) {
        console.error('Server error processing inquiry:', err);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});