const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your_jwt_secret_key'; // Use a more secure key in production

// Database setup
const sequelize = new Sequelize('sqlite::memory:'); // Use MySQL or other in production

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Models
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
});

const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL, allowNull: false },
    description: { type: DataTypes.TEXT }
});

const Cart = sequelize.define('Cart', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false }
});

const Order = sequelize.define('Order', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

// Associations
Product.hasMany(Cart);
Cart.belongsTo(Product);
User.hasMany(Cart);
Cart.belongsTo(User);
User.hasMany(Order);
Order.belongsTo(User);

// Sync database
sequelize.sync();

// Routes
// User authentication
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Product catalog
app.get('/products', async (req, res) => {
    try {
        const products = await Product.findAll();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findByPk(id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Shopping cart functionality
app.post('/cart', async (req, res) => {
    const { userId, productId, quantity } = req.body;
    try {
        const cartItem = await Cart.create({ userId, productId, quantity });
        res.status(201).json(cartItem);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/cart/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const cartItem = await Cart.destroy({ where: { id } });
        if (cartItem) {
            res.status(204).end();
        } else {
            res.status(404).json({ error: 'Cart item not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/cart/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const cartItems = await Cart.findAll({ where: { userId } });
        res.json(cartItems);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Order placement
app.post('/orders', async (req, res) => {
    const { userId, totalAmount } = req.body;
    try {
        const order = await Order.create({ userId, totalAmount });
        // Clear cart after order
        await Cart.destroy({ where: { userId } });
        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const orders = await Order.findAll({ where: { userId } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Product image handling
const upload = multer({ dest: 'uploads/' });
app.post('/images', upload.single('image'), (req, res) => {
    const { filename, path: tempPath } = req.file;
    const targetPath = path.join(__dirname, 'uploads', filename);

    fs.rename(tempPath, targetPath, err => {
        if (err) return res.status(500).json({ error: 'Internal Server Error' });
        res.status(201).json({ message: 'Image uploaded successfully', filename });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
