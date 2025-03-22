import Router from 'koa-router';
import dataStore from 'nedb-promise';
import { broadcast } from './wss.js';

export class GateStore {
    constructor({ filename, autoload }) {
        this.store = dataStore({ filename, autoload });
    }

    // Search based on props
    async find(props) {
        return this.store.find(props);
    }

    // Return a single gate
    async findOne(props) {
        return this.store.findOne(props);
    }

    // Add a new gate
    async insert(gate) {
        if (!gate.gate_name) { // Validation
            throw new Error('Missing gate_name property');
        }
        return this.store.insert(gate);
    }

    // Modify a gate
    async update(props, gate) {
        return this.store.update(props, { $set: gate }, { multi: false, upsert: false });
    }

    // Delete a gate
    async remove(props) {
        return this.store.remove(props);
    }
}

const gateStore = new GateStore({ filename: './db/gates.json', autoload: true });

export const gateRouter = new Router();

// Find gates for a specific user
gateRouter.get('/', async (ctx) => {
    console.log("find:");
    const userId = ctx.state.user._id;
    ctx.response.body = await gateStore.find({ userId });
    ctx.response.status = 200; // OK
});

// Find all gates
gateRouter.get('/all', async (ctx) => {
    console.log("find all gates:");
    ctx.response.body = await gateStore.find({}); // Without a filter, returns all gates
    ctx.response.status = 200; // OK
});

// Find a single gate by ID
gateRouter.get('/:id', async (ctx) => {
    console.log("findOne:");
    const userId = ctx.state.user._id;
    const gate = await gateStore.findOne({ _id: ctx.params.id });
    if (gate) {
        if (gate.userId === userId) {
            ctx.response.body = gate;
            ctx.response.status = 200; // OK
        } else {
            ctx.response.status = 403; // Forbidden
        }
    } else {
        ctx.response.status = 404; // Not found
    }
});

const createGate = async (ctx, gate, response) => {
    try {
        console.log("insert:");
        const userId = ctx.state.user._id; // Get userId from the authenticated user

        gate.userId = userId; // Add userId to the gate object
        gate.date = new Date();
        gate.version = 1;
        gate.isOperational = true; // Default operational state
        console.log(gate); // Check the gate object before insertion (should now include userId)

        response.body = await gateStore.insert(gate);
        console.log(response.body); // Check the response after insertion (should have _id now)

        response.status = 201; // Created
        broadcast(userId, { type: 'created', payload: response.body });
    } catch (err) {
        response.body = { message: err.message };
        response.status = 400; // Bad request
    }
};


// Insert a new gate
gateRouter.post('/', async (ctx) => await createGate(ctx, ctx.request.body, ctx.response));

// Update an existing gate
gateRouter.put('/:id', async (ctx) => {
    console.log("update:");
    const gate = ctx.request.body;
    const id = ctx.params.id;
    console.log("param's ':id':", id);
    const gateId = gate._id;
    console.log("gate's '_id':", gateId);
    const response = ctx.response;

    if (gateId && gateId !== id) {
        response.body = { message: 'Param id and body _id should be the same' };
        response.status = 400; // Bad request
        return;
    }

    if (!gateId) {
        console.log("in update - await createGate");
        await createGate(ctx, gate, response);
    } else {
        const userId = ctx.state.user._id;
        gate.version++;
        console.log("gate:", gate);

        const updatedCount = await gateStore.update({ _id: id }, gate);

        if (updatedCount === 1) {
            response.body = gate;
            response.status = 200; // OK
            broadcast(userId, { type: 'updated', payload: gate });
        } else {
            response.body = { message: 'Resource no longer exists' };
            response.status = 405; // Method not allowed
        }
    }
});

// Remove a gate
gateRouter.del('/:id', async (ctx) => {
    console.log("remove:");
    const userId = ctx.state.user._id;
    const gate = await gateStore.findOne({ _id: ctx.params.id });
    if (gate && userId !== gate.userId) {
        ctx.response.status = 403; // Forbidden
    } else {
        await gateStore.remove({ _id: ctx.params.id });
        ctx.response.status = 204; // No content
    }
});
