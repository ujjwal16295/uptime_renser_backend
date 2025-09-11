const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { Paddle, EventName } = require('@paddle/paddle-node-sdk');



require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// const supabase = createClient(supabaseUrl, supabaseKey);



const paddle = new Paddle(process.env.PADDLE_API_KEY);


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

// Webhook endpoint
app.post('/api/webhooks/paddle', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    console.log('=== PADDLE WEBHOOK REQUEST RECEIVED ===');
    console.log('Headers:', req.headers);
    console.log('Body type:', typeof req.body);
    console.log('Body length:', req.body.length);

    const signature = req.headers['paddle-signature'];
    const rawRequestBody = req.body.toString();
    const secretKey = process.env.PADDLE_WEBHOOK_SECRET || '';

    console.log('Paddle signature:', signature);

    if (!signature || !rawRequestBody) {
      console.log('ERROR: Signature or request body missing');
      return res.status(400).json({ error: 'Invalid webhook request' });
    }

    // Verify webhook signature using Paddle SDK
    console.log('Verifying webhook signature...');
    const eventData = await paddle.webhooks.unmarshal(rawRequestBody, secretKey, signature);
        
    console.log('Webhook signature verification successful');
    console.log('=== PADDLE WEBHOOK EVENT DETAILS ===');
    console.log('Event type:', eventData.eventType);
    console.log('Event data:', JSON.stringify(eventData.data, null, 2));

    // Handle different event types
    switch (eventData.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
        console.log('Processing subscription created/activated event');
        await handleSubscriptionActivated(eventData.data);
        break;
              
      case EventName.SubscriptionUpdated:
        console.log('Processing subscription updated event');
        await handleSubscriptionUpdated(eventData.data);
        break;
              
      case EventName.SubscriptionCanceled:
        console.log('Processing subscription cancelled event');
        await handleSubscriptionCancelled(eventData.data);
        break;

      case EventName.SubscriptionPastDue:
        console.log('Processing subscription past due event');
        await handleSubscriptionPastDue(eventData.data);
        break;
              
      case EventName.SubscriptionPaused:
        console.log('Processing subscription paused event');
        await handleSubscriptionPaused(eventData.data);
        break;
              
      case EventName.SubscriptionResumed:
        console.log('Processing subscription resumed event');
        await handleSubscriptionResumed(eventData.data);
        break;

      default:
        console.log('Unhandled event type:', eventData.eventType);
    }

    console.log('=== PADDLE WEBHOOK PROCESSING SUCCESSFUL ===');
    res.status(200).json({ received: true });

  } catch (error) {
    console.log('=== PADDLE WEBHOOK ERROR ===');
    console.log('Full error object:', JSON.stringify(error, null, 2));
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.log('Request body (raw):', req.body);
        
    res.status(400).json({ error: 'Webhook failed' });
  }
});
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


// Helper function to get user with links
const getUserWithLinks = async (email) => {
  // Get user data - including subscription fields
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, plan, subscription_status, subscription_id, created_at')
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
    plan: user.plan || 'free',
    subscription_status: user.subscription_status || 'none',
    links: links.map(link => ({
      id: link.id,
      url: link.url,
      ping_count: link.ping_count || 0,
      last_ping: link.last_ping
    }))
  };

  return { data: userWithLinks, error: null };
};
// Enhanced Paddle webhook handlers
async function handleSubscriptionActivated(subscription) {
  console.log('=== HANDLING SUBSCRIPTION ACTIVATED ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  const userId = subscription.customData?.userId;
  const email = subscription.customData?.email;

  if (!userId && !email) {
    console.log('ERROR: No user identifier found in subscription data');
    return;
  }

  // Find user by userId first, then by email as fallback
  let userQuery = supabase.from('users').select('id, email');
  if (userId) {
    userQuery = userQuery.eq('id', userId);
  } else {
    userQuery = userQuery.eq('email', email);
  }

  const { data: user, error: userError } = await userQuery.single();

  if (userError || !user) {
    console.log('ERROR: User not found for subscription activation');
    console.log('User lookup error:', JSON.stringify(userError, null, 2));
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'paid',
      subscription_status: 'active',
      subscription_id: subscription.id
    })
    .eq('id', user.id);

  if (error) {
    console.log('ERROR: Failed to activate subscription in database');
    console.log('Database error:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS: Subscription activated for user:', user.email);
  }
}
async function handleSubscriptionPastDue(subscription) {
  console.log('=== HANDLING SUBSCRIPTION PAST DUE ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'past_due'
    })
    .eq('subscription_id', subscription.id);
   
  if (error) {
    console.log('ERROR: Failed to update subscription to past_due in database');
    console.log('Database error:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS: Subscription marked as past_due and downgraded to free for subscription:', subscription.id);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('=== HANDLING SUBSCRIPTION UPDATED ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  // Check if subscription has a scheduled change to cancel
  if (subscription.scheduledChange && subscription.scheduledChange.action === 'cancel') {
    console.log('Subscription has scheduled cancellation');
    
    const { error } = await supabase
      .from('users')
      .update({ 
        subscription_status: 'scheduled_cancel'
      })
      .eq('subscription_id', subscription.id);
     
    if (error) {
      console.log('ERROR: Failed to update subscription status to scheduled_cancel');
      console.log('Database error:', JSON.stringify(error, null, 2));
    } else {
      console.log('SUCCESS: Subscription marked as scheduled_cancel for subscription:', subscription.id);
    }
  } else if (subscription.status === 'active' && !subscription.scheduledChange) {
    // Subscription is active with no scheduled changes (cancellation was removed)
    console.log('Subscription is active with no scheduled changes - reactivating');
    
    const { error } = await supabase
      .from('users')
      .update({ 
        plan: 'paid',
        subscription_status: 'active'
      })
      .eq('subscription_id', subscription.id);
     
    if (error) {
      console.log('ERROR: Failed to reactivate subscription status');
      console.log('Database error:', JSON.stringify(error, null, 2));
    } else {
      console.log('SUCCESS: Subscription reactivated for subscription:', subscription.id);
    }
  } else {
    console.log('No status update needed for subscription:', subscription.id);
    console.log('Current status:', subscription.status);
    console.log('Scheduled change:', subscription.scheduledChange);
  }
}

async function handleSubscriptionCancelled(subscription) {
  console.log('=== HANDLING SUBSCRIPTION CANCELLED ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'cancelled'
    })
    .eq('subscription_id', subscription.id);
   
  if (error) {
    console.log('ERROR: Failed to cancel subscription in database');
    console.log('Database error:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS: Subscription cancelled and downgraded to free for subscription:', subscription.id);
  }
}

