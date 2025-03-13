const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 3001;

let messages = [];
let users = []; // Hinzufügen eines Arrays zur Speicherung von Benutzern

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'website.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/admin', (req, res) => {
    const { password } = req.body;
    if (password === '2q') {
        res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
    } else {
        res.redirect('/');
    }
});

// Entfernen der Registrierungs-Routen
// app.get('/register', (req, res) => {
//     res.sendFile(path.join(__dirname, 'register.html'));
// });

// app.post('/register', (req, res) => {
//     const { email, username, password } = req.body;
//     users.push({ email, username, password });
//     res.redirect('/');
// });

app.get('/messages', (req, res) => {
    res.json(messages);
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
