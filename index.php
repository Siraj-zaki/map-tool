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
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <title>Routenverwaltung</title>
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

        .route-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: var(--background-dark);
            border-radius: var(--border-radius);
            margin-bottom: 12px;
            border: 1px solid var(--border-color);
            transition: var(--transition);
        }

        .route-item:hover {
            transform: translateY(-2px);
            border-color: var(--highlight);
            box-shadow: 0 4px 12px var(--shadow-light);
        }

        .route-info {
            flex-grow: 1;
        }

        .route-name {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .route-meta {
            color: var(--text-secondary);
            font-size: 0.9em;
        }

        .route-description {
            margin-top: 8px;
            color: var(--text-secondary);
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        button {
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

        button:hover {
            background: var(--highlight);
            border-color: var(--highlight);
            color: var(--background-dark);
        }

        .delete-btn:hover {
            background: #dc3545;
            border-color: #dc3545;
        }

        .search-bar {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            margin-top: 10px;
        }

        input[type="search"] {
            flex-grow: 1;
            background: var(--background-darker);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 12px;
            color: var(--text-primary);
            transition: var(--transition);
        }

        input[type="search"]:focus {
            outline: none;
            border-color: var(--highlight);
        }

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

        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: var(--text-secondary);
        }

        .error {
            color: #dc3545;
            text-align: center;
            padding: 20px;
        }

        @media (max-width: 768px) {
            .route-item {
                flex-direction: column;
                gap: 16px;
                text-align: center;
            }

            .actions {
                width: 100%;
                justify-content: center;
            }

            .sidebar {
                width: 80px;
                overflow: hidden;
            }

            .sidebar-menu-item span {
                display: none;
            }
        }

        .iframe-code {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        padding: 12px;
        margin: 15px 0;
        text-align: left;
        overflow-x: auto;
    }
    
    .iframe-code pre {
        font-family: monospace;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-all;
        color: var(--text-primary);
    }
    
    .copy-status {
        color: var(--highlight);
        height: 20px;
        margin-bottom: 10px;
        font-size: 0.9em;
    }
    </style>
</head>
<body>
<div class="sidebar">
        <div class="sidebar-logo">
            <img src="/images/ms-logo.png" alt="Logo">
        </div>
        <div class="sidebar-menu">
            <a href="index.php" class="sidebar-menu-item active">
                <i class="fas fa-map-marked-alt"></i>
                <span>Routen</span>
            </a>
            <a href="/php/settings.php" class="sidebar-menu-item">
                <i class="fas fa-cog"></i>
                <span>Einstellungen</span>
            </a>
            <a href="/php/logout.php" class="sidebar-menu-item">
                <i class="fas fa-sign-out-alt"></i>
                <span>Abmelden</span>
            </a>
        </div>
    </div>

    <div class="main-content">
        <div class="topbar">
        <h2><i class="fas fa-map-marked-alt"></i> Routenverwaltung</h2>
        </div>

        <div class="content">
            
            <div class="search-bar">
                <input type="search" id="searchRoutes" placeholder="Routen suchen...">
                <button onclick="window.location.href='edit.html'">
                    <i class="fas fa-plus"></i> Neue Route erstellen
                </button>
            </div>

            <div class="panel">
                <div id="routesList">
                    <!-- Routes will be populated here -->
                </div>
                <div id="loading" class="loading">
                    <i class="fas fa-spinner fa-spin"></i> Routen werden geladen...
                </div>
            </div>
        </div>
    </div>

    <div id="deleteConfirmation" class="confirmation-popup">
        <div class="confirmation-content">
            <h3>Route löschen</h3>
            <p>Sind Sie sicher, dass Sie diese Route löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div class="confirmation-buttons">
                <button onclick="confirmDelete()" class="delete-btn">
                    <i class="fas fa-trash"></i> Löschen
                </button>
                <button onclick="cancelDelete()">
                    <i class="fas fa-times"></i> Abbrechen
                </button>
            </div>
        </div>
    </div>

    <div id="shareModal" class="confirmation-popup">
    <div class="confirmation-content">
        <h3>Route teilen</h3>
        <p>Kopieren Sie diesen Code, um die Route auf Ihrer Website einzubetten:</p>
        <div class="iframe-code">
            <pre id="iframeCode"></pre>
        </div>
        <div class="copy-status" id="copyStatus"></div>
        <div class="confirmation-buttons">
            <button onclick="copyIframeCode()">
                <i class="fas fa-copy"></i> Code kopieren
            </button>
            <button onclick="openRouteInNewTab()">
                <i class="fas fa-external-link-alt"></i> Karte öffnen
            </button>
            <button onclick="closeShareModal()">
                <i class="fas fa-times"></i> Schließen
            </button>
        </div>
    </div>
</div>

    <script>
        let routeToDelete = null;

        async function loadRoutes() {
    const loading = document.getElementById('loading');
    const routesList = document.getElementById('routesList');
    
    loading.style.display = 'block';
    routesList.innerHTML = '';

    try {
        const response = await fetch('/php/get_routes.php');
        const result = await response.json();

        if (result.success && result.data) {
            result.data.forEach(route => {
                const routeElement = document.createElement('div');
                routeElement.className = 'route-item';
                
                // Create the inner HTML structure
                routeElement.innerHTML = `
                    <div class="route-info">
                        <div class="route-name">${route.name}</div>
                        ${route.description ? `<div class="route-description">${route.description}</div>` : ''}
                    </div>
                    <div class="actions">
                        <button class="share-btn">
                            <i class="fas fa-share"></i> Teilen
                        </button>
                        <button class="edit-btn">
                            <i class="fas fa-edit"></i> Bearbeiten
                        </button>
                        <button class="delete-btn">
                            <i class="fas fa-trash"></i> Löschen
                        </button>
                    </div>
                `;
                
                // Append the element to the list
                routesList.appendChild(routeElement);
                
                // Get references to the buttons
                const shareBtn = routeElement.querySelector('.share-btn');
                const editBtn = routeElement.querySelector('.edit-btn');
                const deleteBtn = routeElement.querySelector('.delete-btn');
                
                // Attach event listeners properly
                shareBtn.addEventListener('click', () => showShareModal(route.id));
                editBtn.addEventListener('click', () => editRoute(route.id));
                deleteBtn.addEventListener('click', () => deleteRoute(route.id));
            });
        } else {
            routesList.innerHTML = '<div class="error">Keine Routen gefunden</div>';
        }
    } catch (error) {
        console.error('Fehler:', error);
        routesList.innerHTML = '<div class="error">Fehler beim Laden der Routen</div>';
    }
    loading.style.display = 'none';
}


        function editRoute(id) {
            window.location.href = `edit.html?route=${id}`;
        }

        function deleteRoute(id) {
            routeToDelete = id;
            document.getElementById('deleteConfirmation').style.display = 'flex';
        }

        async function confirmDelete() {
            if (!routeToDelete) return;

            try {
                const response = await fetch('/php/delete_route.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ id: routeToDelete })
                });

                const result = await response.json();
                
                if (result.success) {
                    loadRoutes();
                } else {
                    alert('Fehler beim Löschen der Route: ' + result.message);
                }
            } catch (error) {
                console.error('Fehler beim Löschen der Route:', error);
                alert('Fehler beim Löschen der Route. Bitte versuchen Sie es erneut.');
            } finally {
                cancelDelete();
            }
        }

        function cancelDelete() {
            routeToDelete = null;
            document.getElementById('deleteConfirmation').style.display = 'none';
        }

        // Search functionality
        document.getElementById('searchRoutes').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const routes = document.querySelectorAll('.route-item');
            
            routes.forEach(route => {
                const name = route.querySelector('.route-name').textContent.toLowerCase();
                const description = route.querySelector('.route-description')?.textContent.toLowerCase() || '';
                
                if (name.includes(searchTerm) || description.includes(searchTerm)) {
                    route.style.display = 'flex';
                } else {
                    route.style.display = 'none';
                }
            });
        });

        // Load routes on page load
        window.addEventListener('load', loadRoutes);

        let currentRouteId = null;
    
        function showShareModal(id) {
    console.log("Modal für Route ID öffnen:", id); // Hinzugefügt für Debugging
    currentRouteId = id;
    const iframeCode = `<iframe src="https://harterbrocken.de/public.html?route=${id}" width="100%" height="700" frameborder="0" scrolling="no"></iframe>`;
    document.getElementById('iframeCode').textContent = iframeCode;
    document.getElementById('shareModal').style.display = 'flex';
    document.getElementById('copyStatus').textContent = '';
}
    
    function closeShareModal() {
        document.getElementById('shareModal').style.display = 'none';
        currentRouteId = null;
    }
    
    function copyIframeCode() {
        const iframeCode = document.getElementById('iframeCode').textContent;
        navigator.clipboard.writeText(iframeCode)
            .then(() => {
                document.getElementById('copyStatus').textContent = 'Code in die Zwischenablage kopiert!';
                setTimeout(() => {
                    document.getElementById('copyStatus').textContent = '';
                }, 3000);
            })
            .catch(err => {
                console.error('Fehler beim Kopieren des Textes: ', err);
                document.getElementById('copyStatus').textContent = 'Fehler beim Kopieren des Codes';
            });
    }
    
    function openRouteInNewTab() {
        if (currentRouteId) {
            window.open(`public.html?route=${currentRouteId}`, '_blank');
        }
    }
    </script>
</body>
</html>