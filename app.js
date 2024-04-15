const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const connection = mysql.createPool({
    host: '35.202.16.202',
    user: 'root',
    password: '38724h2eo',
    database: 'proj4db'
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = `uploads/${req.session.user.username}`;
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileBaseName = path.basename(file.originalname, path.extname(file.originalname));
      const finalFileName = `${fileBaseName}-${uniqueSuffix}${path.extname(file.originalname)}`;
      cb(null, finalFileName);
    }
});

const upload = multer({ storage: storage });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('uploads'));
app.use(session({
    secret: 'your_secret_key',
    resave: true,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');


let users = [
    { username: "user1", password: "pass1", photos: [] }
];


app.get('/', (req, res) => {
    res.render('login');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    connection.getConnection((err, connection) => {
        if (err) {
            console.error("Failed to connect to the database:", err);
            return;
        }
        console.log("Successfully connected to the database.");
    
        connection.query('SELECT 1 + 1 AS solution', (queryErr, results, fields) => {
            connection.release();
    
            if (queryErr) {
                console.error("Failed to execute query:", queryErr);
                return;
            }
        });
    });
    connection.execute('SELECT username FROM users WHERE username = ?', [username], (err, results) => {
        
        if (err) {
            return 'Error during the query:' + err
        }

        if (results.length > 0) {
            res.send('Username already taken. Please choose another.');
        } else {
            connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err, results) => {
                if (err) throw err;
                req.session.user = { id: results.insertId, username: username };
                res.redirect('/profile');
            });
        }
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    connection.execute('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        
        if (err) {
            return 'Error during the query:' + err
        }

        if (results.length > 0) {
            req.session.user = results[0];
            res.redirect('/profile');
        } else {
            res.send('Login Failed');
        }
    });
});

app.post('/upload', upload.single('photo'), (req, res) => {
    if (req.session.user) {
        const filename = req.file.filename;
        connection.execute('INSERT INTO photos (user_id, filename) VALUES (?, ?)', [req.session.user.id, filename], (err, results) => {
            if (err) throw err;
            res.redirect('/profile');
        });
    } else {
        res.redirect('/');
    }
});

app.get('/profile', (req, res) => {
    if (req.session.user) {
        connection.execute('SELECT filename FROM photos WHERE user_id = ?', [req.session.user.id], (err, results) => {
            if (err) throw err;
            res.render('profile', { user: req.session.user, photos: results });
        });
    } else {
        res.redirect('/');
    }
});

app.get('/search-photos', (req, res) => {
    const searchQuery = `%${req.query.query}%`;
    const userId = req.session.user.id;

    const sql = `
        SELECT filename FROM photos
        WHERE user_id = ? AND filename LIKE ?
        ORDER BY filename;
    `;

    connection.query(sql, [userId, searchQuery], (err, results) => {
        if (err) {
            console.error("Error during SQL query:", err);
            return res.status(500).send("Failed to retrieve photos due to database error");
        }

        if (results.length > 0) {
            res.render('profile', { user: req.session.user, photos: results});
        } else {
            res.render('profile', { user: req.session.user, photos: [], message: 'No photos found.' });
        }
    });
});


app.get('/register', (req, res) => {
    res.render('register');
});
  
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

