const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

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
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
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
        const sellersCollection = client.db('phoneResaleDB').collection('sellers');
        const buyersCollection = client.db('phoneResaleDB').collection('buyers');
        const usersCollection = client.db('phoneResaleDB').collection('users');

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const seller = await sellersCollection.findOne(query);

            if (seller?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const registeredseller = await sellersCollection.findOne(query);
            if (registeredseller) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            //console.log(registeredseller)
            res.send({ accessToken: 'unathorized' })
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
        // app.put('/sellers/admin:id', verifyJWT, verifyAdmin, async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) }
        //     const options = { upsert: true }
        //     const updatedDoc = { $set: { role: 'admin' } }
        //     const result = await sellersCollection.updateOne(filter, updatedDoc, options);
        //     res.send(result)

        // })
    }
    finally {

    }
}
run().catch();

app.listen(port, () => {
    console.log(`Phone Resale server in running on ${port}`)
})