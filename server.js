const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your actual gmail
    pass: process.env.EMAIL_APP_PASSWORD // Gmail App Password
  }
});

// Middleware
// app.use(cors()); // Allow all origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin starts with your allowed domain
    if (origin.startsWith('https://uptime-frontend-ivory.vercel.app')) {
      return callback(null, true);
    }
    
    // Reject all other origins
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true // Enable if you need to send cookies/auth headers
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate URL
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Helper function to send credit notification email
const sendCreditNotificationEmail = async (userEmail, previousCredit, addedCredit, newCredit) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Credits Added - NapStopper</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fef9c3 100%);
          min-height: 100vh;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          margin-top: 40px;
          margin-bottom: 40px;
        }
        .header {
          background: linear-gradient(135deg, #ea580c 0%, #d97706 100%);
          padding: 32px 24px;
          text-align: center;
        }
        .logo {
          margin-bottom: 16px;
        }
        .logo-text {
          font-size: 24px;
          font-weight: bold;
          color: white;
        }
        .header-title {
          font-size: 28px;
          font-weight: bold;
          color: white;
          margin: 0;
        }
        .header-subtitle {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.9);
          margin: 8px 0 0 0;
        }
        .content {
          padding: 40px 32px;
        }
        .success-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 50%;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .main-message {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
          text-align: center;
          margin-bottom: 32px;
          line-height: 1.4;
        }
        .credit-details {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 32px;
          border: 1px solid #f59e0b;
        }
        .credit-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 16px;
        }
        .credit-row:last-child {
          margin-bottom: 0;
          padding-top: 12px;
          border-top: 2px solid #f59e0b;
          font-weight: bold;
          font-size: 18px;
        }
        .credit-label {
          color: #92400e;
          font-weight: 500;
        }
        .credit-value {
          color: #92400e;
          font-weight: 600;
        }
        .added-credit {
          color: #065f46;
        }
        .info-box {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .info-text {
          color: #0c4a6e;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        .footer {
          background: #f9fafb;
          padding: 24px 32px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer-text {
          color: #6b7280;
          font-size: 14px;
          margin: 0;
        }
        .brand-footer {
          margin-bottom: 12px;
        }
        .brand-name {
          font-weight: bold;
          color: #111827;
          font-size: 16px;
        }
        @media (max-width: 600px) {
          .container {
            margin: 20px;
            border-radius: 16px;
          }
          .content {
            padding: 32px 24px;
          }
          .header {
            padding: 24px 20px;
          }
          .credit-details {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <div class="logo-text">NapStopper</div>
          </div>
          <h1 class="header-title">Credits Added!</h1>
          <p class="header-subtitle">Your account has been successfully topped up</p>
        </div>
        
        <div class="content">
          <div class="success-icon">
            ✓
          </div>
          
          <h2 class="main-message">
            Great news! ${addedCredit.toLocaleString()} credits have been added to your account.
          </h2>
          
          <div class="credit-details">
            <div class="credit-row">
              <span class="credit-label">Previous Balance:</span>
              <span class="credit-value">${previousCredit.toLocaleString()} credits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label added-credit">Credits Added:</span>
              <span class="credit-value added-credit">+${addedCredit.toLocaleString()} credits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">New Balance:</span>
              <span class="credit-value">${newCredit.toLocaleString()} credits</span>
            </div>
          </div>
          
          <div class="info-box">
            <p class="info-text">
              <strong>What are credits used for?</strong><br>
              Credits are consumed each time we ping your URLs to keep them active. Each ping costs 1 credit, 
              so your ${newCredit.toLocaleString()} credits will keep your applications running for a long time!
            </p>
          </div>
        </div>
        
        <div class="footer">
          <div class="brand-footer">
            <div class="brand-name">NapStopper</div>
          </div>
          <p class="footer-text">
            Keep your free-tier applications running 24/7 without any hassle.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: {
      name: 'NapStopper',
      address: process.env.EMAIL_USER
    },
    to: userEmail,
    subject: `🎉 ${addedCredit.toLocaleString()} Credits Added to Your NapStopper Account!`,
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Credit notification email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending credit notification email:', error);
    return false;
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Your API is running',
    timestamp: new Date().toISOString()
  });
});

// Get current credit for an email
app.get('/api/credit/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Get user data from database
    const { data: user, error } = await supabase
      .from('users')
      .select('email, credit, created_at')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }
      
      console.error('Error fetching user credit:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user credit'
      });
    }

    res.json({
      success: true,
      message: 'Credit retrieved successfully',
      data: {
        email: user.email,
        credit: user.credit,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});

// Add 43200 credits to user's account
app.post('/api/credit/add', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Email is required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Check if user exists and get current credit
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email, credit')
      .eq('email', email)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found',
          message: 'No user found with this email address. Please add a URL first to create an account.'
        });
      }
      
      console.error('Error checking existing user:', checkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check user existence'
      });
    }

    // Add 43200 to current credit
    const newCredit = existingUser.credit + 43200;

    // Update user's credit
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ credit: newCredit })
      .eq('email', email)
      .select('email, credit, created_at')
      .single();

    if (updateError) {
      console.error('Error updating user credit:', updateError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to update user credit'
      });
    }

    // Send email notification
    const emailSent = await sendCreditNotificationEmail(
      updatedUser.email,
      existingUser.credit,
      43200,
      updatedUser.credit
    );

    res.json({
      success: true,
      message: 'Credit added successfully',
      data: {
        email: updatedUser.email,
        previous_credit: existingUser.credit,
        added_credit: 43200,
        new_credit: updatedUser.credit,
        created_at: updatedUser.created_at,
        email_sent: emailSent
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});

// Add URL endpoint - Modified to work with email and links
app.post('/api/urls', async (req, res) => {
  try {
    const { email, link } = req.body;

    // Validate required fields
    if (!email || !link) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both email and link are required'
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Validate URL format
    if (!isValidUrl(link)) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid URL (e.g., https://example.com/api/health)'
      });
    }

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check user existence'
      });
    }

    let userData;

    if (existingUser) {
      // User exists - check if link already exists
      if (existingUser.links && existingUser.links.includes(link)) {
        return res.status(409).json({
          error: 'Link already exists',
          message: 'This link is already being monitored for this user',
          data: existingUser
        });
      }

      // Add link to existing user's links array
      const updatedLinks = existingUser.links ? [...existingUser.links, link] : [link];
      
      const { data, error } = await supabase
        .from('users')
        .update({ 
          links: updatedLinks,
          ping: existingUser.ping + 1 // Increment ping count
        })
        .eq('email', email)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to update user links'
        });
      }

      userData = data;
    } else {
      // User doesn't exist - create new user
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            email: email,
            links: [link],
            ping: 1, // Set initial ping to 1 since we're adding first link
            credit: 43200, // Default credit value
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to create user'
        });
      }

      userData = data;
    }

    res.status(201).json({
      success: true,
      message: existingUser ? 'Link added successfully to existing user' : 'User created and link added successfully',
      data: userData
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 KeepAlive API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Add URL: POST http://localhost:${PORT}/api/urls`);
  console.log(`💰 Get Credit: GET http://localhost:${PORT}/api/credit/:email`);
  console.log(`➕ Add Credit: POST http://localhost:${PORT}/api/credit/add`);
});

module.exports = app;