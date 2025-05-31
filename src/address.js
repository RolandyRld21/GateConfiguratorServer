import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = 'https://qpvdjklmliwunjimrtpg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdmRqa2xtbGl3dW5qaW1ydHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMzg2MTEsImV4cCI6MjA1NzYxNDYxMX0.FZRpiDZtUVFtjLnNrTqALRWR4ZN1IAj_22VngzaQllw';
const supabase = createClient(supabaseUrl, supabaseKey);

export const addressRouter = new Router();

const orsApiKey = '5b3ce3597851110001cf62488b28c1e436864c7792612ed948ae3afb';
const sebesCoords = [23.5746, 45.9567]; // long, lat for Sebes

// Create a new address
addressRouter.post('/', async (ctx) => {
    const { email } = ctx.state.user;
    const {
        street, city, county, postal_code,
        label, number, floor, stair, phone
    } = ctx.request.body;

    if (!street || !city || !county) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'Street, city and county are required' };
        return;
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !user) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'User not found' };
        return;
    }

    const fullAddress = `Strada ${street}, ${city}, ${county}, Romania`;

    let lat = null, lng = null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;

    try {
        const fullAddress = `${street} ${number || ''}, ${city}, ${county}, Romania`;
        const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`, {
            headers: {
                'User-Agent': 'GateConfigurationApp/1.0 (sergiud222@gmail.com)'            }
        });

        const geocodeData = await geocodeRes.json();
        if (Array.isArray(geocodeData) && geocodeData.length > 0) {
            lat = parseFloat(geocodeData[0].lat);
            lng = parseFloat(geocodeData[0].lon);
        } else {
            console.warn('⚠️ Geocoding returned no results');
        }
    } catch (err) {
        console.error('❌ Geocoding failed:', err.message);
    }


    // Insert the new address
    const { data: address, error: insertError } = await supabase
        .from('addresses')
        .insert([{
            user_id: user.id,
            street,
            city,
            county,
            postal_code,
            lat,
            lng,
            label,
            number,
            floor,
            stair,
            phone
        }])
        .select()
        .single();

    if (insertError) {
        ctx.response.status = 400;
        ctx.response.body = { message: insertError.message };
        return;
    }

    ctx.response.body = address;
});

// Get all addresses for current user
addressRouter.get('/', async (ctx) => {
    const { email } = ctx.state.user;

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (userError || !user) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'User not found' };
        return;
    }

    const { data: addresses, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id);

    if (error) {
        ctx.response.status = 500;
        ctx.response.body = { message: error.message };
        return;
    }

    ctx.response.body = addresses;
});
