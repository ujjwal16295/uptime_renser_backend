const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// const supabase = createClient(supabaseUrl, supabaseKey);

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your actual gmail
    pass: process.env.EMAIL_APP_PASSWORD // Gmail App Password
  }
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
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

// Helper function to get user with links
const getUserWithLinks = async (email) => {
  // Get user data
  const { data: user, error: userError } = await supabase
  .from('users')
  .select('id, email, credit, plan, created_at')
  .eq('email', email)
  .single();

  if (userError) {
    return { data: null, error: userError };
  }

  // Get user's links with their individual ping counts
  const { data: links, error: linksError } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', user.id);

  if (linksError) {
    return { data: null, error: linksError };
  }

  // Return user data with links and their individual ping counts
  const userWithLinks = {
    ...user,
    plan: user.plan || 'free', // Add this line
    links: links.map(link => ({
      id: link.id,
      url: link.url,
      ping_count: link.ping_count || 0,
      last_ping: link.last_ping
    }))
  };

  return { data: userWithLinks, error: null };
};

async function handleSubscriptionActivated(subscription) {
  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'paid',
      subscription_status: 'active'
    })
    .eq('subscription_id', subscription.id);
    
  console.log('Subscription activated for subscription:', subscription.id);
}

async function handleSubscriptionCancelled(subscription) {
  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'cancelled'
    })
    .eq('subscription_id', subscription.id);

  console.log('Subscription cancelled for subscription:', subscription.id);
}

async function handleSubscriptionPaused(subscription) {
  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'paused'
    })
    .eq('subscription_id', subscription.id);

  console.log('Subscription paused for subscription:', subscription.id);
}

async function handleSubscriptionResumed(subscription) {
  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'paid',
      subscription_status: 'active'
    })
    .eq('subscription_id', subscription.id);

  console.log('Subscription resumed for subscription:', subscription.id);
}

async function handleSubscriptionCompleted(subscription) {
  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'completed'
    })
    .eq('subscription_id', subscription.id);

  console.log('Subscription completed for subscription:', subscription.id);
}
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

    // Get user data with links (maintains backward compatibility)
    const { data: user, error } = await getUserWithLinks(email);

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

