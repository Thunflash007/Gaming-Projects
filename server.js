const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const port = 3001;

let messages = [];

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

// Entfernen der Kontakt-Routen
// app.get('/contact', (req, res) => {
//     res.sendFile(path.join(__dirname, 'contact.html'));
// });

// app.post('/contact', (req, res) => {
//     const { name, email, phone, message } = req.body;
//     messages.push({ name, email, phone, message });
//     res.redirect('/');
// });

app.get('/messages', (req, res) => {
    res.json(messages);
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
