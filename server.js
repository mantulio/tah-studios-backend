const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB successfully.'))
.catch((err) => console.error('MongoDB connection error:', err));

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
    isAcknowledged: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});
const Checkout = mongoose.model('Checkout', checkoutSchema);

app.get('/', (req, res) => {
    res.json({ message: 'TAH Studios Backend is running successfully.' });
});

// ADMIN: Acknowledge Payment & Auto-Email Client + Send Confirmed Status to Frontend
app.patch('/api/checkout/acknowledge/:id', async (req, res) => {
    try {
        const updated = await Checkout.findByIdAndUpdate(
            req.params.id, 
            { isAcknowledged: true }, 
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Checkout not found' });

        // Automatically Email the Customer that Payment is Confirmed
        if (process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'TAH Studios <onboarding@resend.dev>',
                    to: updated.email,
                    subject: 'Payment Confirmed! - TAH Studios',
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0;">
                            <h2 style="color: #27ae60;">Payment Successfully Confirmed!</h2>
                            <p>Hello <strong>${updated.fullname}</strong>,</p>
                            <p>Great news! We have reviewed your payment proof and verified your transfer. Your booking is officially confirmed.</p>
                            <div style="background: #e8f8f5; padding: 15px; margin: 20px 0; border-left: 4px solid #27ae60;">
                                <p style="margin: 5px 0;"><strong>Package:</strong> ${updated.service}</p>
                                <p style="margin: 5px 0;"><strong>Amount Verified:</strong> ${updated.amount}</p>
                            </div>
                            <p>We will reach out shortly regarding the next steps for your project.</p>
                            <p>Best regards,<br><strong>TAH Studios</strong></p>
                        </div>
                    `
                });
                console.log('Confirmation email sent to client successfully.');
            } catch (mailErr) {
                console.error('Failed to send confirmation email:', mailErr);
            }
        }

        res.status(200).json({ success: true, message: 'Payment acknowledged and customer notified!' });
    } catch (err) {
        console.error('Acknowledgment error:', err);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Inquiry Submission Endpoint with Resend Alerts
app.post('/api/inquiries', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !service) return res.status(400).json({ error: 'Required fields missing.' });
    
    try {
        const newInquiry = new Inquiry({ name, email, service, message });
        await newInquiry.save();

        if (process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
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
            } catch (mailErr) {
                console.error('Inquiry email failed to send:', mailErr);
            }
        }

        res.status(201).json({ success: true, message: 'Inquiry received and saved successfully!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Checkout Submission Endpoint with Resend Alerts
app.post('/api/checkout', async (req, res) => {
    const { fullname, email, service, amount, fileName } = req.body;
    if (!fullname || !email || !service || !amount) return res.status(400).json({ error: 'Required fields missing.' });
    
    try {
        const newCheckout = new Checkout({ fullname, email, service, amount, fileName });
        await newCheckout.save();

        if (process.env.RESEND_API_KEY) {
            try {
                // Admin Alert
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
                    `
                });

                // Client Submission Receipt
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
                            <p>Once verified, your payment status will update and you will receive a final confirmation email.</p>
                        </div>
                    `
                });
            } catch (mailErr) {
                console.error('Checkout email dispatch failed:', mailErr);
            }
        }

        // Return the checkout ID so the frontend can optionally poll or track it dynamically if open
        res.status(201).json({ success: true, checkoutId: newCheckout._id, message: 'Payment proof submitted!' });
    } catch (err) {
        res.status(500).json({ error: 'Server error processing checkout.' });
    }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));