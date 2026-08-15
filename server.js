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
.then(() => console.log('Connected to MongoDB successfully.'))
.catch((err) => console.error('MongoDB connection error:', err));

// --- Schemas & Models ---

const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    service: { type: String, required: true },
    message: { type: String },
    date: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

const checkoutSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    service: { type: String, required: true },
    amount: { type: String, required: true },
    fileName: { type: String },
    isAcknowledged: { type: Boolean, default: false }, // NEW FIELD
    date: { type: Date, default: Date.now }
});
const Checkout = mongoose.model('Checkout', checkoutSchema);

// --- Routes ---

app.get('/', (req, res) => {
    res.json({ message: 'TAH Studios Backend is running successfully.' });
});

// 1. PUBLIC: Check Payment Status by Email
app.get('/api/checkout/status/:email', async (req, res) => {
    try {
        const record = await Checkout.findOne({ email: req.params.email }).sort({ date: -1 });
        if (!record) return res.status(404).json({ error: 'No record found for this email.' });
        res.status(200).json(record);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. ADMIN: Acknowledge Payment
// Use this endpoint to flip the status to true
app.patch('/api/checkout/acknowledge/:id', async (req, res) => {
    try {
        const updated = await Checkout.findByIdAndUpdate(
            req.params.id, 
            { isAcknowledged: true }, 
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Checkout not found' });
        res.status(200).json({ success: true, message: 'Payment acknowledged!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Inquiry Submission Endpoint (UNCHANGED)
app.post('/api/inquiries', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !service) return res.status(400).json({ error: 'Required fields missing.' });
    try {
        const newInquiry = new Inquiry({ name, email, service, message });
        await newInquiry.save();
        res.status(201).json({ success: true, message: 'Inquiry received!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Checkout Submission Endpoint (UNCHANGED)
app.post('/api/checkout', async (req, res) => {
    const { fullname, email, service, amount, fileName } = req.body;
    if (!fullname || !email || !service || !amount) return res.status(400).json({ error: 'Required fields missing.' });
    try {
        const newCheckout = new Checkout({ fullname, email, service, amount, fileName });
        await newCheckout.save();
        res.status(201).json({ success: true, message: 'Payment proof submitted!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));