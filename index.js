const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(express.json())
app.use(cors())

app.get('/', async (req, res) => {
    res.send('Phone Resale Server is running')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nslo89v.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    //console.log(req.headers.authorization)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.USER_TOKEN, function (error, decoded) {
        if (error) {
            res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const phonesCollection = client.db('phoneResaleDB').collection('phones');
        const usersCollection = client.db('phoneResaleDB').collection('users');
        const bookingCollection = client.db('phoneResaleDB').collection('bookings');
        const paymentCollection = client.db('phoneResaleDB').collection('payments');

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const admin = await usersCollection.findOne(query);

            if (admin?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const registeredUser = await usersCollection.findOne(query);
            if (registeredUser) {
                const token = jwt.sign({ email }, process.env.USER_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            res.send({ accessToken: 'Token not Found' })
        })

        app.get('/category/:brand', async (req, res) => {
            const brand = req.params.brand
            const query = { brand: brand }
            const result = await phonesCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/phones', async (req, res) => {
            const query = {}
            const result = await phonesCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/phones', async (req, res) => {
            const phone = req.body;
            const result = await phonesCollection.insertOne(phone);
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.get('/buyers', async (req, res) => {
            const query = { isSeller: false }
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/sellers', async (req, res) => {
            const query = { isSeller: true }
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/sellers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const seller = await usersCollection.findOne(query);
            if (seller?.isSeller === true) {
                res.send({ isSeller: true })
            }
            else {
                res.send({ isSeller: false })
            }
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role === 'admin') {
                res.send({ isAdmin: true })
            }
            else {
                res.send({ isAdmin: false })
            }
        })

        app.get('/products', verifyJWT, async (req, res) => {
            const email = req.query.email;
            //console.log("email ", email)
            const query = { email: email }
            const decodedEmail = req.decoded.email;
            //console.log("decoded email ", decodedEmail)
            if (email !== decodedEmail) {
                res.status(403).send({ message: 'forbidden' })
            }
            const products = await phonesCollection.find(query).toArray();
            res.send(products);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                email: booking.email,
            }
            const emailBooked = await bookingCollection.find(query).toArray();
            //console.log(emailBooked)

            const result = await bookingCollection.insertOne(booking);
            res.send(result)
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const decodedEmail = req.decoded.email;
            //console.log(decodedEmail)
            if (email !== decodedEmail) {
                res.status(403).send({ message: 'forbidden' })
            }
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
        })

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        app.delete('/seller/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        })

        app.delete('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await phonesCollection.deleteOne(filter)
            res.send(result)
        })

        app.delete('/buyer/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })

        app.put('/users/verify:id/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const email = req.params.email;
            const filter = { _id: ObjectId(id) }
            const filterPhone = { email: email }
            //console.log(id, email);
            const options = { upsert: true }
            const updatedDoc = { $set: { verify: 'verified' } }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const phones = await phonesCollection.updateMany(filterPhone, updatedDoc, options);
            res.send({ result, phones });
        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.post('/payment', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);

            const id = payment.bookingId;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = { $set: { paid: 'paid' } }
            const paidBookings = await bookingCollection.updateOne(filter, updatedDoc, options);

            const filterPhoneId = { _id: ObjectId(payment.phoneId) }
            const updatedDocPhone = { $set: { status: 'sold' } }
            const updatedPhoneCollection = await phonesCollection.updateOne(filterPhoneId, updatedDocPhone, options);
            res.send(result)
        })

    }
    finally {

    }
}
run().catch();

app.listen(port, () => {
    console.log(`Phone Resale server in running on ${port}`)
})