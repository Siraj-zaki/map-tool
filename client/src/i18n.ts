import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      routes: 'Routes',
      settings: 'Settings',
      logout: 'Logout',
      login: 'Login',
      routeManagement: 'Route Management',
      route: 'Route',

      // Route stats
      distance: 'Distance',
      duration: 'Duration',
      ascent: 'Ascent',
      descent: 'Descent',
      highestPoint: 'Highest Point',
      lowestPoint: 'Lowest Point',

      // Tour types
      gold: 'Gold (1 Day)',
      silver: 'Silver (2 Days)',
      bronze: 'Bronze (3 Days)',
      goldLabel: '1 Day - Complete Route',
      silverLabel: '2 Days - 2 Stages',
      bronzeLabel: '3 Days - 3 Stages',

      // Actions
      download: 'Download',
      edit: 'Edit',
      delete: 'Delete',
      share: 'Share',
      save: 'Save',
      cancel: 'Cancel',
      createRoute: 'Create Route',
      createFirstRoute: 'Create First Route',
      searchRoutes: 'Search routes...',
      view: 'View',

      // Confirmations
      confirmDelete: 'Are you sure you want to delete this route?',

      // GPX Download
      downloadGPX: 'Download GPX',
      selectTourType: 'Select Tour Type',
      selectStartPoint: 'Select Start Point',
      filesAvailable: 'files available',
      stage: 'Stage',
      stages: 'Stages',

      // Elevation profile
      elevation: 'Elevation',
      surfaceType: 'Surface Type',
      trackType: 'Track Type',

      // Surface types
      natural: 'Natural',
      gravel: 'Gravel',
      asphalt: 'Asphalt',
      paved: 'Paved',

      // Track types
      singletrail: 'Singletrail',
      accessRoad: 'Access Road',
      sideRoad: 'Side Road',
      mainRoad: 'Main Road',

      // POI types
      peak: 'Peak',
      highlight: 'Highlight',
      restaurant: 'Restaurant',
      viewpoint: 'Viewpoint',
      hotel: 'Hotel',
      gipfel: 'Summit',

      // POI Modal
      addPoi: 'Add POI',
      editPoi: 'Edit POI',
      poiName: 'Name',
      poiNamePlaceholder: 'Enter POI name',
      poiType: 'POI Type',
      poiImages: 'Images',
      selectImages: 'Select Images',
      shortDescription: 'Short Description',
      shortDescriptionPlaceholder: 'Enter short description',
      bestVisitTime: 'Best Visit Time',
      pleaseSelect: 'Please select...',
      amenitiesAndFeatures: 'Amenities & Features',
      coordinates: 'Coordinates',
      pleaseEnterName: 'Please enter a name',
      pleaseSelectPoiType: 'Please select a POI type',

      // Best Time Options
      morning: 'Morning',
      noon: 'Noon',
      afternoon: 'Afternoon',
      evening: 'Evening',
      allday: 'All Day',

      // Amenities
      toilet: 'Toilet',
      food: 'Food & Drinks',
      chargingStation: 'Charging Station',
      difficulty: 'Difficulty',
      parking: 'Parking',
      waterSource: 'Water Source',
      shelter: 'Shelter',
      camping: 'Camping',
      wifi: 'WiFi',
      shower: 'Shower',

      // POI Sidebar
      overview: 'Overview',
      facilitiesAndService: 'Facilities & Service',
      location: 'Location',
      noDescriptionAvailable: 'No description available.',
      noFacilitiesAvailable: 'No facilities information available.',
      distanceToRoute: 'Distance to route',

      // Messages
      loading: 'Loading...',
      routeLoading: 'Loading route...',
      noRoutes: 'No routes found',
      loginRequired: 'Login required',
      invalidCredentials: 'Invalid credentials',
      downloadFailed: 'Download failed. Please try again.',
      routeNotFound: 'Route not found',
      noRouteSpecified: 'No route specified',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit Fullscreen',
      poweredBy: 'Powered by',

      // Editor page
      routeNamePlaceholder: 'Enter route name...',
      start: 'Start',
      end: 'End',
      waypoint: 'Waypoint',
      saveRoute: 'Save Route',
      deleteRoute: 'Delete Route',
      uploadGPX: 'Upload GPX',
      routePoints: 'ROUTE POINTS',
      clickOnMap: 'Click on map',
      routeStatistics: 'ROUTE STATISTICS',
      setStartEndHint: 'Set start and end points to see the elevation profile',
      back: 'Back',
      clickToSetStart: 'Click on map to set start point',
      clickToSetEnd: 'Click on map to set end point',
      clickToAddWaypoint: 'Click on map to add waypoint',
      clickToAddPoi: 'Click on map to add POI',
      hours: 'h',
      minutes: 'min',

      // Login page
      adminLogin: 'Admin Login',
      loginSubtitle: 'Sign in to continue',
      username: 'Username',
      password: 'Password',
      demoCredentials: 'Demo credentials',

      // Share Modal
      shareRoute: 'Share Route',
      publicLink: 'Public Link',
      embedUrl: 'Embed URL (Shopify)',
      embedUrlEN: 'Embed URL (English)',
      embedUrlDE: 'Embed URL (German)',
      iframeEmbedCode: 'iFrame Embed Code',
      iframeCodeEN: 'iFrame Code (English)',
      iframeCodeDE: 'iFrame Code (German)',
      copyCode: 'Copy Code',
      copied: 'Copied!',
      shopifyEmbedding: 'Shopify Embedding',
      shopifyStep1: 'Copy the iFrame code above',
      shopifyStep2: 'Go to your Shopify product page',
      shopifyStep3: 'Add a "Custom HTML" block',
      shopifyStep4: 'Paste the iFrame code',
      shopifyStep5: 'Save and publish',
    },
  },
  de: {
    translation: {
      // Navigation
      routes: 'Routen',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      login: 'Anmelden',
      routeManagement: 'Routenverwaltung',
      route: 'Route',

      // Route stats
      distance: 'Distanz',
      duration: 'Dauer',
      ascent: 'Aufstieg',
      descent: 'Abstieg',
      highestPoint: 'Höchster Punkt',
      lowestPoint: 'Tiefster Punkt',

      // Tour types
      gold: 'Gold (1 Tag)',
      silver: 'Silber (2 Tage)',
      bronze: 'Bronze (3 Tage)',
      goldLabel: '1 Tag - Komplette Route',
      silverLabel: '2 Tage - 2 Etappen',
      bronzeLabel: '3 Tage - 3 Etappen',

      // Actions
      download: 'Herunterladen',
      edit: 'Bearbeiten',
      delete: 'Löschen',
      share: 'Teilen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      createRoute: 'Route erstellen',
      createFirstRoute: 'Erste Route erstellen',
      searchRoutes: 'Routen suchen...',
      view: 'Ansehen',

      // Confirmations
      confirmDelete: 'Möchten Sie diese Route wirklich löschen?',

      // GPX Download
      downloadGPX: 'GPX herunterladen',
      selectTourType: 'Tourtyp wählen',
      selectStartPoint: 'Startpunkt wählen',
      filesAvailable: 'Dateien verfügbar',
      stage: 'Etappe',
      stages: 'Etappen',

      // Elevation profile
      elevation: 'Höhe',
      surfaceType: 'Untergrund',
      trackType: 'Wegtyp',

      // Surface types
      natural: 'Natürlich',
      gravel: 'Schotter',
      asphalt: 'Asphalt',
      paved: 'Gepflastert',

      // Track types
      singletrail: 'Singletrail',
      accessRoad: 'Zufahrtsstraße',
      sideRoad: 'Nebenstraße',
      mainRoad: 'Hauptstraße',

      // POI types
      peak: 'Gipfel',
      highlight: 'Highlight',
      restaurant: 'Restaurant',
      viewpoint: 'Aussichtspunkt',
      hotel: 'Hotel',
      gipfel: 'Gipfel',

      // POI Modal
      addPoi: 'POI hinzufügen',
      editPoi: 'POI bearbeiten',
      poiName: 'Name',
      poiNamePlaceholder: 'Namen des POI eingeben',
      poiType: 'POI-Typ',
      poiImages: 'Bilder',
      selectImages: 'Bilder auswählen',
      shortDescription: 'Kurzbeschreibung',
      shortDescriptionPlaceholder: 'Kurze Beschreibung eingeben',
      bestVisitTime: 'Beste Besuchszeit',
      pleaseSelect: 'Bitte auswählen...',
      amenitiesAndFeatures: 'Ausstattung & Merkmale',
      coordinates: 'Koordinaten',
      pleaseEnterName: 'Bitte geben Sie einen Namen ein',
      pleaseSelectPoiType: 'Bitte wählen Sie einen POI-Typ',

      // Best Time Options
      morning: 'Morgens',
      noon: 'Mittags',
      afternoon: 'Nachmittags',
      evening: 'Abends',
      allday: 'Ganztägig',

      // Amenities
      toilet: 'Toilette',
      food: 'Verpflegung',
      chargingStation: 'Ladestation',
      difficulty: 'Schwierigkeit',
      parking: 'Parken',
      waterSource: 'Wasserquelle',
      shelter: 'Unterstand',
      camping: 'Camping',
      wifi: 'WLAN',
      shower: 'Dusche',

      // POI Sidebar
      overview: 'Überblick',
      facilitiesAndService: 'Ausstattung & Service',
      location: 'Standort',
      noDescriptionAvailable: 'Keine Beschreibung verfügbar.',
      noFacilitiesAvailable: 'Keine Ausstattungsinformationen verfügbar.',
      distanceToRoute: 'Entfernung zur Route',

      // Messages
      loading: 'Lädt...',
      routeLoading: 'Route lädt...',
      noRoutes: 'Keine Routen gefunden',
      loginRequired: 'Anmeldung erforderlich',
      invalidCredentials: 'Ungültige Anmeldedaten',
      downloadFailed: 'Download fehlgeschlagen. Bitte erneut versuchen.',
      routeNotFound: 'Route nicht gefunden',
      noRouteSpecified: 'Keine Route angegeben',
      fullscreen: 'Vollbild',
      exitFullscreen: 'Vollbild beenden',
      poweredBy: 'Powered by',

      // Editor page
      routeNamePlaceholder: 'Routenname eingeben...',
      start: 'Start',
      end: 'Ende',
      waypoint: 'Wegpunkt',
      saveRoute: 'Route speichern',
      deleteRoute: 'Route löschen',
      uploadGPX: 'GPX hochladen',
      routePoints: 'ROUTEN-PUNKTE',
      clickOnMap: 'Klicken Sie auf die Karte',
      routeStatistics: 'ROUTEN-STATISTIKEN',
      setStartEndHint:
        'Setzen Sie Start- und Endpunkt, um das Höhenprofil zu sehen',
      back: 'Zurück',
      clickToSetStart: 'Klicken Sie auf die Karte, um den Startpunkt zu setzen',
      clickToSetEnd: 'Klicken Sie auf die Karte, um den Endpunkt zu setzen',
      clickToAddWaypoint:
        'Klicken Sie auf die Karte, um einen Wegpunkt hinzuzufügen',
      clickToAddPoi: 'Klicken Sie auf die Karte, um einen POI hinzuzufügen',
      hours: 'Std',
      minutes: 'Min',

      // Login page
      adminLogin: 'Admin Login',
      loginSubtitle: 'Melden Sie sich an, um fortzufahren',
      username: 'Benutzername',
      password: 'Passwort',
      demoCredentials: 'Demo-Anmeldedaten',

      // Share Modal
      shareRoute: 'Route teilen',
      publicLink: 'Öffentlicher Link',
      embedUrl: 'Embed URL (Shopify)',
      embedUrlEN: 'Embed URL (Englisch)',
      embedUrlDE: 'Embed URL (Deutsch)',
      iframeEmbedCode: 'iFrame Embed Code',
      iframeCodeEN: 'iFrame Code (Englisch)',
      iframeCodeDE: 'iFrame Code (Deutsch)',
      copyCode: 'Code kopieren',
      copied: 'Kopiert!',
      shopifyEmbedding: 'Shopify Einbettung',
      shopifyStep1: 'Kopieren Sie den iFrame Code oben',
      shopifyStep2: 'Gehen Sie zu Ihrer Shopify Produktseite',
      shopifyStep3: 'Fügen Sie einen "Custom HTML" Block hinzu',
      shopifyStep4: 'Fügen Sie den iFrame Code ein',
      shopifyStep5: 'Speichern und veröffentlichen',
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
