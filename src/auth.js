import Router from 'koa-router';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { jwtConfig } from './utils.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from "bcrypt";
import argon2 from 'argon2';
import { requireAuth } from './requireAuth.js';
import { logger } from './logger.js';

// Initialize Supabase
const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co'; // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw'; // Replace with your Supabase anon key
const supabase = createClient(supabaseUrl, supabaseKey);

export const authRouter = new Router();
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use your email provider
  auth: {
    user: 'sergiud222@gmail.com',
    pass: 'ksda vnmp zxqs dwiu'
  }
});
authRouter.post('/login', async (ctx) => {
  const { email, password } = ctx.request.body;
  logger.info(`[AUTH][LOGIN_ATTEMPT] Email: ${email}`);
  try {
    // Find the user by email
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_deleted', false) // ✅ ignoră conturile șterse
        .single();

    if (error || !user) {
      logger.warn(`[AUTH][LOGIN_FAIL] Email: ${email}`);
      ctx.response.body = { error: 'Invalid credentials' };
      ctx.response.status = 400; // Bad Request
      return;
    }

    // Check if password matches
    const match = await argon2.verify(user.password, password);
    if (match) {
      logger.info(`[AUTH][LOGIN_SUCCESS] Email: ${email}`);
      const token = jwt.sign({ email: user.email, _id: user.id }, jwtConfig.secret, { expiresIn: '24h' });
      ctx.response.body = {
        message: 'Login successful',
        token,
        role: user.role || 'client'
      };
      ctx.response.status = 200; // OK
    } else {
      logger.warn(`[AUTH][LOGIN_FAIL] Password mismatch for email: ${email}`);
      ctx.response.body = { message: 'Invalid credentials' };
      ctx.response.status = 400; // Bad Request
    }

  } catch (err) {
    logger.error(`[AUTH][LOGIN_ERROR] Email: ${email}, Error: ${err.message}`);
    ctx.response.body = { error: err.message };
    ctx.response.status = 500; // Internal Server Error
  }
});


authRouter.post('/signup', async (ctx) => {
  const { username, password, email } = ctx.request.body;
  logger.info(`[AUTH][SIGNUP_ATTEMPT] Email: ${email}`);
  const options = {
    timeCost: 2,
    memoryCost: 512 * 512,
    parallelism: 1,
  };

  const hashedPassword = await argon2.hash(password, options);

  try {
    // Only check if the email already exists
    const { data: existingEmailUser, error: emailCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (emailCheckError && emailCheckError.code !== 'PGRST116') {
      console.error('Error checking email:', emailCheckError);
      ctx.response.body = { message: 'Error checking email' };
      ctx.response.status = 500;
      return;
    }

    if (existingEmailUser) {
      logger.warn(`[AUTH][SIGNUP_FAIL] Email exists: ${email}`);
      ctx.response.body = { message: 'Email already exists' };
      ctx.response.status = 400;
      return;
    }

    // Insert the user (username is not required to be unique)
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, password: hashedPassword, email, role: 'client' }]);


    if (error) {
      logger.error(`[AUTH][SIGNUP_ERROR] Email: ${email} - ${error.message}`);
      ctx.response.body = { error: error.message };
      ctx.response.status = 400;
    } else {
      logger.info(`[AUTH][SIGNUP_SUCCESS] Email: ${email}`);
      ctx.response.body = { message: 'User created successfully', data };
      ctx.response.status = 201;
    }

  } catch (err) {
    logger.error(`[AUTH][SIGNUP_ERROR] Email: ${email}, Error: ${err.message}`);
    ctx.response.body = { error: err.message };
    ctx.response.status = 500;
  }
});



