import Router from 'koa-router';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { jwtConfig } from './utils.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from "bcrypt";
import argon2 from 'argon2';
import { requireAuth } from './requireAuth.js';

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
  console.log('Login attempt:', { email, password }); // Log the incoming data

  try {
    // Find the user by email
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_deleted', false) // ✅ ignoră conturile șterse
        .single();


    if (error || !user) {
      ctx.response.body = { error: 'Invalid credentials' };
      ctx.response.status = 400; // Bad Request
      return;
    }
    console.log(user);
    // Check if password matches
    console.log("user password",user.password, "hashedPassword",password);
    const match = await argon2.verify(user.password, password);
    if (match) {
      const token = jwt.sign({ email: user.email, _id: user.id }, jwtConfig.secret, { expiresIn: '1h' });
      ctx.response.body = { message: 'Login successful', token };
      ctx.response.status = 200; // OK
      console.log("am aj");
    } else {
      ctx.response.body = { message: 'Invalid credentials' };
      ctx.response.status = 400; // Bad Request
    }

  } catch (err) {
    console.error('Login error:', err); // Log any errors
    ctx.response.body = { error: err.message };
    ctx.response.status = 500; // Internal Server Error
  }
});


authRouter.post('/signup', async (ctx) => {
  const { username, password, email } = ctx.request.body;
  console.log('Signup attempt:', { username, password, email });

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
      ctx.response.body = { message: 'Email already exists' };
      ctx.response.status = 400;
      return;
    }

    // Insert the user (username is not required to be unique)
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, password: hashedPassword, email }]);

    if (error) {
      console.error('Error inserting user:', error);
      ctx.response.body = { error: error.message };
      ctx.response.status = 400;
    } else {
      ctx.response.body = { message: 'User created successfully', data };
      ctx.response.status = 201;
    }

  } catch (err) {
    console.error('Signup error:', err);
    ctx.response.body = { error: err.message };
    ctx.response.status = 500;
  }
});



authRouter.post('/forgotpassword', async (ctx) => {
    const { email } = ctx.request.body;
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
  console.log('Signup attempt:', {  newPassword, email }); // Log the incoming data
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

    console.log(`Password change email sent to ${email}`);

    // Success message
    ctx.response.body = { message: 'Password changed successfully. A confirmation email has been sent.' };
    ctx.response.status = 200;
  } catch (mailError) {
    console.error('Error sending email:', mailError); // Log the actual error
    ctx.response.body = { error: 'Error sending confirmation email.' };
    ctx.response.status = 500;
  }

});
authRouter.delete('/account', requireAuth, async (ctx) => {
  const email = ctx.state.user.email;

  const { error } = await supabase
      .from('users')
      .update({ is_deleted: true })
      .eq('email', email);

  if (error) {
    ctx.response.status = 500;
    ctx.response.body = { message: 'Eroare la ștergere cont' };
  } else {
    ctx.response.status = 200;
    ctx.response.body = { message: 'Contul a fost marcat ca șters' };
  }
});


export default authRouter;