// Add 43200 credits to user's account (with 70k limit)
app.post('/api/credit/add', async (req, res) => {
  try {
    const { email } = req.body;
    const CREDIT_TO_ADD = 43200;
    const MAX_CREDIT_LIMIT = 70000;

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
      .select('id, email, credit')
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

    // Calculate new credit total
    const newCredit = existingUser.credit + CREDIT_TO_ADD;

    // Check if adding credits would exceed the limit
    if (newCredit > MAX_CREDIT_LIMIT) {
      const remainingCapacity = Math.max(0, MAX_CREDIT_LIMIT - existingUser.credit);
      return res.status(400).json({
        error: 'Credit limit exceeded',
        message: `Adding ${CREDIT_TO_ADD.toLocaleString()} credits would exceed the maximum limit of ${MAX_CREDIT_LIMIT.toLocaleString()}. Current balance: ${existingUser.credit.toLocaleString()}. You can only add ${remainingCapacity.toLocaleString()} more credits.`,
        data: {
          current_credit: existingUser.credit,
          attempted_addition: CREDIT_TO_ADD,
          would_result_in: newCredit,
          maximum_allowed: MAX_CREDIT_LIMIT,
          remaining_capacity: remainingCapacity,
          can_add_more: remainingCapacity > 0
        }
      });
    }

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
      CREDIT_TO_ADD,
      updatedUser.credit
    );

    res.json({
      success: true,
      message: 'Credit added successfully',
      data: {
        email: updatedUser.email,
        previous_credit: existingUser.credit,
        added_credit: CREDIT_TO_ADD,
        new_credit: updatedUser.credit,
        created_at: updatedUser.created_at,
        email_sent: emailSent,
        remaining_capacity: MAX_CREDIT_LIMIT - updatedUser.credit
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

// Add URL endpoint - Modified to enforce 3-link limit per user
app.post('/api/urls', async (req, res) => {
  try {
    const { email, link } = req.body;
    const MAX_LINKS_PER_USER = 3;

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
    .select('id, email, credit, created_at, plan')
    .eq('email', email)
    .single();

    let userId;
    let userCreated = false;

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check user existence'
      });
    }

    if (existingUser) {
      userId = existingUser.id;
      
      // Check current link count for existing user
      const { data: userLinks, error: linkCountError } = await supabase
        .from('links')
        .select('id, url')
        .eq('user_id', userId);
    
      if (linkCountError) {
        console.error('Error checking user link count:', linkCountError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to check user link count'
        });
      }
    
      // Check if user has reached the maximum link limit (only for free users)
      if (existingUser.plan !== 'paid' && userLinks.length >= MAX_LINKS_PER_USER) {
        return res.status(400).json({
          error: 'Link limit exceeded',
          message: `You can't add more URLs. You already have ${userLinks.length} URLs (maximum allowed: ${MAX_LINKS_PER_USER}). Upgrade to a paid plan for unlimited URLs.`,
          data: {
            current_links: userLinks.length,
            max_allowed: MAX_LINKS_PER_USER,
            user_plan: existingUser.plan
          }
        });
      }

      // Check if link already exists for this user
      const existingLink = userLinks.find(userLink => userLink.url === link);
      if (existingLink) {
        // Get updated user data with links for response
        const { data: userData, error: getUserError } = await getUserWithLinks(email);
        
        return res.status(409).json({
          error: 'Link already exists',
          message: 'This link is already being monitored for this user',
          data: userData || null
        });
      }
    } else {
      // User doesn't exist - create new user (they can add their first link)
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert([
          {
            email: email,
            credit: 43200, // Default credit value
          }
        ])
        .select('id, email, credit, created_at')
        .single();

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to create user'
        });
      }

      userId = newUser.id;
      userCreated = true;
    }

    // Add link to links table
    const { data: newLink, error: linkError } = await supabase
      .from('links')
      .insert([
        {
          user_id: userId,
          url: link,
          ping_count: 0
        }
      ])
      .select()
      .single();

    if (linkError) {
      console.error('Error adding link:', linkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to add link'
      });
    }

    // Get updated user data with links for response
    const { data: userData, error: getUserError } = await getUserWithLinks(email);

    if (getUserError) {
      console.error('Error fetching updated user data:', getUserError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch updated user data'
      });
    }

    res.status(201).json({
      success: true,
      message: userCreated ? 'User created and link added successfully' : 'Link added successfully to existing user',
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

// Get all links for a user
app.get('/api/user/:email/links', async (req, res) => {
  try {
    const { email } = req.params;

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Get user data with links
    const { data: user, error } = await getUserWithLinks(email);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }
      
      console.error('Error fetching user with links:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user links'
      });
    }

    res.json({
      success: true,
      message: 'User links retrieved successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          credit: user.credit,
          created_at: user.created_at
        },
        links: user.links,
        total_links: user.links.length,
        total_pings: user.links.reduce((sum, link) => sum + (link.ping_count || 0), 0)
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

// Delete a specific link
app.delete('/api/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body; // Optional: to verify ownership

    // Validate link ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid link ID',
        message: 'Please provide a valid link ID'
      });
    }

    // If email is provided, verify the link belongs to the user
    if (email) {
      // Validate email format
      if (!isValidEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email',
          message: 'Please provide a valid email address'
        });
      }

      // Check if the link belongs to the user
      const { data: linkWithUser, error: checkError } = await supabase
        .from('links')
        .select(`
          id,
          url,
          users!links_user_id_fkey (
            email
          )
        `)
        .eq('id', parseInt(id))
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Link not found',
            message: 'No link found with this ID'
          });
        }
        
        console.error('Error checking link ownership:', checkError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to verify link ownership'
        });
      }

      // Verify ownership
      if (linkWithUser.users.email !== email) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to delete this link'
        });
      }
    }

    // Delete the link
    const { data: deletedLink, error: deleteError } = await supabase
      .from('links')
      .delete()
      .eq('id', parseInt(id))
      .select()
      .single();

    if (deleteError) {
      if (deleteError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Link not found',
          message: 'No link found with this ID'
        });
      }
      
      console.error('Error deleting link:', deleteError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to delete link'
      });
    }

    res.json({
      success: true,
      message: 'Link deleted successfully',
      data: {
        deleted_link: {
          id: deletedLink.id,
          url: deletedLink.url,
          ping_count: deletedLink.ping_count,
          last_ping: deletedLink.last_ping
        }
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


// User registration/authentication endpoint
app.post('/api/users/auth', async (req, res) => {
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

    // Check current user count
    const { count: userCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting users:', countError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check user count'
      });
    }

    // Check if this user already exists
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    // If user doesn't exist and we're at the limit, reject
    if (!existingUser && existingError?.code === 'PGRST116' && userCount >= 100) {
      return res.status(403).json({
        error: 'Registration closed',
        message: 'Registration is currently closed. Only 100 people are allowed to join at this time.',
        data: {
          current_user_count: userCount,
          max_users: 100
        }
      });
    }

    let userData;
    let isNewUser = false;

    if (existingUser) {
      // User already exists, return their data
      userData = existingUser;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            email: email,
            credit: 21600 // Default credit value
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to create user account'
        });
      }

      userData = newUser;
      isNewUser = true;
    }

    // Get user's links
    const { data: links, error: linksError } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', userData.id);

    if (linksError) {
      console.error('Error fetching user links:', linksError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user links'
      });
    }

    res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser ? 'User account created successfully' : 'User authenticated successfully',
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          credit: userData.credit,
          created_at: userData.created_at
        },
        links: links || [],
        is_new_user: isNewUser,
        user_count: userCount + (isNewUser ? 1 : 0)
      }
    });

  } catch (error) {
    console.error('Server error in user auth:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});
// Get user plan
app.get('/api/user/:email/plan', async (req, res) => {
  try {
    const { email } = req.params;

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Get user plan
    const { data: user, error } = await supabase
      .from('users')
      .select('plan')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }
      
      console.error('Error fetching user plan:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user plan'
      });
    }

    res.json({
      success: true,
      message: 'Plan retrieved successfully',
      data: {
        plan: user.plan
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
// Get response times for all user's links
app.get('/api/user/:email/response-times', async (req, res) => {
  try {
    const { email } = req.params;
    const { limit = 5 } = req.query;
    
    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }
    
    // Get user ID first
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (userError) {
      if (userError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get all links for the user
    const { data: links, error: linksError } = await supabase
      .from('links')
      .select('id, url')
      .eq('user_id', user.id);
    
    if (linksError) {
      console.error('Error fetching links:', linksError);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get pings for each link
    const responseData = {};
    
    for (const link of links) {
      const { data: pings, error: pingsError } = await supabase
        .from('pings')
        .select('response_time, created_at')
        .eq('link_id', link.id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));
      
      if (pingsError) {
        console.error('Error fetching pings for link:', link.id, pingsError);
        continue;
      }
      
      responseData[link.url] = pings.map(ping => ({
        response_time: ping.response_time,
        timestamp: ping.created_at
      }));
    }
    
    res.json({
      success: true,
      message: 'Response times retrieved successfully',
      data: responseData
    });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong on our end'
    });
  }
});

app.post('/api/payment/create-subscription', async (req, res) => {
  try {
    const { email, plan } = req.body;

    if (!email || !plan) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and plan are required'
      });
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Please create an account first'
      });
    }

    // Create subscription plan
    const subscription = await razorpay.subscriptions.create({
      plan_id: 'plan_monthly_pro', // Create this plan in Razorpay dashboard
      customer_notify: 1,
      quantity: 1,
      addons: [],
      notes: {
        user_id: user.id,
        email: email,
        plan_type: plan
      }
    });

    // Store subscription details in database
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert([
        {
          user_id: user.id,
          razorpay_subscription_id: subscription.id,
          plan_type: plan,
          status: 'created',
          created_at: new Date().toISOString()
        }
      ]);

    if (subError) {
      console.error('Error saving subscription:', subError);
    }

    res.json({
      success: true,
      subscription: subscription
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create subscription'
    });
  }
});