authRouter.post('/forgotpassword', async (ctx) => {
    const { email } = ctx.request.body;
    logger.info(`[AUTH][FORGOT_PASSWORD_ATTEMPT] Email: ${email}`);

    const options = {
      timeCost: 2,
      memoryCost: 512 * 512,
      parallelism: 1,
    };

    //search the email in the database
   const {data: user, error} = await supabase
       .from('users')
       .select('*')
       .eq('email', email)
       .single();

   if (error || !user) {
     logger.warn(`[AUTH][FORGOT_PASSWORD_FAIL] Email exists: ${email}`);
     ctx.response.body = {error: "Email was not found!" };
     ctx.response.status = 400;
     return;
   }
   //Temporary password
   const tempPassword = crypto.randomBytes(4).toString('hex');
   const hashedPassword = await argon2.hash(tempPassword, options);

  //Update the password in the user table
  const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email);


  if (updateError) {

      ctx.response.body = {error: "Failed to Update Password!" };
      ctx.response.status = 400;
      return;
    }
  try {
    await transporter.sendMail({
      from: 'sergiud222@gmail.com',
      to: email,
      subject: 'Your Temporary Password',
      text: `Your temporary password is: ${tempPassword}\nUse this to log in and change your password later.`,
    });

    ctx.response.body = { message: "Temporary password sent to your email." };
    ctx.response.status = 200;
  } catch (mailError) {
    ctx.response.body = { error: "Error sending email" };
    ctx.response.status = 500;
  }

});
authRouter.post('/change-password', async (ctx) => {
  const { newPassword,  email } = ctx.request.body;
  const options = {
    timeCost: 2,
    memoryCost: 512 * 512,
    parallelism: 1,
  };

  const hashedPassword = await argon2.hash(newPassword, options);

  // Check if the email is valid
  if (!email) {
    ctx.response.body = { error: 'Email is required!' };
    ctx.response.status = 400;
    return;
  }

  // Search the email in the database
  const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

  if (error || !user) {
    ctx.response.body = { error: 'User not found!' };
    ctx.response.status = 400;
    return;
  }


  // Proceed to update the password if all is correct
  const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email);

  if (updateError) {
    logger.error(`[AUTH][FORGOT_PASSWORD_ERROR] Email: ${email}, Error: ${updateError.message}`);
    ctx.response.body = { error: 'Failed to update password!' };
    ctx.response.status = 400;
    return;
  }

  // Send confirmation email
  try {
    await transporter.sendMail({
      from: 'sergiud222@gmail.com',
      to: email,
      subject: 'Password Changed Successfully',
      text: `Your password has been successfully changed. If you did not request this change, please contact support immediately.`,
    });


    // Success message
    ctx.response.body = { message: 'Password changed successfully. A confirmation email has been sent.' };
    ctx.response.status = 200;
  } catch (mailError) {
    logger.error(`[AUTH][FORGOT_PASSWORD_ERROR] Email: ${email}, Error: ${mailError.message}`);
    ctx.response.body = { error: 'Error sending confirmation email.' };
    ctx.response.status = 500;
  }

});

// Ștergere cont utilizator curent
authRouter.delete('/account', requireAuth, async (ctx) => {
  const email = ctx.state.user.email;
  logger.info(`[AUTH][DELETE_ACCOUNT_ATTEMPT] Email: ${email}`);

  const { error } = await supabase
      .from('users')
      .update({ is_deleted: true })
      .eq('email', email);

  if (error) {
    logger.error(`[AUTH][DELETE_ACCOUNT_ERROR] Email: ${email}, Error: ${error.message}`);
    ctx.response.status = 500;
    ctx.response.body = { message: 'Eroare la ștergere cont' };
  } else {
    logger.info(`[AUTH][DELETE_ACCOUNT_SUCCESS] Email: ${email}`);
    ctx.response.status = 200;
    ctx.response.body = { message: 'Contul a fost marcat ca șters' };
  }
});

// Admin: ștergere utilizator (soft-delete)
authRouter.delete('/admin/delete-user/:email', requireAuth, async (ctx) => {
  const requesterEmail = ctx.state.user.email;
  const emailToDelete = ctx.params.email;
  logger.info(`[AUTH][DELETE_USER_ATTEMPT] Requester: ${requesterEmail} Target: ${emailToDelete}`);

  // verifică dacă requesterul este admin
  const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('email', requesterEmail)
      .single();

  if (adminError || !adminUser || adminUser.role !== 'admin') {
    logger.warn(`[AUTH][DELETE_USER_DENIED] Requester: ${requesterEmail} (Not admin)`);
    ctx.status = 403;
    ctx.body = { message: 'Access denied' };
    return;
  }

  const { error } = await supabase
      .from('users')
      .update({ is_deleted: true })
      .eq('email', emailToDelete);

  if (error) {
    logger.error(`[AUTH][DELETE_USER_ERROR] Admin: ${requesterEmail} Target: ${emailToDelete} Error: ${error.message}`);
    ctx.status = 500;
    ctx.body = { message: 'Failed to mark user as deleted' };
  } else {
    logger.info(`[AUTH][DELETE_USER_SUCCESS] Admin: ${requesterEmail} Target: ${emailToDelete}`);
    ctx.status = 200;
    ctx.body = { message: `User ${emailToDelete} marked as deleted` };
  }
});

// Admin: listare utilizatori
authRouter.get('/admin/users', requireAuth, async (ctx) => {
  const requesterEmail = ctx.state.user.email;
  logger.info(`[AUTH][USERS_LIST_ATTEMPT] Requester: ${requesterEmail}`);

  const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('email', requesterEmail)
      .single();

  if (adminError || !adminUser || adminUser.role !== 'admin') {
    logger.warn(`[AUTH][USERS_LIST_DENIED] Requester: ${requesterEmail} (Not admin)`);
    ctx.status = 403;
    ctx.body = { message: 'Access denied' };
    return;
  }

  const { data: users, error } = await supabase
      .from('users')
      .select('email, username, role, is_deleted');

  if (error) {
    logger.error(`[AUTH][USERS_LIST_ERROR] Requester: ${requesterEmail} Error: ${error.message}`);
    ctx.status = 500;
    ctx.body = { message: 'Failed to fetch users' };
  } else {
    logger.info(`[AUTH][USERS_LIST_SUCCESS] Requester: ${requesterEmail} Count: ${users.length}`);
    ctx.status = 200;
    ctx.body = users;
  }
});

export default authRouter;
