<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    // Not logged in, redirect to login page
    header('Location: login.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --background-dark: #0B1215;    
            --background-darker: #080E11;   
            --highlight: #088D95;           
            --highlight-soft: #0DA6AE;     
            --text-primary: #E0E0E0;       
            --text-secondary: #A0A0A0;      
            --border-color: #1E2A33;       
            --shadow-light: rgba(8, 141, 149, 0.2);
            --shadow-medium: rgba(0, 0, 0, 0.3);
            --border-radius: 12px;
            --transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
            background: var(--background-dark);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
        }

        .sidebar {
            width: 250px;
            background: var(--background-darker);
            border-right: 1px solid var(--border-color);
            padding: 20px;
            display: flex;
            flex-direction: column;
        }

        .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 30px;
        }

        .sidebar-logo img {
            height: 40px;
            width: auto;
        }

        .sidebar-menu {
            flex-grow: 1;
        }

        .sidebar-menu-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: var(--border-radius);
            margin-bottom: 8px;
            transition: var(--transition);
        }

        .sidebar-menu-item:hover {
            background: rgba(13, 166, 174, 0.1);
            color: var(--highlight);
        }

        .sidebar-menu-item.active {
            background: var(--highlight);
            color: var(--background-dark);
        }

        .sidebar-menu-item i {
            width: 20px;
            text-align: center;
        }

        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }

        .topbar {
            height: 60px;
            background: var(--background-dark);
            display: flex;
            align-items: center;
            padding: 0 24px;
            border-bottom: 1px solid var(--border-color);
            box-shadow: 0 2px 10px var(--shadow-medium);
        }

        .content {
            flex-grow: 1;
            padding: 24px;
            overflow-y: auto;
        }

        .panel {
            background: var(--background-darker);
            border-radius: var(--border-radius);
            padding: 24px;
            border: 1px solid var(--border-color);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-secondary);
        }

        .form-control {
            width: 100%;
            padding: 12px;
            background: var(--background-dark);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            color: var(--text-primary);
            transition: var(--transition);
        }

        .form-control:focus {
            outline: none;
            border-color: var(--highlight);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: var(--highlight);
            color: var(--background-dark);
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: var(--transition);
        }

        .btn:hover {
            background: var(--highlight-soft);
        }

        .btn-secondary {
            background: var(--background-dark);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background: var(--background-darker);
        }

        .form-section {
            margin-bottom: 30px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
        }

        .form-section:last-child {
            border-bottom: none;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .tabs {
            display: flex;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
        }

        .tab {
            padding: 12px 20px;
            cursor: pointer;
            color: var(--text-secondary);
            border-bottom: 2px solid transparent;
            transition: var(--transition);
        }

        .tab.active {
            color: var(--highlight);
            border-bottom-color: var(--highlight);
        }

        .user-list {
            width: 100%;
            border-collapse: collapse;
        }

        .user-list th, .user-list td {
            border: 1px solid var(--border-color);
            padding: 12px;
            text-align: left;
        }

        .user-list th {
            background: var(--background-dark);
            color: var(--highlight);
        }

        .admin-only {
            display: none;
        }

        @media (max-width: 768px) {
            .sidebar {
                width: 80px;
                overflow: hidden;
            }

            .sidebar-menu-item span {
                display: none;
            }

            .tabs {
                flex-direction: column;
            }

            .tab {
                text-align: center;
                border-bottom: none;
                border-left: 2px solid transparent;
            }

            .tab.active {
                border-left-color: var(--highlight);
                border-bottom: none;
            }
        }

        #newUserFormContainer {
            display: none;
            margin-top: 20px;
        }
        .toggle-new-user-form {
            margin-top: 15px;
        }

        .btn-secondary {
    padding: 8px 12px;
    font-size: 0.9em;
}

.btn-secondary:hover {
    background: var(--background-darker);
    border-color: var(--highlight);
}

/* Add these styles to the existing <style> section */
.confirmation-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
}

.confirmation-content {
    background: var(--background-darker);
    padding: 24px;
    border-radius: var(--border-radius);
    width: 90%;
    max-width: 400px;
    text-align: center;
    border: 1px solid var(--border-color);
}

.confirmation-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 20px;
}

.confirmation-buttons button {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 8px 16px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: var(--transition);
}

.confirmation-buttons button:hover {
    background: var(--highlight);
    border-color: var(--highlight);
    color: var(--background-dark);
}

.confirmation-buttons .delete-btn:hover {
    background: #dc3545;
    border-color: #dc3545;
    color: var(--text-primary);
}

.confirmation-content h3 {
    margin-bottom: 12px;
    color: var(--text-primary);
}

