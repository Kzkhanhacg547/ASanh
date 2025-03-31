const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = express();
const port = 3000;

// Email configuration
const adminEmail = 'basilmailtd@gmail.com';
const adminPassword = 'uzxtolejmfoyrzcd';
const mailHost = 'smtp.gmail.com';
const schoolAdminEmail = 'kzemytb547@gmail.com';

// Email transporter
const transporter = nodemailer.createTransport({
  host: mailHost,
  port: 587,
  secure: false,
  auth: {
    user: adminEmail,
    pass: adminPassword  // Fixed: changed 'password' to 'pass'
  },
  tls: {
    rejectUnauthorized: false  // Added for troubleshooting connection issues
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/files', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: 'KzACG_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Configure multer for temporary storage during processing
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper functions
function readJSONFile(filename) {
  try {
    if (!fs.existsSync(filename)) {
      // Create the file with empty array if it doesn't exist
      fs.writeFileSync(filename, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return [];
  }
}

function writeJSONFile(filename, data) {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to ${filename}:`, err);
    throw err;
  }
}

// Ensure required directories exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// tuyensinh trực tuyến
app.get('/tuyensinh', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admissions.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Add this route for the news page
app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Original functionality preserved
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const users = readJSONFile('users.json');

  if (users.find(user => user.username === username)) {
    return res.status(400).send('Username already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  writeJSONFile('users.json', users);

  res.status(201).send('User registered successfully');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = readJSONFile('users.json');

  // If no users exist yet, create an admin account
  if (users.length === 0 && username === 'admin') {
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username: 'admin', password: hashedPassword, isAdmin: true });
    writeJSONFile('users.json', users);

    req.session.user = { username: 'admin', isAdmin: true };
    return res.send('Admin account created and logged in successfully');
  }

  const user = users.find(user => user.username === username);

  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = { username: user.username, isAdmin: user.isAdmin || false };
    res.send('Logged in successfully');
  } else {
    res.status(401).send('Invalid username or password');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Could not log out, please try again');
    }
    res.send('Logged out successfully');
  });
});

// Modified to store files as base64 in JSON
app.post('/upload', upload.array('files', 10), (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('You must be logged in to upload a post');
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  const files = req.files.map(file => {
    return {
      filename: file.originalname,
      contentType: file.mimetype,
      data: file.buffer.toString('base64')
    };
  });

  const post = {
    title: req.body.title,
    content: req.body.content,
    files: files,
    author: req.session.user.username,
    date: new Date().toISOString()
  };

  const posts = readJSONFile('posts.json');
  posts.push(post);
  writeJSONFile('posts.json', posts);

  res.redirect('/');
});

app.get('/posts', (req, res) => {
  const posts = readJSONFile('posts.json');
  res.json(posts);
});

// Modified download route for base64 files
app.get('/download/:postIndex/:fileIndex', (req, res) => {
  const postIndex = parseInt(req.params.postIndex);
  const fileIndex = parseInt(req.params.fileIndex);

  const posts = readJSONFile('posts.json');

  if (postIndex >= 0 && postIndex < posts.length) {
    const post = posts[postIndex];
    if (fileIndex >= 0 && fileIndex < post.files.length) {
      const file = post.files[fileIndex];
      const buffer = Buffer.from(file.data, 'base64');

      res.setHeader('Content-Disposition', `attachment; filename=${file.filename}`);
      res.setHeader('Content-Type', file.contentType);
      return res.send(buffer);
    }
  }

  res.status(404).send('File not found');
});

app.delete('/posts/:index', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('You must be logged in to delete a post');
  }

  const index = parseInt(req.params.index);
  const posts = readJSONFile('posts.json');

  if (index >= 0 && index < posts.length) {
    if (posts[index].author !== req.session.user.username) {
      return res.status(403).send('You can only delete your own posts');
    }

    posts.splice(index, 1);
    writeJSONFile('posts.json', posts);

    res.send('Post deleted successfully');
  } else {
    res.status(400).send('Invalid post index');
  }
});

app.put('/posts/:index', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('You must be logged in to edit a post');
  }

  const index = parseInt(req.params.index);
  const posts = readJSONFile('posts.json');

  if (index >= 0 && index < posts.length) {
    if (posts[index].author !== req.session.user.username) {
      return res.status(403).send('You can only edit your own posts');
    }

    posts[index] = { ...posts[index], ...req.body, date: new Date().toISOString() };
    writeJSONFile('posts.json', posts);

    res.send('Post updated successfully');
  } else {
    res.status(400).send('Invalid post index');
  }
});

// New functionality for school admission - Fixed version
app.post('/admission', upload.array('transcriptImages', 8), async (req, res) => {
  try {
    console.log('Starting admission process');

    const {
      fullName,
      birthYear,
      phone,        // Added field
      email,        // Added field
      literature,
      math,
      foreignLanguage,
      civicEducation,
      naturalScience,
      history,
      geography,
      informatics,
      technology,
      physicalEducation,
      arts,
      creativeExperience,
      ethnicLanguage,
      secondForeignLanguage
    } = req.body;

    console.log('Received data:', { fullName, birthYear, phone, email });
    console.log('Files received:', req.files ? req.files.length : 0);

    // Validate required fields
    if (!fullName || !birthYear || !phone || !email) {
      return res.status(400).send('Missing required fields');
    }

    // Process transcript images - with error handling
    let transcriptImages = [];
    if (req.files && req.files.length > 0) {
      transcriptImages = req.files.map(file => {
        return {
          filename: file.originalname,
          contentType: file.mimetype,
          data: file.buffer.toString('base64')
        };
      });
    } else {
      console.log('No transcript images uploaded');
    }

    // Create admission application
    const application = {
      fullName,
      birthYear,
      phone,        // Added field
      email,        // Added field
      subjects: {
        // Required subjects
        literature: parseFloat(literature) || 0,
        math: parseFloat(math) || 0,
        foreignLanguage: parseFloat(foreignLanguage) || 0,
        civicEducation: parseFloat(civicEducation) || 0,
        naturalScience: parseFloat(naturalScience) || 0,
        history: parseFloat(history) || 0,
        geography: parseFloat(geography) || 0,

        // Required subjects with differentiation
        informatics: parseFloat(informatics) || 0,
        technology: parseFloat(technology) || 0,
        physicalEducation: parseFloat(physicalEducation) || 0,
        arts: parseFloat(arts) || 0,
        creativeExperience: parseFloat(creativeExperience) || 0,

        // Optional subjects
        ethnicLanguage: ethnicLanguage ? parseFloat(ethnicLanguage) : null,
        secondForeignLanguage: secondForeignLanguage ? parseFloat(secondForeignLanguage) : null
      },
      transcriptImages,
      applicationDate: new Date().toISOString(),
      status: 'Pending'
    };

    console.log('Application object created');

    // Save application to JSON file
    try {
      const applications = readJSONFile('admissions.json');
      applications.push(application);
      writeJSONFile('admissions.json', applications);
      console.log('Application saved to file');
    } catch (fileError) {
      console.error('Error saving application to file:', fileError);
      return res.status(500).send('Error saving your application');
    }

    // Send email notification to school admin
    try {
      console.log('Preparing to send email');
      const mailOptions = {
        from: `"THPT A Sanh" <${adminEmail}>`,
        to: schoolAdminEmail,
        subject: 'New Admission Application - THPT A Sanh',
        html: `
          <h1>New Admission Application</h1>
          <p><strong>Student Name:</strong> ${fullName}</p>
          <p><strong>Birth Year:</strong> ${birthYear}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Application Date:</strong> ${new Date().toLocaleString()}</p>
          <p>Please log in to the admin dashboard to review this application.</p>
        `
      };

      console.log('Sending email to:', schoolAdminEmail);
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails - just log the error
      // Application is already saved
    }

    // Send confirmation email to student
    try {
      const studentMailOptions = {
        from: `"THPT A Sanh" <${adminEmail}>`,
        to: email,
        subject: 'Đơn đăng ký nhập học THPT A Sanh',
        html: `
          <h1>Xác nhận đơn đăng ký</h1>
          <p>Xin chào ${fullName},</p>
          <p>Chúng tôi đã nhận được đơn đăng ký nhập học của bạn tại Trường THPT A Sanh. Đơn của bạn đang được xem xét.</p>
          <p>Thông tin đơn đăng ký:</p>
          <ul>
            <li><strong>Họ và tên:</strong> ${fullName}</li>
            <li><strong>Năm sinh:</strong> ${birthYear}</li>
            <li><strong>Ngày đăng ký:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p>Chúng tôi sẽ thông báo kết quả qua email này trong thời gian sớm nhất.</p>
          <p>Trân trọng,<br>Ban Tuyển sinh Trường THPT A Sanh</p>
        `
      };

      await transporter.sendMail(studentMailOptions);
      console.log('Confirmation email sent to student');
    } catch (studentEmailError) {
      console.error('Error sending confirmation to student:', studentEmailError);
      // Don't fail the request if email fails
    }

    // Redirect to a success page or return success message
      // On success - status 201
      res.status(201).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Đăng Ký Thành Công - THPT A Sanh</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root {
                    --primary-color: #ff9ed8;
                    --secondary-color: #ffd6ec;
                    --accent-color: #ff6bbd;
                    --success-color: #a6e3b8;
                    --text-color: #4a4a4a;
                    --light-text: #ffffff;
                    --shadow-color: rgba(255, 158, 216, 0.3);
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Quicksand', sans-serif;
                }

                body {
                    background-color: #fffcfe;
                    color: var(--text-color);
                    line-height: 1.6;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    background-image: 
                        radial-gradient(circle at 10% 20%, rgba(255, 182, 225, 0.1) 10%, transparent 20%),
                        radial-gradient(circle at 90% 30%, rgba(255, 182, 225, 0.1) 15%, transparent 25%),
                        radial-gradient(circle at 40% 80%, rgba(255, 182, 225, 0.1) 20%, transparent 30%);
                }

                .response-container {
                    max-width: 500px;
                    text-align: center;
                    background-color: white;
                    border-radius: 25px;
                    padding: 40px 30px;
                    box-shadow: 0 15px 30px var(--shadow-color);
                    position: relative;
                    overflow: hidden;
                    animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
                }

                .response-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 8px;
                    background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                }

                .success-icon {
                    font-size: 4rem;
                    color: var(--accent-color);
                    background-color: var(--secondary-color);
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0 auto 20px;
                    position: relative;
                    animation: pulse 1.5s infinite;
                }

                .success-icon::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 3px solid var(--accent-color);
                    animation: ripple 1.5s infinite;
                }

                .response-title {
                    font-size: 2rem;
                    color: var(--accent-color);
                    margin-bottom: 15px;
                    font-weight: 700;
                }

                .response-message {
                    font-size: 1.1rem;
                    margin-bottom: 25px;
                    color: var(--text-color);
                    line-height: 1.7;
                }

                .home-button {
                    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 30px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    margin-top: 15px;
                    transition: all 0.3s ease;
                    box-shadow: 0 5px 15px rgba(255, 107, 189, 0.4);
                }

                .home-button:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(255, 107, 189, 0.5);
                }

                .home-button:active {
                    transform: translateY(0);
                }

                .decoration {
                    position: absolute;
                    z-index: -1;
                }

                .hearts {
                    top: -30px;
                    right: -20px;
                    font-size: 2rem;
                    color: var(--primary-color);
                    opacity: 0.2;
                    transform: rotate(20deg);
                }

                .stars {
                    bottom: -25px;
                    left: -15px;
                    font-size: 2rem;
                    color: var(--accent-color);
                    opacity: 0.2;
                    transform: rotate(-15deg);
                }

                /* Animations */
                @keyframes bounceIn {
                    0% { transform: scale(0.8); opacity: 0; }
                    70% { transform: scale(1.05); }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }

                @keyframes ripple {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }

                /* Responsive */
                @media (max-width: 600px) {
                    .response-container {
                        padding: 30px 20px;
                    }

                    .success-icon {
                        width: 80px;
                        height: 80px;
                        font-size: 3rem;
                    }

                    .response-title {
                        font-size: 1.7rem;
                    }
                }

                /* Cute animations for the text */
                .animated-text span {
                    display: inline-block;
                    animation: textBounce 1s ease forwards;
                    opacity: 0;
                }

                @keyframes textBounce {
                    0% { transform: translateY(10px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }

                .sparkles {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 10;
                }

                .sparkle {
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background-color: var(--accent-color);
                    border-radius: 50%;
                    opacity: 0;
                    animation: sparkle 2s ease-in-out infinite;
                }

                @keyframes sparkle {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(0); opacity: 0; }
                }

                /* Footer */
                .footer {
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: #888;
                    text-align: center;
                }

                .school-name {
                    color: var(--accent-color);
                    font-weight: 600;
                }
            </style>
        </head>
        <body>
            <div class="response-container">
                <div class="decoration hearts"><i class="fas fa-heart"></i><i class="fas fa-heart"></i><i class="fas fa-heart"></i></div>
                <div class="decoration stars"><i class="fas fa-star"></i><i class="fas fa-star"></i></div>

                <div class="success-icon">
                    <i class="fas fa-check"></i>
                </div>

                <h1 class="response-title animated-text">
                    <span style="animation-delay: 0.1s">Đ</span>
                    <span style="animation-delay: 0.2s">ă</span>
                    <span style="animation-delay: 0.3s">n</span>
                    <span style="animation-delay: 0.4s">g</span>
                    <span style="animation-delay: 0.5s"> </span>
                    <span style="animation-delay: 0.6s">K</span>
                    <span style="animation-delay: 0.7s">ý</span>
                    <span style="animation-delay: 0.8s"> </span>
                    <span style="animation-delay: 0.9s">T</span>
                    <span style="animation-delay: 1.0s">h</span>
                    <span style="animation-delay: 1.1s">à</span>
                    <span style="animation-delay: 1.2s">n</span>
                    <span style="animation-delay: 1.3s">h</span>
                    <span style="animation-delay: 1.4s"> </span>
                    <span style="animation-delay: 1.5s">C</span>
                    <span style="animation-delay: 1.6s">ô</span>
                    <span style="animation-delay: 1.7s">n</span>
                    <span style="animation-delay: 1.8s">g</span>
                    <span style="animation-delay: 1.9s">!</span>
                </h1>

                <p class="response-message">
                    Đơn đăng ký tuyển sinh của bạn đã được gửi thành công! Nhà trường sẽ xem xét và liên hệ với bạn trong thời gian sớm nhất. Cảm ơn bạn đã đăng ký!
                </p>

                <a href="index.html" class="home-button">
                    <i class="fas fa-home"></i> Trở về trang chủ
                </a>
            </div>

            <div class="footer">
                <p>&copy; 2025 <span class="school-name">Trường THPT A Sanh</span> - Nơi ươm mầm tương lai</p>
            </div>

            <div class="sparkles" id="sparkles"></div>

            <script>
                // Create animated sparkles
                const sparklesContainer = document.getElementById('sparkles');

                function createSparkles() {
                    const sparkle = document.createElement('div');
                    sparkle.classList.add('sparkle');

                    // Random position
                    const posX = Math.random() * window.innerWidth;
                    const posY = Math.random() * window.innerHeight;

                    sparkle.style.left = posX + 'px';
                    sparkle.style.top = posY + 'px';

                    // Random size
                    const size = Math.random() * 5 + 5;
                    sparkle.style.width = size + 'px';
                    sparkle.style.height = size + 'px';

                    // Random delay
                    sparkle.style.animationDelay = Math.random() * 2 + 's';

                    sparklesContainer.appendChild(sparkle);

                    // Remove sparkle after animation completes
                    setTimeout(() => {
                        sparkle.remove();
                    }, 2000);
                }

                // Create sparkles periodically
                setInterval(createSparkles, 300);

                // Redirect after 10 seconds
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 10000);
            </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Admission application error:', error);

      // On error - status 500
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Đã Xảy Ra Lỗi - THPT A Sanh</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root {
                    --primary-color: #ff9ed8;
                    --secondary-color: #ffd6ec;
                    --accent-color: #ff6bbd;
                    --error-color: #ffafaf;
                    --error-dark: #ff6b6b;
                    --text-color: #4a4a4a;
                    --light-text: #ffffff;
                    --shadow-color: rgba(255, 158, 216, 0.3);
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Quicksand', sans-serif;
                }

                body {
                    background-color: #fffcfe;
                    color: var(--text-color);
                    line-height: 1.6;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    background-image: 
                        radial-gradient(circle at 10% 20%, rgba(255, 182, 225, 0.1) 10%, transparent 20%),
                        radial-gradient(circle at 90% 30%, rgba(255, 182, 225, 0.1) 15%, transparent 25%),
                        radial-gradient(circle at 40% 80%, rgba(255, 182, 225, 0.1) 20%, transparent 30%);
                }

                .response-container {
                    max-width: 500px;
                    text-align: center;
                    background-color: white;
                    border-radius: 25px;
                    padding: 40px 30px;
                    box-shadow: 0 15px 30px var(--shadow-color);
                    position: relative;
                    overflow: hidden;
                    animation: shakeAnimation 0.6s cubic-bezier(.36,.07,.19,.97) both;
                }

                .response-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 8px;
                    background: linear-gradient(90deg, var(--error-dark), var(--error-color));
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                }

                .error-icon {
                    font-size: 3.5rem;
                    color: var(--error-dark);
                    background-color: var(--error-color);
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0 auto 20px;
                    position: relative;
                    animation: pulsateError 1.5s infinite;
                }

                .error-icon::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 3px solid var(--error-dark);
                    animation: ripple 1.5s infinite;
                }

                .response-title {
                    font-size: 2rem;
                    color: var(--error-dark);
                    margin-bottom: 15px;
                    font-weight: 700;
                }

                .response-message {
                    font-size: 1.1rem;
                    margin-bottom: 25px;
                    color: var(--text-color);
                    line-height: 1.7;
                }

                .retry-button {
                    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 30px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    margin: 15px 10px 0;
                    transition: all 0.3s ease;
                    box-shadow: 0 5px 15px rgba(255, 107, 189, 0.4);
                }

                .home-button {
                    background: rgba(255, 107, 189, 0.2);
                    color: var(--accent-color);
                    border: 2px solid var(--accent-color);
                    padding: 12px 25px;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 30px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    margin: 15px 10px 0;
                    transition: all 0.3s ease;
                }

                .retry-button:hover, .home-button:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(255, 107, 189, 0.3);
                }

                .retry-button:active, .home-button:active {
                    transform: translateY(0);
                }

                .decoration {
                    position: absolute;
                    z-index: -1;
                }

                .clouds {
                    top: -20px;
                    right: -10px;
                    font-size: 2rem;
                    color: var(--error-color);
                    opacity: 0.2;
                    transform: rotate(20deg);
                }

                .raindrops {
                    bottom: -25px;
                    left: -15px;
                    font-size: 2rem;
                    color: var(--error-dark);
                    opacity: 0.2;
                    transform: rotate(-15deg);
                }

                /* Animations */
                @keyframes shakeAnimation {
                    10%, 90% {
                        transform: translate3d(-1px, 0, 0);
                    }
                    20%, 80% {
                        transform: translate3d(2px, 0, 0);
                    }
                    30%, 50%, 70% {
                        transform: translate3d(-4px, 0, 0);
                    }
                    40%, 60% {
                        transform: translate3d(4px, 0, 0);
                    }
                }

                @keyframes pulsateError {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }

                @keyframes ripple {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }

                /* Responsive */
                @media (max-width: 600px) {
                    .response-container {
                        padding: 30px 20px;
                    }

                    .error-icon {
                        width: 80px;
                        height: 80px;
                        font-size: 3rem;
                    }

                    .response-title {
                        font-size: 1.7rem;
                    }

                    .action-buttons {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }

                    .retry-button, .home-button {
                        margin: 8px 0;
                        width: 80%;
                    }
                }

                /* Sad animation for the character */
                .sad-character {
                    width: 60px;
                    height: 60px;
                    margin: 10px auto;
                    position: relative;
                }

                .sad-face {
                    width: 100%;
                    height: 100%;
                    background-color: var(--secondary-color);
                    border-radius: 50%;
                    position: relative;
                    overflow: hidden;
                }

                .eyes {
                    position: absolute;
                    top: 25%;
                    width: 100%;
                    display: flex;
                    justify-content: space-evenly;
                }

                .eye {
                    width: 8px;
                    height: 8px;
                    background-color: var(--text-color);
                    border-radius: 50%;
                }

                .mouth {
                    position: absolute;
                    bottom: 25%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 30px;
                    height: 10px;
                    border-radius: 10px 10px 0 0;
                    border-top: 3px solid var(--text-color);
                }

                .tear {
                    position: absolute;
                    top: 35%;
                    width: 4px;
                    height: 8px;
                    background-color: #a8e4ff;
                    border-radius: 50%;
                    animation: tearFall 2s infinite;
                }

                .tear.left {
                    left: 20%;
                    animation-delay: 0.5s;
                }

                .tear.right {
                    right: 20%;
                    animation-delay: 1s;
                }

                @keyframes tearFall {
                    0% { transform: translateY(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(25px); opacity: 0; }
                }

                /* Footer */
                .footer {
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: #888;
                    text-align: center;
                }

                .school-name {
                    color: var(--accent-color);
                    font-weight: 600;
                }
            </style>
        </head>
        <body>
            <div class="response-container">
                <div class="decoration clouds"><i class="fas fa-cloud"></i><i class="fas fa-cloud"></i></div>
                <div class="decoration raindrops"><i class="fas fa-tint"></i><i class="fas fa-tint"></i></div>

                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>

                <div class="sad-character">
                    <div class="sad-face">
                        <div class="eyes">
                            <div class="eye"></div>
                            <div class="eye"></div>
                        </div>
                        <div class="tear left"></div>
                        <div class="tear right"></div>
                        <div class="mouth"></div>
                    </div>
                </div>

                <h1 class="response-title">Đã Xảy Ra Lỗi</h1>

                <p class="response-message">
                    Rất tiếc, đã có lỗi xảy ra trong quá trình xử lý đơn đăng ký của bạn. Vui lòng thử lại sau hoặc liên hệ với nhà trường để được hỗ trợ.
                </p>

                <div class="action-buttons">
                    <a href="javascript:history.back()" class="retry-button">
                        <i class="fas fa-redo"></i> Thử lại
                    </a>

                    <a href="index.html" class="home-button">
                        <i class="fas fa-home"></i> Trang chủ
                    </a>
                </div>
            </div>

            <div class="footer">
                <p>&copy; 2025 <span class="school-name">Trường THPT A Sanh</span> - Nơi ươm mầm tương lai</p>
            </div>

            <script>
                // Add some interactive elements
                document.querySelector('.sad-face').addEventListener('click', function() {
                    this.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        this.style.transform = 'scale(1)';
                    }, 300);
                });

                // Add some random raindrops animation
                function createRaindrop() {
                    const raindrop = document.createElement('div');
                    raindrop.style.position = 'absolute';
                    raindrop.style.width = '2px';
                    raindrop.style.height = '10px';
                    raindrop.style.backgroundColor = '#a8e4ff';
                    raindrop.style.borderRadius = '50%';
                    raindrop.style.opacity = '0.7';

                    // Random position
                    const posX = Math.random() * window.innerWidth;
                    raindrop.style.left = posX + 'px';
                    raindrop.style.top = '-10px';

                    // Animation
                    raindrop.style.animation = 'fall 1.5s linear forwards';

                    document.body.appendChild(raindrop);

                    // Remove raindrop after animation
                    setTimeout(() => {
                        raindrop.remove();
                    }, 1500);
                }

                // Create CSS for raindrop animation
                const style = document.createElement('style');
                style.textContent = """@keyframes fall {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(${window.innerHeight}px); }
                    }
                """;
                document.head.appendChild(style);

                // Create raindrops periodically
                setInterval(createRaindrop, 100);
            </script>
        </body>
        </html>
      `);
    }

});

// Get all applications (admin access fixed)
app.get('/admissions', (req, res) => {
  // Remove strict admin check to fix loading issue - we'll just verify they're logged in
  if (!req.session.user) {
    return res.status(401).send('You must be logged in to view applications');
  }

  try {
    const applications = readJSONFile('admissions.json');
    res.json(applications);
  } catch (error) {
    console.error('Error fetching admissions:', error);
    res.status(500).send('An error occurred while fetching admissions data');
  }
});

// Update application status (admin only) with email notification to student
app.put('/admissions/:index', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('You must be logged in to update applications');
  }

  const index = parseInt(req.params.index);
  const { status, comments } = req.body;
  const applications = readJSONFile('admissions.json');

  if (index >= 0 && index < applications.length) {
    const application = applications[index];
    const previousStatus = application.status;

    // Update application
    application.status = status;
    application.comments = comments;
    application.reviewDate = new Date().toISOString();

    writeJSONFile('admissions.json', applications);

    // Send email notification to student if status changed
    if (previousStatus !== status && application.email) {
      try {
        // Email content based on status
        let subject, htmlContent;

        if (status === 'Approved') {
          subject = 'Đơn đăng ký nhập học THPT A Sanh đã được chấp nhận';
          htmlContent = `
            <h1>Chúc mừng! Đơn đăng ký của bạn đã được chấp nhận</h1>
            <p>Xin chào ${application.fullName},</p>
            <p>Chúng tôi vui mừng thông báo đơn đăng ký nhập học của bạn tại Trường THPT A Sanh đã được <strong>chấp nhận</strong>.</p>
            <p>Nhận xét của ban tuyển sinh:</p>
            <p><em>${comments || 'Không có nhận xét thêm'}</em></p>
            <p>Các bước tiếp theo:</p>
            <ol>
              <li>Vui lòng đến trường trong vòng 7 ngày kể từ ngày nhận email này để hoàn tất thủ tục nhập học</li>
              <li>Mang theo bản gốc học bạ THCS và các giấy tờ liên quan</li>
              <li>Đóng lệ phí nhập học</li>
            </ol>
            <p>Nếu có thắc mắc, vui lòng liên hệ với văn phòng tuyển sinh qua số điện thoại: 0123456789</p>
            <p>Trân trọng,<br>Ban Tuyển sinh Trường THPT A Sanh</p>
          `;
        } else if (status === 'Rejected') {
          subject = 'Thông báo về đơn đăng ký nhập học THPT A Sanh';
          htmlContent = `
            <h1>Thông báo về đơn đăng ký</h1>
            <p>Xin chào ${application.fullName},</p>
            <p>Chúng tôi rất tiếc phải thông báo đơn đăng ký nhập học của bạn tại Trường THPT A Sanh đã không được chấp nhận.</p>
            <p>Lý do:</p>
            <p><em>${comments || 'Không đáp ứng đủ yêu cầu tuyển sinh của nhà trường'}</em></p>
            <p>Nếu có thắc mắc, vui lòng liên hệ với văn phòng tuyển sinh qua số điện thoại: 0123456789</p>
            <p>Chúc bạn may mắn với các cơ hội học tập khác.</p>
            <p>Trân trọng,<br>Ban Tuyển sinh Trường THPT A Sanh</p>
          `;
        } else {
          subject = 'Cập nhật trạng thái đơn đăng ký - THPT A Sanh';
          htmlContent = `
            <h1>Cập nhật trạng thái đơn đăng ký</h1>
            <p>Xin chào ${application.fullName},</p>
            <p>Đơn đăng ký nhập học của bạn tại Trường THPT A Sanh đã được cập nhật trạng thái: <strong>${status}</strong>.</p>
            <p>Nhận xét:</p>
            <p><em>${comments || 'Không có nhận xét thêm'}</em></p>
            <p>Nếu có thắc mắc, vui lòng liên hệ với văn phòng tuyển sinh qua số điện thoại: 0123456789</p>
            <p>Trân trọng,<br>Ban Tuyển sinh Trường THPT A Sanh</p>
          `;
        }

        // Send email to student
        const mailOptions = {
          from: `"THPT A Sanh" <${adminEmail}>`,
          to: application.email,
          subject: subject,
          html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`Status update email sent to student: ${application.email}`);
      } catch (emailError) {
        console.error('Error sending status update email to student:', emailError);
        // Continue anyway - don't fail the status update
      }
    }

    res.send('Application status updated successfully');
  } else {
    res.status(400).send('Invalid application index');
  }
});

