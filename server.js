const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// In-memory storage
const users = [];
const appointments = [];
const contacts = [];
const newsletters = [];

// Create test user
async function createTestUser() {
  const testEmail = 'test@wellnesshub.com';
  if (!users.find(u => u.email === testEmail)) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    users.push({ id: 1, email: testEmail, password: hashedPassword });
    console.log('✅ Test user created: test@wellnesshub.com / password123');
  }
}
createTestUser();

// Email setup
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('📧 Email service configured');
} else {
  console.log('⚠️ Email not configured - using console logs');
}

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 6;

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    
    console.log(`✅ User logged in: ${email}`);
    res.json({ 
      token, 
      user: { id: user.id, email: user.email },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const normalizedEmail = email.toLowerCase();
    if (users.find(u => u.email === normalizedEmail)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { 
      id: Date.now(), 
      email: normalizedEmail, 
      password: hashedPassword,
      createdAt: new Date()
    };
    users.push(user);
    
    console.log(`✅ New user registered: ${normalizedEmail}`);
    res.json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Appointment Routes
app.post('/api/appointments', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, service, date, time, message } = req.body;
    
    // Validation
    if (!firstName || !lastName || !email || !phone || !service || !date || !time) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const appointment = { 
      id: Date.now(), 
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      service,
      date,
      time,
      message: message || '',
      createdAt: new Date()
    };
    appointments.push(appointment);
    
    // Send email or log
    const emailContent = `
      <h2>🌿 Appointment Confirmation - WellnessHub</h2>
      <p>Dear ${firstName} ${lastName},</p>
      <p>Your appointment has been scheduled successfully!</p>
      <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3>Appointment Details:</h3>
        <ul>
          <li><strong>Service:</strong> ${service}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${time}</li>
          <li><strong>Phone:</strong> ${phone}</li>
        </ul>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      </div>
      <p>We'll contact you within 24 hours to confirm your appointment.</p>
      <p>Thank you for choosing WellnessHub!</p>
    `;
    
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🌿 Appointment Confirmation - WellnessHub',
        html: emailContent
      });
    } else {
      console.log('📧 Appointment email (would be sent):', emailContent);
    }
    
    console.log(`✅ Appointment booked: ${firstName} ${lastName} - ${service} on ${date} at ${time}`);
    res.json({ message: 'Appointment booked successfully! Check your email for confirmation.' });
  } catch (error) {
    console.error('❌ Appointment error:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Contact Routes
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const contact = { 
      id: Date.now(), 
      name: name.trim(),
      email: email.toLowerCase(),
      message: message.trim(),
      createdAt: new Date()
    };
    contacts.push(contact);
    
    const emailContent = `
      <h2>📧 New Contact Message - WellnessHub</h2>
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
        <p><strong>Name:</strong> ${contact.name}</p>
        <p><strong>Email:</strong> ${contact.email}</p>
        <p><strong>Message:</strong></p>
        <div style="background: white; padding: 10px; border-radius: 4px; margin-top: 10px;">
          ${contact.message}
        </div>
        <p><small>Received: ${contact.createdAt.toLocaleString()}</small></p>
      </div>
    `;
    
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: '📧 New Contact Message - WellnessHub',
        html: emailContent
      });
    } else {
      console.log('📧 Contact email (would be sent):', emailContent);
    }
    
    console.log(`✅ Contact message from: ${contact.name} (${contact.email})`);
    res.json({ message: 'Message sent successfully! We\'ll get back to you soon.' });
  } catch (error) {
    console.error('❌ Contact error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Newsletter Routes
app.post('/api/newsletter', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const normalizedEmail = email.toLowerCase();
    if (newsletters.find(n => n.email === normalizedEmail)) {
      return res.status(400).json({ error: 'Email already subscribed' });
    }
    
    newsletters.push({ 
      email: normalizedEmail, 
      subscribedAt: new Date() 
    });
    
    console.log(`✅ Newsletter subscription: ${normalizedEmail}`);
    res.json({ message: 'Successfully subscribed to our newsletter!' });
  } catch (error) {
    console.error('❌ Newsletter error:', error);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

// Admin Routes (protected)
app.get('/api/admin/stats', authenticateToken, (req, res) => {
  res.json({
    users: users.length,
    appointments: appointments.length,
    contacts: contacts.length,
    newsletters: newsletters.length,
    recentAppointments: appointments.slice(-5),
    recentContacts: contacts.slice(-5)
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 WellnessHub server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/index.html`);
});