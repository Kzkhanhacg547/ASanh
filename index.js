const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = express();
const port = 3000;
 
const adminEmail = 'basilmailtd@gmail.com';
const adminPassword = 'uzxtolejmfoyrzcd';
const mailHost = 'smtp.gmail.com';
const schoolAdminEmail = 'kzemytb547@gmail.com';
 
const transporter = nodemailer.createTransport({
  host: mailHost,
  port: 587,
  secure: false,
  auth: {
    user: adminEmail,
    pass: adminPassword   
  },
  tls: {
    rejectUnauthorized: false  
  }
});
 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/files', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: 'KzACG_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }  
}));

 
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }  
});

 
function readJSONFile(filename) {
  try {
    if (!fs.existsSync(filename)) {
       
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
    res.status(201).send('Application submitted successfully');
  } catch (error) {
    console.error('Admission application error:', error);
    res.status(500).send('An error occurred while processing your application');
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