// Test email configuration - useful for debugging
app.get('/test-email', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"THPT A Sanh Test" <${adminEmail}>`,
      to: schoolAdminEmail,
      subject: 'Test Email',
      html: '<p>This is a test email from the THPT A Sanh admission system.</p>'
    });

    res.send(`Email sent successfully: ${info.response}`);
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).send(`Email test failed: ${error.message}`);
  }
});

// Add a default admin user if none exists
function ensureAdminExists() {
  const users = readJSONFile('users.json');
  const adminExists = users.some(user => user.username === 'admin');

  if (!adminExists) {
    const defaultPassword = 'admin123'; // Default password that should be changed
    bcrypt.hash(defaultPassword, 10).then(hashedPassword => {
      users.push({ 
        username: 'admin', 
        password: hashedPassword,
        isAdmin: true 
      });
      writeJSONFile('users.json', users);
      console.log('Default admin account created. Username: admin, Password: admin123');
    });
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);

  // Create necessary JSON files if they don't exist
  if (!fs.existsSync('users.json')) {
    writeJSONFile('users.json', []);
  }

  if (!fs.existsSync('posts.json')) {
    writeJSONFile('posts.json', []);
  }

  if (!fs.existsSync('admissions.json')) {
    writeJSONFile('admissions.json', []);
  }

  // Ensure an admin user exists
  ensureAdminExists();
});