.confirmation-content p {
    color: var(--text-secondary);
    margin-bottom: 8px;
}

.delete-btn:hover {
    background: #dc3545;
    border-color: #dc3545;
}
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-logo">
            <img src="/images/ms-logo.png" alt="Logo">
        </div>
        <div class="sidebar-menu">
            <a href="index.php" class="sidebar-menu-item">
                <i class="fas fa-map-marked-alt"></i>
                <span>Routes</span>
            </a>
            <a href="/php/settings.php" class="sidebar-menu-item active">
                <i class="fas fa-cog"></i>
                <span>Settings</span>
            </a>
            <a href="/php/logout.php" class="sidebar-menu-item">
                <i class="fas fa-sign-out-alt"></i>
                <span>Logout</span>
            </a>
        </div>
    </div>

    <div class="main-content">
        <div class="topbar">
            <h1><i class="fas fa-cog"></i> User Settings</h1>
        </div>

        <div class="content">

            <div class="panel">
                <div class="tabs">
                    <div class="tab active" data-tab="profile">Profile Information</div>
                    <div class="tab" data-tab="password">Change Password</div>
                    <div class="tab admin-only" data-tab="userlist">User List</div>
                </div>

                <form id="profileSettingsForm" class="tab-content active" data-tab="profile">
                    <div class="form-section">
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" class="form-control" id="username" name="username" readonly>
                        </div>
                        <div class="form-group">
                            <label for="userRole">Role</label>
                            <input type="text" class="form-control" id="userRole" name="userRole" readonly>
                        </div>
                    </div>
                </form>

                <form id="changePasswordForm" class="tab-content" data-tab="password">
                    <div class="form-section">
                        <h2 class="mb-3">Change Password</h2>
                        <div class="form-group">
                            <label for="currentPassword">Current Password</label>
                            <input type="password" class="form-control" id="currentPassword" name="currentPassword" required>
                        </div>
                        <div class="form-group">
                            <label for="newPassword">New Password</label>
                            <input type="password" class="form-control" id="newPassword" name="newPassword" required>
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Confirm New Password</label>
                            <input type="password" class="form-control" id="confirmPassword" name="confirmPassword" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn">
                            <i class="fas fa-lock"></i> Change Password
                        </button>
                    </div>
                </form>

                <div id="userListContent" class="tab-content admin-only" data-tab="userlist">
                    <div class="form-section">
                        <h2 class="mb-3">User List</h2>
                        <table id="userListTable" class="user-list">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="userListBody">
                                <!-- Users will be populated here -->
                            </tbody>
                        </table>
                        
                        <button id="toggleNewUserForm" class="btn toggle-new-user-form admin-only">
                            <i class="fas fa-user-plus"></i> Create New User
                        </button>

                        <div id="newUserFormContainer" class="admin-only">
                            <form id="createUserForm" class="form-section">
                                <h2 class="mb-3">Create New User</h2>
                                <div class="form-group">
                                    <label for="newUsername">Username</label>
                                    <input type="text" class="form-control" id="newUsername" name="newUsername" required>
                                </div>
                                <div class="form-group">
                                    <label for="newUserPassword">Password</label>
                                    <input type="password" class="form-control" id="newUserPassword" name="newUserPassword" required>
                                </div>
                                <div class="form-group">
                                    <label for="newUserConfirmPassword">Confirm Password</label>
                                    <input type="password" class="form-control" id="newUserConfirmPassword" name="newUserConfirmPassword" required>
                                </div>
                                <div class="form-group">
                                    <label for="userRole">User Role</label>
                                    <select class="form-control" id="userRole" name="userRole">
                                        <option value="user">Regular User</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <button type="submit" class="btn">
                                        <i class="fas fa-user-plus"></i> Create User
                                    </button>
                                    <button type="button" id="cancelNewUser" class="btn btn-secondary">
                                        <i class="fas fa-times"></i> Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="deleteConfirmation" class="confirmation-popup">
    <div class="confirmation-content">
        <h3>Remove User</h3>
        <p>Are you sure you want to remove this user? This action cannot be undone.</p>
        <div class="confirmation-buttons">
            <button onclick="confirmRemove()" class="delete-btn">
                <i class="fas fa-user-minus"></i> Remove
            </button>
            <button onclick="cancelRemove()">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
    </div>
