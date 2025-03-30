// Authentication related event listeners
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const logoutButton = document.getElementById('logoutButton');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const loginFormContent = document.getElementById('loginFormContent');
const registerFormContent = document.getElementById('registerFormContent');
const forgotPasswordFormContent = document.getElementById('forgotPasswordFormContent');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');
const backToLoginFromReset = document.getElementById('backToLoginFromReset');
const loadingOverlay = document.getElementById('loadingOverlay');

// Show login form
loginButton.addEventListener('click', () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    forgotPasswordForm.style.display = 'none';
});

// Show register form
registerButton.addEventListener('click', () => {
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    forgotPasswordForm.style.display = 'none';
});

// Switch between forms
switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// Show forgot password form
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    forgotPasswordForm.style.display = 'block';
});

backToLoginFromReset.addEventListener('click', (e) => {
    e.preventDefault();
    forgotPasswordForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// Close forms when clicking the close button
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        forgotPasswordForm.style.display = 'none';

        // Reset forms
        resetRegistrationForm();
    });
});

// Handle login form submission
loginFormContent.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    toggleLoading(true);
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = username;
            showNotification('Đăng nhập thành công', 'success');
            toggleAuthButtons(true);
            fetchPosts();
            // Show upload form if admin or teacher
            if (username === 'admin' || username.startsWith('teacher')) {
                uploadForm.classList.remove('hidden');
            }
            loginForm.style.display = 'none';
        } else {
            showNotification(await response.text(), 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Đăng nhập thất bại. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Request verification code for registration
document.getElementById('requestVerificationBtn').addEventListener('click', async () => {
    const fullName = document.getElementById('registerFullName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

    // Validate inputs
    if (!fullName) {
        showNotification('Vui lòng nhập họ và tên', 'error');
        return;
    }

    if (!phone || !/^\d{10}$/.test(phone)) {
        showNotification('Vui lòng nhập số điện thoại hợp lệ (10 số)', 'error');
        return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Vui lòng nhập email hợp lệ', 'error');
        return;
    }

    if (!username || username.length < 5 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
        showNotification('Tên đăng nhập phải từ 5-20 ký tự, chỉ gồm chữ cái và số', 'error');
        return;
    }

    if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        showNotification('Mật khẩu phải ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Mật khẩu xác nhận không khớp', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/request-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, phone, email, username, password })
        });

        if (response.ok) {
            showNotification('Mã xác nhận đã được gửi đến email của bạn', 'success');
            document.getElementById('verificationCodeContainer').classList.remove('hidden');
            document.getElementById('requestVerificationBtn').classList.add('hidden');
            document.getElementById('completeRegistrationBtn').classList.remove('hidden');
            startVerificationCodeTimer();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Lỗi gửi mã xác nhận', 'error');
        }
    } catch (error) {
        console.error('Verification request error:', error);
        showNotification('Lỗi gửi mã xác nhận. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Resend verification code
document.getElementById('resendCodeBtn').addEventListener('click', async () => {
    const email = document.getElementById('registerEmail').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Email không hợp lệ', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            showNotification('Mã xác nhận mới đã được gửi đến email của bạn', 'success');
            startVerificationCodeTimer();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Lỗi gửi lại mã xác nhận', 'error');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        showNotification('Lỗi gửi lại mã xác nhận. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Handle complete registration
registerFormContent.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = document.getElementById('registerFullName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const verificationCode = document.getElementById('verificationCode').value.trim();

    if (!verificationCode) {
        showNotification('Vui lòng nhập mã xác nhận', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                fullName, 
                phone, 
                email, 
                username, 
                password, 
                verificationCode 
            })
        });

        if (response.ok) {
            showNotification('Đăng ký tài khoản thành công! Vui lòng đăng nhập.', 'success');
            resetRegistrationForm();
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Đăng ký thất bại', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Đăng ký thất bại. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Request password reset code
document.getElementById('requestResetCodeBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Vui lòng nhập email hợp lệ', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/request-password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            showNotification('Mã xác nhận đã được gửi đến email của bạn', 'success');
            document.getElementById('resetCodeContainer').classList.remove('hidden');
            document.getElementById('requestResetCodeBtn').classList.add('hidden');
            document.getElementById('verifyResetCodeBtn').classList.remove('hidden');
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Lỗi gửi mã xác nhận', 'error');
        }
    } catch (error) {
        console.error('Reset code request error:', error);
        showNotification('Lỗi gửi mã xác nhận. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Verify reset code
document.getElementById('verifyResetCodeBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const resetCode = document.getElementById('resetCode').value.trim();

    if (!resetCode) {
        showNotification('Vui lòng nhập mã xác nhận', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/verify-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetCode })
        });

        if (response.ok) {
            showNotification('Mã xác nhận hợp lệ. Vui lòng đặt lại mật khẩu.', 'success');
            document.getElementById('newPasswordContainer').classList.remove('hidden');
            document.getElementById('confirmNewPasswordContainer').classList.remove('hidden');
            document.getElementById('verifyResetCodeBtn').classList.add('hidden');
            document.getElementById('resetPasswordBtn').classList.remove('hidden');
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Mã xác nhận không hợp lệ', 'error');
        }
    } catch (error) {
        console.error('Verify reset code error:', error);
        showNotification('Lỗi xác thực mã. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Reset password
document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const resetCode = document.getElementById('resetCode').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        showNotification('Mật khẩu mới phải ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số', 'error');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showNotification('Mật khẩu xác nhận không khớp', 'error');
        return;
    }

    toggleLoading(true);
    try {
        const response = await fetch('/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                resetCode, 
                newPassword 
            })
        });

        if (response.ok) {
            showNotification('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', 'success');
            resetPasswordForm();
            forgotPasswordForm.style.display = 'none';
            loginForm.style.display = 'block';
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Đặt lại mật khẩu thất bại', 'error');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showNotification('Lỗi đặt lại mật khẩu. Vui lòng thử lại.', 'error');
    } finally {
        toggleLoading(false);
    }
});

// Verification code timer
function startVerificationCodeTimer() {
    const resendButton = document.getElementById('resendCodeBtn');
    let timeLeft = 60;
    resendButton.disabled = true;
    resendButton.textContent = `Gửi lại (${timeLeft}s)`;

    const timer = setInterval(() => {
        timeLeft--;
        resendButton.textContent = `Gửi lại (${timeLeft}s)`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            resendButton.disabled = false;
            resendButton.textContent = 'Gửi lại';
        }
    }, 1000);
}

// Reset registration form
function resetRegistrationForm() {
    document.getElementById('registerFormContent').reset();
    document.getElementById('verificationCodeContainer').classList.add('hidden');
    document.getElementById('requestVerificationBtn').classList.remove('hidden');
    document.getElementById('completeRegistrationBtn').classList.add('hidden');
}

// Reset password form
function resetPasswordForm() {
    document.getElementById('forgotPasswordFormContent').reset();
    document.getElementById('resetCodeContainer').classList.add('hidden');
    document.getElementById('newPasswordContainer').classList.add('hidden');
    document.getElementById('confirmNewPasswordContainer').classList.add('hidden');
    document.getElementById('requestResetCodeBtn').classList.remove('hidden');
    document.getElementById('verifyResetCodeBtn').classList.add('hidden');
    document.getElementById('resetPasswordBtn').classList.add('hidden');
}