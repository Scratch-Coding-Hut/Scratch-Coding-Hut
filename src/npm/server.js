const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const wikisFilePath = path.join(__dirname, 'wikis.json');

// Load the wikis from the file
const loadWikis = () => {
  if (fs.existsSync(wikisFilePath)) {
    const data = fs.readFileSync(wikisFilePath, 'utf-8');
    return JSON.parse(data);
  } else {
    return [];
  }
};

// Save the wikis to the file
const saveWikis = (wikis) => {
  fs.writeFileSync(wikisFilePath, JSON.stringify(wikis, null, 2), 'utf-8');
};

// In-memory storage for wikis (loaded from file)
let wikis = loadWikis();

app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Serve HTML page for a specific wiki title
app.get('/wiki/:title', (req, res) => {
  const { title } = req.params;
  const wiki = wikis.find(w => w.title.toLowerCase() === title.toLowerCase());

  if (!wiki) {
    return res.status(404).send('Wiki not found');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${wiki.title} - Wiki</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background: #fff4f4; color: #333; text-align: center; }
        .navbar { display: flex; justify-content: center; align-items: center; background: #ff4d4d; padding: 15px 20px; border-radius: 10px; gap: 15px; }
        .navbar a { color: white; text-decoration: none; font-size: 1.2rem; padding: 10px 15px; border-radius: 5px; transition: background 0.3s; }
        .navbar a:hover { background: #ff1a1a; }
        .wiki-content { max-width: 1000px; margin: 40px auto; background: #ffe6e6; padding: 40px; border-radius: 10px; text-align: left; }
        .wiki-content h2 { color: #e60000; font-size: 2.5rem; margin-bottom: 20px; text-align: center; }
        .wiki-content p { font-size: 1.5rem; color: #333; line-height: 1.6; }
        .comment-section { margin-top: 40px; }
        .comment { background: #fff; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .comment-author { font-weight: bold; }
        .comment-content { font-size: 1rem; margin-top: 5px; }
        .comment-reply { font-size: 0.9rem; color: #888; margin-left: 20px; }
        .comment-form { margin-top: 20px; text-align: left; }
        .comment-input { width: 100%; padding: 10px; margin-top: 10px; font-size: 1rem; border: 1px solid #ccc; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="navbar">
        <a href="scratch-coding-hut.github.io/">Home</a>
        <a href="scratch-coding-hut.github.io/Wiki/sitemaplinks.html">Create Wiki</a>
        <a href="scratch-coding-hut.github.io/Wiki/sitemaplinks.html">Wiki List</a>
      </div>
      <div class="wiki-content">
        <h2>${wiki.title}</h2>
        <p>${wiki.content}</p>
        <small id="wiki-owner">${wiki.owner}</small>
      </div>

      <div class="comment-section">
        <h3>Comments</h3>
        ${wiki.comments.slice(-7).map(comment => `
          <div class="comment" id="comment-${comment.id}">
            <div class="comment-author">${comment.author} <small>(${new Date(comment.createdAt).toLocaleString()})</small></div>
            <div class="comment-content">${comment.content}</div>
            ${comment.replies.length > 0 ? comment.replies.map(reply => `
              <div class="comment-reply">
                <strong>${reply.author}</strong>: ${reply.content} <small>(${new Date(reply.createdAt).toLocaleString()})</small>
              </div>
            `).join('') : ''}
          </div>
        `).join('')}
      </div>

      <div class="comment-form">
        <h3>Add a Comment</h3>
        <textarea class="comment-input" id="comment-content" placeholder="Write your comment..." rows="4"></textarea>
        <button onclick="submitComment()">Submit</button>
      </div>

      <script>
        function submitComment() {
          const content = document.getElementById('comment-content').value;
          fetch('https://api.ipify.org?format=json')
           .then(response => response.json())
           .then(data => {
            const ip = data.ip;
            // Use the IP as needed
            console.log(ip); 
          });
          const urlParams = new URLSearchParams(window.location.search);
          const user = atob(urlParams.get('user')) || ip;

          if (!content.trim()) {
            alert('Comment content cannot be empty');
            return;
          }

          fetch('/api/wikis/${wiki.id}/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: btoa(user), content: content })
          })
          .then(response => response.json())
          .then(comment => {
            // Append new comment to the comment section
            const commentSection = document.querySelector('.comment-section');
            commentSection.innerHTML += \`
              <div class="comment" id="comment-${comment.id}">
                <div class="comment-author">${comment.author}</div>
                <div class="comment-content">${comment.content}</div>
              </div>
            \`;
          })
          .catch(error => console.error('Error adding comment:', error));
        }
      </script>
    </body>
    </html>
  `);
});

// API: Get wiki details (including comments)
app.get('/api/wikis/:id', (req, res) => {
  const { id } = req.params;
  const wiki = wikis.find(w => w.id === parseInt(id));

  if (!wiki) {
    return res.status(404).json({ error: 'Wiki not found' });
  }

  // Return the wiki details including comments
  res.json(wiki);
});

// API: Add a comment to a specific wiki
app.post('/api/wikis/:id/comments', (req, res) => {
  const { id } = req.params;
  const { user, content, replyTo } = req.body;

  const wiki = wikis.find(w => w.id === parseInt(id));
  if (!wiki) {
    return res.status(404).json({ error: 'Wiki not found' });
  }

  const username = atob(user); // Decode the username

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const newComment = {
    id: Date.now(), // Use timestamp for unique ID
    author: username,
    content: content,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deleted: false,
    replies: [],
  };

  // If it's a reply, add to the appropriate parent comment's replies
  if (replyTo) {
    const parentComment = wiki.comments.find(comment => comment.id === replyTo);
    if (parentComment) {
      parentComment.replies.push(newComment);
    } else {
      return res.status(404).json({ error: 'Reply target not found' });
    }
  } else {
    wiki.comments.push(newComment);
  }

  saveWikis(wikis);
  res.status(201).json(newComment);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