</div>

    <script>
    // Tab switching functionality
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and tab contents
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => {
                tc.classList.remove('active');
                tc.style.display = 'none'; // Hide all tab contents
            });

            // Add active class to clicked tab and show its content
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            const activeContent = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
            activeContent.classList.add('active');
            activeContent.style.display = 'block';

            // If user list tab is clicked, load user list and hide create form
            if (tabName === 'userlist') {
                loadUserList();
                document.getElementById('newUserFormContainer').style.display = 'none';
            }
        });
    });

    // Toggle new user form visibility
// Toggle new user form visibility
const toggleNewUserForm = () => {
    const newUserFormContainer = document.getElementById('newUserFormContainer');
    const toggleButton = document.getElementById('toggleNewUserForm');
    
    if (newUserFormContainer.style.display === 'none') {
        newUserFormContainer.style.display = 'block';
        toggleButton.style.display = 'none'; // Hide the Create New User button
    } else {
        newUserFormContainer.style.display = 'none';
        toggleButton.style.display = 'block'; // Show the Create New User button
        // Clear form fields
        document.getElementById('createUserForm').reset();
    }
};

    // Event listener for toggling new user form
    document.getElementById('toggleNewUserForm').addEventListener('click', toggleNewUserForm);

    // Event listener for canceling new user form
    document.getElementById('cancelNewUser').addEventListener('click', toggleNewUserForm);

    // Load user profile on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Hide all tab contents except the active one
        document.querySelectorAll('.tab-content').forEach(tc => {
            tc.style.display = 'none';
        });
        
        // Show only the active tab content
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const activeTabName = activeTab.getAttribute('data-tab');
            const activeContent = document.querySelector(`.tab-content[data-tab="${activeTabName}"]`);
            if (activeContent) {
                activeContent.style.display = 'block';
            }
        }

        // Hide create user form by default
        document.getElementById('newUserFormContainer').style.display = 'none';

        // Fetch user profile
        fetch('/php/get_profile.php')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    document.getElementById('username').value = data.username;
                    document.getElementById('userRole').value = data.role;

                    // Show admin tabs and content only if user is admin
                    if (data.role === 'admin') {
                        document.querySelectorAll('.admin-only').forEach(el => {
                            el.style.display = 'block';
                        });
                        // But still hide admin tab content if not active
                        if (!document.querySelector('.tab[data-tab="userlist"]').classList.contains('active')) {
                            document.querySelector('.tab-content[data-tab="userlist"]').style.display = 'none';
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to load user profile');
            });
    });

// Change password form submission
document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Basic client-side validation
    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    // Send change password request
    fetch('change_password.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            currentPassword: currentPassword,
            newPassword: newPassword
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Password changed successfully');
            // Clear form
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            alert(data.message || 'Failed to change password');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while changing password');
    });
});

  // Create user form submission
  document.getElementById('createUserForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newUserPassword').value;
        const confirmPassword = document.getElementById('newUserConfirmPassword').value;
        const role = document.querySelector('#createUserForm #userRole').value;
        
        // Basic client-side validation
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        // Send create user request
        fetch('create_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password,
                role: role
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('User created successfully');
                // Reset form and hide it
                toggleNewUserForm();
                // Reload user list
                loadUserList();
            } else {
                alert(data.message || 'Failed to create user');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while creating user');
        });
    });

// Function to load user list
function loadUserList() {
        fetch('get_users.php')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch user list');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const userListBody = document.getElementById('userListBody');
                    userListBody.innerHTML = '';

                    data.data.forEach(user => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.role}</td>
                            <td>
                                ${user.role !== 'admin' ? 
                                    `<button onclick="removeUser(${user.id})" class="btn btn-secondary">
                                        <i class="fas fa-user-minus"></i> Remove
                                    </button>` : 
                                    ''}
                            </td>
                        `;
                        userListBody.appendChild(row);
                    });
                } else {
                    console.error('Failed to load user list:', data.message);
                    alert('Failed to load user list');
                }
            })
            .catch(error => {
                console.error('Error loading user list:', error);
                alert('An error occurred while loading user list');
            });
    }

let userToDelete = null;

// Modified removeUser function
function removeUser(userId) {
    userToDelete = userId;
    document.getElementById('deleteConfirmation').style.display = 'flex';
}

// Add these new functions
async function confirmRemove() {
    if (!userToDelete) return;

    try {
        const response = await fetch('remove_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: userToDelete })
        });

        const result = await response.json();
        
        if (result.success) {
            loadUserList();
        } else {
            alert('Error removing user: ' + result.message);
        }
    } catch (error) {
        console.error('Error removing user:', error);
        alert('Error removing user. Please try again.');
    } finally {
        cancelRemove();
    }
}

function cancelRemove() {
    userToDelete = null;
    document.getElementById('deleteConfirmation').style.display = 'none';
}
    </script>
</body>
</html>