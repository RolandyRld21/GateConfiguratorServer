import Router from 'koa-router';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { jwtConfig } from './utils.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from "bcrypt";
import argon2 from 'argon2';

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
  console.log('Signup attempt:', { username, password, email }); // Log the incoming data
  const options = {
    timeCost: 2,    // Number of iterations
    memoryCost: 512 * 512, // 1MB of memory per thread (adjust as needed)
    parallelism: 1, // Use 1 thread (you can increase for multi-core support)
  };
  const hashedPassword = await argon2.hash(password,options);
  try {
    // Check if the username already exists
    const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    // If there is a Supabase error in the select query, handle it
    if (findError && findError.code !== 'PGRST116') {
      console.error('Error checking user:', findError); // Log the error if it's not "no row found"
      ctx.response.body = { message: 'Error checking user' };
      ctx.response.status = 500; // Internal Server Error
      return;
    }

    // If no user exists (this is not an error), we can safely proceed
    if (existingUser) {
      ctx.response.body = { message: 'Username already exists' };
      ctx.response.status = 400; // Bad Request
      return;
    }
    //Encrypt the password before adding it into the SupaBase

    // Insert the new user into Supabase
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, password:hashedPassword, email}]);

    console.log('Inserted data:', data); // Log inserted data
    console.log('Insertion error:', error); // Log any errors

    if (error) {
      console.error('Error inserting user:', error); // Log insertion errors
      ctx.response.body = { error: error.message };
      ctx.response.status = 400; // Bad Request
    } else {
      ctx.response.body = { message: 'User created successfully', data };
      ctx.response.status = 201; // Created
    }
  } catch (err) {
    console.error('Signup error:', err); // Log any errors
    ctx.response.body = { error: err.message };
    ctx.response.status = 500; // Internal Server Error
  }
});


authRouter.post('/forgotpassword', async (ctx) => {
    const { email } = ctx.request.body;

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
   //Update the password in the user table
    const {error: updateError} = await supabase
        .from('users')
        .update({password: tempPassword}, )
        .eq('email', email);
  console.log('Inserted data:', email, ' ads' , ' ' );

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
      .update({ password: newPassword })
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


export default authRouter;