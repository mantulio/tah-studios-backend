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

// Define Checkout Schema & Model
const checkoutSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    service: { type: String, required: true },
    amount: { type: String, required: true },
    fileName: { type: String },
    date: { type: Date, default: Date.now }
});

const Checkout = mongoose.model('Checkout', checkoutSchema);

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
                    to: 'umaruzzy40@gmail.com',
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

// Checkout Submission & Proof Verification Endpoint
app.post('/api/checkout', async (req, res) => {
    const { fullname, email, service, amount, fileName } = req.body;

    if (!fullname || !email || !service || !amount) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    try {
        // 1. Save Checkout Record to MongoDB
        const newCheckout = new Checkout({ fullname, email, service, amount, fileName });
        await newCheckout.save();

        // 2. Send Email Notifications via Resend
        if (process.env.RESEND_API_KEY) {
            try {
                // Email to You (Admin)
                await resend.emails.send({
                    from: 'TAH Studios <onboarding@resend.dev>',
                    to: 'umaruzzy40@gmail.com',
                    subject: `New Payment Proof: ${service} - ${fullname}`,
                    html: `
                        <h2>New Payment Proof Submitted</h2>
                        <p><strong>Client Name:</strong> ${fullname}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Selected Service:</strong> ${service}</p>
                        <p><strong>Amount:</strong> ${amount}</p>
                        <p><strong>Uploaded File:</strong> ${fileName || 'No file name provided'}</p>
                        <p style="color: #666;">Please check your GTB account to verify this transfer before confirming the booking.</p>
                    `
                });

                // Email Summary to the Client
                await resend.emails.send({
                    from: 'TAH Studios <onboarding@resend.dev>',
                    to: email,
                    subject: 'Payment Proof Received - TAH Studios',
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
                            <h2 style="color: #4A5D4E;">Payment Proof Received</h2>
                            <p>Hello <strong>${fullname}</strong>,</p>
                            <p>Thank you for submitting your payment proof. We have received your order details and our team is currently verifying the transfer.</p>
                            
                            <div style="background: #f9f6f0; padding: 15px; margin: 20px 0; border-left: 4px solid #4A5D4E;">
                                <p style="margin: 5px 0;"><strong>Package:</strong> ${service}</p>
                                <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ${amount}</p>
                            </div>
                            
                            <p>Once your payment is verified (typically within 2 hours), you will receive an official booking confirmation and project scheduling details.</p>
                            <br>
                            <p>Warm regards,</p>
                            <p><strong>TAH Studios Team</strong></p>
                        </div>
                    `
                });

                console.log('Checkout emails dispatched successfully via Resend.');
            } catch (mailErr) {
                console.error('Email dispatch failed, but checkout was safely saved to DB:', mailErr);
            }
        }

        res.status(201).json({ 
            success: true, 
            message: 'Payment proof submitted and saved successfully!' 
        });

    } catch (err) {
        console.error('Server error processing checkout:', err);
        res.status(500).json({ error: 'Server error processing checkout. Please try again later.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});