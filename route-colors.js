window.ROUTE_STYLES = {
    ZOOM: {
        COLOR: '#808080',      // Farbe: Grau für gezoomte Routen
        WIDTH: 5,              // Breite: 5 Pixel für gezoomte Routen
        OUTLINE: true,         // Umriss: aktiviert für gezoomte Routen
        OUTLINE_WIDTH: 2,      // Umrissbreite: 2 Pixel für gezoomte Routen
        OUTLINE_COLOR: '#D3D3D333' // Umrissfarbe: halbtransparentes Hellgrau
    },
    MAIN: {
        COLOR: '#088373',      // Farbe: Türkis für Hauptrouten
        WIDTH: 5,              // Breite: 1 Pixel für Hauptrouten
        OUTLINE: true,         // Umriss: aktiviert für Hauptrouten
        OUTLINE_WIDTH: 2,      // Umrissbreite: 2 Pixel für Hauptrouten
        OUTLINE_COLOR: '#D3D3D333' // Umrissfarbe: halbtransparentes Hellgrau
    },
    ELEVATION: {
        PROFILE_LINE: '#b3051c',     // Profillinienfarbe: Türkis für Höhenprofillinie
        PROFILE_AREA: 'rgba(131, 8, 8, 0.15)',  // Profilbereichsfarbe: halbtransparentes Türkis für Höhenprofilbereich
        CROSSHAIR: '#088D95',         // Fadenkreuzfarbe: Türkis-Blau für das Fadenkreuz
        OUT_OF_VIEW_LINE: '#808080',  // Außer-Sicht-Linienfarbe: Grau für Segmente außerhalb des Sichtfeldes
        OUT_OF_VIEW_AREA: 'rgba(128, 128, 128, 0.15)' // Außer-Sicht-Bereichsfarbe: halbtransparentes Grau für Bereiche außerhalb des Sichtfeldes
    }
};

// Farbreferenz 
window.ROUTE_COLORS = {
    MAIN: window.ROUTE_STYLES.MAIN.COLOR, // Hauptroutenfarbe
    ZOOM: window.ROUTE_STYLES.ZOOM.COLOR  // Gezoomte Routenfarbe
};