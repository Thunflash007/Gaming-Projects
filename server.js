const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
// const session = require('express-session'); // Session-Paket importieren (entfernt)
const app = express();
const port = 3001;

let messages = [];
let users = []; // Hinzufügen eines Arrays zur Speicherung von Benutzern

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// app.use(session({ // Session-Konfiguration (entfernt)
//     secret: 'geheimnis', // Geheimnis für die Verschlüsselung der Session
//     resave: false, // Session wird nur gespeichert, wenn sie sich ändert
//     saveUninitialized: true // Neue, aber unveränderte Sessions werden gespeichert
// }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'website.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/admin', (req, res) => {
    const { password } = req.body;
    if (password === '2q') {
        // req.session.isAdmin = true; // Setze Admin-Session (entfernt)
        res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.post('/register', (req, res) => {
    const { email, username, password } = req.body;
    const emailExists = users.some(user => user.email === email);
    const usernameExists = users.some(user => user.username === username);

    if (emailExists) {
        res.json({ error: 'Diese E-Mail ist bereits in Nutzung.' });
    } else if (usernameExists) {
        res.json({ error: 'Dieser Benutzername ist bereits in Nutzung.' });
    } else {
        users.push({ email, username, password });
        res.json({ success: true });
    }
});

app.get('/messages', (req, res) => {
    res.json(messages);
});

app.get('/users', (req, res) => {
    res.json(users);
});

// Fehler-Middleware hinzufügen
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, 'error.html'));
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