async function handleSubscriptionPaused(subscription) {
  console.log('=== HANDLING SUBSCRIPTION PAUSED ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'free',
      subscription_status: 'paused'
    })
    .eq('subscription_id', subscription.id);
   
  if (error) {
    console.log('ERROR: Failed to pause subscription in database');
    console.log('Database error:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS: Subscription paused for subscription:', subscription.id);
  }
}

async function handleSubscriptionResumed(subscription) {
  console.log('=== HANDLING SUBSCRIPTION RESUMED ===');
  console.log('Subscription object:', JSON.stringify(subscription, null, 2));

  const { error } = await supabase
    .from('users')
    .update({ 
      plan: 'paid',
      subscription_status: 'active'
    })
    .eq('subscription_id', subscription.id);
   
  if (error) {
    console.log('ERROR: Failed to resume subscription in database');
    console.log('Database error:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS: Subscription resumed for subscription:', subscription.id);
  }
}

// Cancel subscription endpoint
app.post('/api/subscription/cancel', async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('=== CANCEL SUBSCRIPTION REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Email:', email);

    if (!email) {
      console.log('ERROR: Missing email');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Email is required'
      });
    }

    // Check if user exists and get their subscription details
    console.log('Checking if user exists with email:', email);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, subscription_id, subscription_status, plan')
      .eq('email', email)
      .single();

    if (userError) {
      console.log('=== USER LOOKUP ERROR ===');
      console.log('Full userError object:', JSON.stringify(userError, null, 2));
      
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User account not found'
      });
    }

    console.log('User found:', user);

    // Check if user has an active subscription
    if (!user.subscription_id) {
      console.log('ERROR: User has no subscription');
      return res.status(400).json({
        success: false,
        error: 'No subscription found',
        message: 'User does not have an active subscription'
      });
    }

    // Check if subscription is already cancelled or scheduled for cancellation
    if (user.subscription_status === 'cancelled') {
      console.log('ERROR: Subscription already cancelled');
      return res.status(400).json({
        success: false,
        error: 'Already cancelled',
        message: 'Subscription is already cancelled'
      });
    }

    if (user.subscription_status === 'scheduled_cancel') {
      console.log('ERROR: Subscription already scheduled for cancellation');
      return res.status(400).json({
        success: false,
        error: 'Already scheduled for cancellation',
        message: 'Subscription is already scheduled to cancel at the end of the billing period'
      });
    }

    if (user.subscription_status === 'past_due') {
      console.log('ERROR: Subscription is past due');
      return res.status(400).json({
        success: false,
        error: 'Subscription past due',
        message: 'Cannot cancel subscription that is past due. Please update payment method first.'
      });
    }

    // Cancel subscription in Paddle at the end of billing period
    console.log('Cancelling Paddle subscription at end of billing period:', user.subscription_id);
    try {
      const cancelRequest = {
        effective_from: 'next_billing_period'
      };

      console.log('Sending cancel request to Paddle:', cancelRequest);
      
      const response = await fetch(`https://api.paddle.com/subscriptions/${user.subscription_id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cancelRequest)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.log('Paddle API error response:', errorData);
        throw new Error(`Paddle API error: ${response.status} - ${errorData}`);
      }

      const cancelledSubscription = await response.json();
      console.log('Paddle subscription cancellation scheduled successfully:', cancelledSubscription);

      // Check if Paddle returned a scheduled_change for cancellation
      const hasScheduledCancellation = cancelledSubscription.data?.scheduled_change?.action === 'cancel';
      
      if (hasScheduledCancellation) {
        // Update user subscription status to indicate cancellation is scheduled
        console.log('Updating user subscription status to scheduled_cancel...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            subscription_status: 'scheduled_cancel'
          })
          .eq('id', user.id);

        if (updateError) {
          console.log('=== USER UPDATE ERROR ===');
          console.log('Full updateError object:', JSON.stringify(updateError, null, 2));
          
          return res.status(500).json({
            success: false,
            error: 'Database update failed',
            message: 'Subscription was cancelled in Paddle but failed to update local status'
          });
        }

        console.log('User subscription status updated successfully to scheduled_cancel');
        
        res.json({
          success: true,
          message: 'Subscription cancelled successfully',
          details: 'Your subscription will remain active until the end of your current billing period. You will continue to have paid access until then.',
          status: 'scheduled_cancel',
          effective_at: cancelledSubscription.data?.scheduled_change?.effective_at
        });
      } else {
        // Immediate cancellation (though we requested next_billing_period)
        console.log('Subscription was cancelled immediately');
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            subscription_status: 'cancelled',
            plan: 'free'
          })
          .eq('id', user.id);

        if (updateError) {
          console.log('=== USER UPDATE ERROR ===');
          console.log('Full updateError object:', JSON.stringify(updateError, null, 2));
        }

        res.json({
          success: true,
          message: 'Subscription cancelled immediately',
          details: 'Your subscription has been cancelled and you have been downgraded to the free plan.',
          status: 'cancelled'
        });
      }

    } catch (paddleError) {
      console.log('=== PADDLE CANCELLATION ERROR ===');
      console.log('Full paddleError object:', JSON.stringify(paddleError, null, 2));
      console.log('Error message:', paddleError.message);
      
      return res.status(500).json({
        success: false,
        error: 'Paddle cancellation failed',
        message: 'Failed to cancel subscription with payment provider',
        details: paddleError.message
      });
    }

  } catch (error) {
    console.log('=== MAIN CATCH BLOCK ERROR ===');
    console.log('Full error object:', JSON.stringify(error, null, 2));
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

// Create subscription endpoint
app.post('/api/payment/create-subscription', async (req, res) => {
  try {
    const { email, plan } = req.body;
    
    console.log('=== CREATE SUBSCRIPTION REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Email:', email);
    console.log('Plan:', plan);

    if (!email || !plan) {
      console.log('ERROR: Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and plan are required'
      });
    }

    // Check if user exists
    console.log('Checking if user exists with email:', email);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError) {
      console.log('=== USER LOOKUP ERROR ===');
      console.log('Full userError object:', JSON.stringify(userError, null, 2));
      console.log('Error message:', userError.message);
      console.log('Error details:', userError.details);
      console.log('Error hint:', userError.hint);
      console.log('Error code:', userError.code);
      
      return res.status(404).json({
        error: 'User not found',
        message: 'Please create an account first'
      });
    }

    console.log('User found:', user);

    // Return price ID for Paddle checkout
    const priceId = process.env.PADDLE_PRICE_ID || 'pri_01k4ek5kezcsa14ezw9whm5yjs';

    console.log('Returning price ID for Paddle checkout:', priceId);

    // Update user with pending subscription status
    console.log('Updating user with pending subscription status...');
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        subscription_status: 'pending'
      })
      .eq('id', user.id);

    if (updateError) {
      console.log('=== USER UPDATE ERROR ===');
      console.log('Full updateError object:', JSON.stringify(updateError, null, 2));
      console.log('Warning: Failed to update user with pending status, but continuing');
    } else {
      console.log('User updated with pending subscription status successfully');
    }

    console.log('=== SUBSCRIPTION CREATION SUCCESSFUL ===');
    res.json({
      success: true,
      priceId: priceId
    });

  } catch (error) {
    console.log('=== MAIN CATCH BLOCK ERROR ===');
    console.log('Full error object:', JSON.stringify(error, null, 2));
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create subscription',
      details: error.message,
      errorName: error.name
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Your API is running',
    timestamp: new Date().toISOString()
  });
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
    .select('id, email, created_at, plan')
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
            email: email
          }
        ])
        .select('id, email, created_at')
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

// Get user data with links
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
      
      console.error('Error fetching user data:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user data'
      });
    }
    
    // Calculate totals from links
    const totalPings = user.links?.reduce((sum, link) => sum + (link.ping_count || 0), 0) || 0;
    
    res.json({
      success: true,
      message: 'User data retrieved successfully',
      data: {
        user: {
          email: user.email,
          plan: user.plan,
          subscription_status: user.subscription_status,
          subscription_id: user.subscription_id,
          created_at: user.created_at
        },
        links: user.links || [],
        total_links: user.links?.length || 0,
        total_pings: totalPings
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
            email: email
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


app.listen(PORT, () => {
  console.log(`🚀 KeepAlive API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Add URL: POST http://localhost:${PORT}/api/urls`);
  console.log(`💰 Get Credit: GET http://localhost:${PORT}/api/credit/:email`);
  console.log(`➕ Add Credit: POST http://localhost:${PORT}/api/credit/add`);
});

module.exports = app;