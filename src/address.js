import Router from 'koa-router';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { logger } from './logger.js';

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

    logger.info(`[ADDRESS][CREATE_ADDRESS] Email: ${email}, City: ${city}, Street: ${street}`);

    if (!street || !city || !county) {
        logger.warn(`[ADDRESS][CREATE_ADDRESS_FAIL] Email: ${email}, Missing required fields`);
        ctx.response.status = 400;
        ctx.response.body = { message: 'Street, city and county are required' };
        return;
    }

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logger.warn(`[ADDRESS][CREATE_ADDRESS_FAIL] Email: ${email}, User not found`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'User not found' };
            return;
        }

        const fullAddress = `Strada ${street}, ${city}, ${county}, Romania`;
        logger.info(`[ADDRESS][GEOCODING_ATTEMPT] Email: ${email}, Address: ${fullAddress}`);

        let lat = null, lng = null;

        try {
            const fullAddress = `${street} ${number || ''}, ${city}, ${county}, Romania`;
            const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`, {
                headers: {
                    'User-Agent': 'GateConfigurationApp/1.0 (sergiud222@gmail.com)'
                }
            });

            const geocodeData = await geocodeRes.json();
            if (Array.isArray(geocodeData) && geocodeData.length > 0) {
                lat = parseFloat(geocodeData[0].lat);
                lng = parseFloat(geocodeData[0].lon);
                logger.info(`[ADDRESS][GEOCODING_SUCCESS] Email: ${email}, Lat: ${lat}, Lng: ${lng}`);
            } else {
                logger.warn(`[ADDRESS][GEOCODING_FAIL] Email: ${email}, No results for address: ${fullAddress}`);
            }
        } catch (err) {
            logger.error(`[ADDRESS][GEOCODING_ERROR] Email: ${email}, Error: ${err.message}`);
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
            logger.error(`[ADDRESS][CREATE_ADDRESS_ERROR] Email: ${email}, Error: ${insertError.message}`);
            ctx.response.status = 400;
            ctx.response.body = { message: insertError.message };
            return;
        }

        logger.info(`[ADDRESS][CREATE_ADDRESS_SUCCESS] Email: ${email}, AddressId: ${address.id}, Label: ${label || 'N/A'}`);
        ctx.response.body = address;

    } catch (err) {
        logger.error(`[ADDRESS][CREATE_ADDRESS_ERROR] Email: ${email}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});

// Get all addresses for current user
addressRouter.get('/', async (ctx) => {
    const { email } = ctx.state.user;
    logger.info(`[ADDRESS][GET_USER_ADDRESSES] Email: ${email}`);

    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logger.warn(`[ADDRESS][GET_USER_ADDRESSES_FAIL] Email: ${email}, User not found`);
            ctx.response.status = 400;
            ctx.response.body = { message: 'User not found' };
            return;
        }

        const { data: addresses, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            logger.error(`[ADDRESS][GET_USER_ADDRESSES_ERROR] Email: ${email}, Error: ${error.message}`);
            ctx.response.status = 500;
            ctx.response.body = { message: error.message };
            return;
        }

        logger.info(`[ADDRESS][GET_USER_ADDRESSES_SUCCESS] Email: ${email}, Count: ${addresses.length}`);
        ctx.response.body = addresses;

    } catch (err) {
        logger.error(`[ADDRESS][GET_USER_ADDRESSES_ERROR] Email: ${email}, Error: ${err.message}`);
        ctx.response.status = 500;
        ctx.response.body = { message: err.message };
    }
});