// Verify payment endpoint
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { 
      razorpay_payment_id, 
      razorpay_subscription_id, 
      razorpay_signature,
      email 
    } = req.body;

    // Verify signature
    const body = razorpay_subscription_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'Payment verification failed'
      });
    }

    // Update user plan to paid
    const { error: updateError } = await supabase
      .from('users')
      .update({ plan: 'paid' })
      .eq('email', email);

    if (updateError) {
      console.error('Error updating user plan:', updateError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to update user plan'
      });
    }

    // Update subscription status
    const { error: subUpdateError } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'active',
        razorpay_payment_id: razorpay_payment_id
      })
      .eq('razorpay_subscription_id', razorpay_subscription_id);

    if (subUpdateError) {
      console.error('Error updating subscription:', subUpdateError);
    }

    res.json({
      success: true,
      message: 'Payment verified and plan upgraded successfully'
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Payment verification failed'
    });
  }
});

// Razorpay webhook endpoint
app.post('/api/webhooks/razorpay', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);
    const { event: eventType, payload } = event;

    console.log('Received webhook event:', eventType);

    switch (eventType) {
      case 'subscription.activated':
        await handleSubscriptionActivated(payload.subscription.entity);
        break;
        
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload.subscription.entity);
        break;
        
      case 'subscription.paused':
        await handleSubscriptionPaused(payload.subscription.entity);
        break;
        
      case 'subscription.resumed':
        await handleSubscriptionResumed(payload.subscription.entity);
        break;
        
      case 'subscription.completed':
        await handleSubscriptionCompleted(payload.subscription.entity);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook failed' });
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