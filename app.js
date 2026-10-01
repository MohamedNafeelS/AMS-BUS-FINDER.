/*
  AMS BUS FINDER
  Firebase Realtime Database + Firebase Authentication + Browser GPS
  Driver GPS + Student Live Bus Location + Leaflet Map

  Firebase SDK v12 - Modular Syntax
*/


// ======================================================
// FIREBASE SDK
// ======================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getDatabase,
  ref,
  get,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


// ======================================================
// FIREBASE CONFIGURATION
// ======================================================

const FIREBASE_CONFIG = {

  apiKey: "AIzaSyDfMoUFnEcvuAXP9TGTjeXLgKUCtqTlWJY",

  authDomain:
    "ams-busfind.firebaseapp.com",

  projectId:
    "ams-busfind",

  storageBucket:
    "ams-busfind.firebasestorage.app",

  messagingSenderId:
    "512389746015",

  appId:
    "1:512389746015:web:9b1728740816b0dad6baea",

  measurementId:
    "G-93S728E8YB"
};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

const app =
  initializeApp(FIREBASE_CONFIG);

const db =
  getDatabase(app);

const auth =
  getAuth(app);


// ======================================================
// SHORTCUT
// ======================================================

const $ = (id) =>
  document.getElementById(id);


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let currentDriver = null;

let currentDriverProfile = null;

let watchId = null;

let currentTrackingBus = null;

let studentListener = null;

let map = null;

let busMarker = null;


// ======================================================
// BUS OPTIONS
// ======================================================

const BUS_OPTIONS = [

  {
    number: "AMS-01",
    route: "Avadi → Paruthipattu → College"
  },

  {
    number: "AMS-02",
    route: "Ambattur → Padi → College"
  },

  {
    number: "AMS-03",
    route: "Thirumullaivoyal → Avadi → College"
  }

];


// ======================================================
// FIREBASE DATABASE TEST
// ======================================================

const busesRef =
  ref(db, "buses");

get(busesRef)

  .then((snapshot) => {

    if (snapshot.exists()) {

      console.log(
        "BUS DATA:",
        snapshot.val()
      );

    } else {

      console.log(
        "No bus data found."
      );

    }

  })

  .catch((error) => {

    console.error(
      "Firebase Database Error:",
      error
    );

  });


// ======================================================
// MESSAGE DISPLAY
// ======================================================

function setMessage(
  id,
  text,
  type = ""
) {

  const element = $(id);

  if (!element) {

    console.warn(
      `Message element not found: ${id}`
    );

    return;
  }

  element.textContent = text;

  element.className =
    "message" +
    (type ? ` ${type}` : "");
}


// ======================================================
// NORMALIZE BUS KEY
// ======================================================

function normalizeBusKey(busNumber) {

  if (!busNumber) {
    return "";
  }

  let busKey =
    String(busNumber)
      .trim()
      .toLowerCase();

  /*
    Keep names such as:

    AMS-01 → ams-01
    AMS-02 → ams-02

    If a numeric bus is used:

    5202 → bus5202
  */

  busKey =
    busKey.replace(/\s+/g, "");

  if (/^\d+$/.test(busKey)) {

    busKey =
      `bus${busKey}`;
  }

  return busKey;
}


// ======================================================
// DRIVER GPS TRACKING
// ======================================================

function startGPS() {

  if (!navigator.geolocation) {

    setMessage(
      "driverMessage",
      "GPS is not supported by this browser.",
      "error"
    );

    return;
  }


  const busSelect =
    document.getElementById("driverBus") ||
    document.getElementById("driverBusSelect");


  if (!busSelect || !busSelect.value) {

    setMessage(
      "driverMessage",
      "Please select a bus first.",
      "error"
    );

    return;
  }


  const busKey =
    normalizeBusKey(
      busSelect.value
    );


  if (!busKey) {

    setMessage(
      "driverMessage",
      "Invalid bus number.",
      "error"
    );

    return;
  }


  currentTrackingBus =
    busKey;


  console.log(
    "Tracking Firebase bus:",
    busKey
  );


  // Stop previous watcher
  if (watchId !== null) {

    navigator.geolocation.clearWatch(
      watchId
    );

    watchId = null;
  }


  setMessage(
    "driverMessage",
    `Starting GPS tracking for ${busSelect.value}...`
  );


  // Start GPS watcher
  watchId =
    navigator.geolocation.watchPosition(

      async (position) => {

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          position.coords.accuracy;


        console.log(
          "Driver GPS:",
          latitude,
          longitude,
          "Accuracy:",
          accuracy
        );


        try {

          const locationRef =
            ref(
              db,
              `buses/${busKey}/location`
            );


          await set(
            locationRef,
            {

              latitude:
                latitude,

              longitude:
                longitude,

              accuracy:
                accuracy,

              updatedAt:
                Date.now(),

              driverUid:
                currentDriver
                  ? currentDriver.uid
                  : null
            }
          );


          console.log(
            "GPS location saved to Firebase."
          );


          setMessage(
            "driverMessage",

            `Location sharing is ON — ` +
            `${latitude.toFixed(6)}, ` +
            `${longitude.toFixed(6)}`,

            "success"
          );


        } catch (error) {

          console.error(
            "Firebase GPS error:",
            error
          );


          setMessage(
            "driverMessage",

            "GPS received, but Firebase update failed.",

            "error"
          );
        }

      },


      (error) => {

        console.error(
          "GPS error:",
          error
        );


        let message =
          "Unable to get your location.";


        switch (error.code) {

          case error.PERMISSION_DENIED:

            message =
              "Location permission was denied. Please allow GPS access.";

            break;


          case error.POSITION_UNAVAILABLE:

            message =
              "Your current location is unavailable.";

            break;


          case error.TIMEOUT:

            message =
              "GPS request timed out. Trying again...";

            break;

        }


        setMessage(
          "driverMessage",
          message,
          "error"
        );

      },


      {

        enableHighAccuracy:
          true,

        maximumAge:
          5000,

        timeout:
          15000

      }

    );

}


// ======================================================
// STOP DRIVER GPS
// ======================================================

function stopGPS() {

  if (watchId !== null) {

    navigator.geolocation.clearWatch(
      watchId
    );

    watchId = null;
  }


  currentTrackingBus =
    null;


  setMessage(
    "driverMessage",
    "Location sharing is OFF."
  );


  console.log(
    "GPS tracking stopped."
  );
}


// ======================================================
// DRIVER GPS BUTTONS
// ======================================================

const startGPSButton =
  $("startTrackingBtn");

const stopGPSButton =
  $("stopTrackingBtn");


if (startGPSButton) {

  startGPSButton.addEventListener(
    "click",
    startGPS
  );
}


if (stopGPSButton) {

  stopGPSButton.addEventListener(
    "click",
    stopGPS
  );
}


// ======================================================
// INITIALIZE STUDENT MAP
// ======================================================

function initializeStudentMap() {

  const mapElement =
    $("studentMap");


  if (!mapElement) {

    console.error(
      "studentMap element was not found."
    );

    return;
  }


  // Prevent creating the map twice
  if (map !== null) {

    return;
  }


  // Check Leaflet
  if (typeof L === "undefined") {

    console.error(
      "Leaflet is not loaded."
    );

    return;
  }


  /*
    Default center:
    Chennai
  */

  map =
    L.map("studentMap")
      .setView(
        [13.0827, 80.2707],
        12
      );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {

      attribution:
        "&copy; OpenStreetMap contributors"

    }
  ).addTo(map);


  console.log(
    "Student map initialized."
  );
}


// ======================================================
// UPDATE BUS MARKER
// ======================================================

function updateBusMarker(
  latitude,
  longitude
) {

  if (!map) {

    console.warn(
      "Map has not been initialized."
    );

    return;
  }


  const position = [
    latitude,
    longitude
  ];


  // Create marker
  if (!busMarker) {

    busMarker =
      L.marker(position)
        .addTo(map)
        .bindPopup(
          "🚌 Your Bus"
        );

  }

  else {

    // Move existing marker
    busMarker.setLatLng(
      position
    );
  }


  // Move map to bus
  map.setView(
    position,
    15
  );
}


// ======================================================
// STUDENT LIVE BUS TRACKING
// ======================================================

function startStudentBusTracking(
  busNumber
) {

  if (!busNumber) {

    console.error(
      "No bus selected."
    );

    return;
  }


  const busKey =
    normalizeBusKey(
      busNumber
    );


  console.log(
    "Student tracking bus:",
    busKey
  );


  // Remove previous Firebase listener
  if (studentListener) {

    studentListener();

    studentListener =
      null;
  }


  // Remove previous marker
  if (busMarker && map) {

    map.removeLayer(
      busMarker
    );

    busMarker =
      null;
  }


  const locationRef =
    ref(
      db,
      `buses/${busKey}/location`
    );


  studentListener =
    onValue(

      locationRef,

      (snapshot) => {

        if (!snapshot.exists()) {

          setMessage(
            "studentMessage",

            "Driver location is not available yet.",

            "error"
          );

          return;
        }


        const location =
          snapshot.val();


        const latitude =
          Number(
            location.latitude
          );


        const longitude =
          Number(
            location.longitude
          );


        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {

          console.error(
            "Invalid location received:",
            location
          );

          return;
        }


        console.log(
          "Live bus location:",
          latitude,
          longitude
        );


        // Update marker
        updateBusMarker(
          latitude,
          longitude
        );


        // Show last update time
        const updatedText =
          location.updatedAt
            ? formatTime(
                location.updatedAt
              )
            : "Unknown";


        setMessage(
          "studentMessage",

          `Bus location updated at ${updatedText}`,

          "success"
        );

      },


      (error) => {

        console.error(
          "Student location error:",
          error
        );


        setMessage(
          "studentMessage",

          "Unable to load bus location.",

          "error"
        );

      }

    );
}


// ======================================================
// STOP STUDENT BUS TRACKING
// ======================================================

function stopStudentBusTracking() {

  if (studentListener) {

    studentListener();

    studentListener =
      null;
  }


  if (busMarker && map) {

    map.removeLayer(
      busMarker
    );

    busMarker =
      null;
  }


  console.log(
    "Student bus tracking stopped."
  );
}


// ======================================================
// PAGE NAVIGATION
// ======================================================

function showPage(id) {

  document
    .querySelectorAll(".page")
    .forEach((page) => {

      page.classList.remove(
        "active"
      );

    });


  const page =
    $(id);


  if (!page) {

    console.error(
      `Page not found: ${id}`
    );

    return;
  }


  page.classList.add(
    "active"
  );


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });


  // Student map
  if (id === "studentPage") {

    if (!map) {

      initializeStudentMap();
    }


    setTimeout(() => {

      if (map) {

        map.invalidateSize();

      }

    }, 200);

  }

}


// ======================================================
// LOAD BUS OPTIONS
// ======================================================

function fillBusSelects() {

  const html =
    BUS_OPTIONS
      .map((bus) => {

        return `
          <option value="${bus.number}">
            ${bus.number} — ${bus.route}
          </option>
        `;

      })
      .join("");


  const registerBus =
    $("registerBus");


  const studentBus =
    $("studentBus");


  const driverBusSelect =
    $("driverBusSelect");


  if (registerBus) {

    registerBus.innerHTML =
      html;
  }


  if (studentBus) {

    studentBus.innerHTML =
      html;
  }


  if (driverBusSelect) {

    driverBusSelect.innerHTML =
      html;
  }
}


// ======================================================
// STUDENT BUS SELECTOR
// ======================================================

const studentBusSelect =
  $("studentBus");


if (studentBusSelect) {

  studentBusSelect.addEventListener(
    "change",
    () => {

      const selectedBus =
        studentBusSelect.value;


      if (!selectedBus) {

        return;
      }


      // Make sure map exists
      if (!map) {

        initializeStudentMap();
      }


      startStudentBusTracking(
        selectedBus
      );

    }
  );
}


// ======================================================
// TIME FORMAT
// ======================================================

function formatTime(
  timestamp
) {

  if (!timestamp) {

    return "—";
  }


  return new Date(
    timestamp
  ).toLocaleString(

    "en-IN",

    {

      dateStyle:
        "medium",

      timeStyle:
        "medium"

    }

  );
}


// ======================================================
// PHONE NUMBER
// ======================================================

function normalizePhone(
  phone
) {

  return String(
    phone || ""
  )
    .replace(
      /\D/g,
      ""
    );
}


// ======================================================
// PHONE → INTERNAL FIREBASE EMAIL
// ======================================================

function authEmailFromPhone(
  phone
) {

  return `${normalizePhone(phone)}@amsbusfinder.app`;
}


// ======================================================
// FIREBASE CONNECTION STATUS
// ======================================================

function setConnectionBadge(
  connected
) {

  const element =
    $("connectionBadge");


  if (!element) {

    return;
  }


  if (connected) {

    element.textContent =
      "Firebase connected";


    element.className =
      "status-badge connected";

  }

  else {

    element.textContent =
      "Connection lost. Reconnecting...";


    element.className =
      "status-badge disconnected";

  }

}


// ======================================================
// REALTIME DATABASE CONNECTION LISTENER
// ======================================================

const connectionRef =
  ref(
    db,
    ".info/connected"
  );


onValue(

  connectionRef,

  (snapshot) => {

    setConnectionBadge(
      snapshot.val() === true
    );

  },

  (error) => {

    console.error(
      "Connection status error:",
      error
    );

    setConnectionBadge(
      false
    );

  }

);


// ======================================================
// DRIVER DASHBOARD
// ======================================================

function setDriverDashboard(
  profile
) {

  currentDriverProfile =
    profile;


  const driverName =
    $("driverName");


  const driverBus =
    $("driverBus");


  const driverWelcome =
    $("driverWelcome");


  const driverBusSelect =
    $("driverBusSelect");


  if (driverName) {

    driverName.textContent =
      profile.name ||
      "Driver";
  }


  if (driverBus) {

    driverBus.textContent =
      profile.assignedBus ||
      "—";
  }


  if (driverWelcome) {

    driverWelcome.textContent =
      `Logged in as ${
        profile.name ||
        "Driver"
      }`;
  }


  if (driverBusSelect) {

    const optionExists =
      [
        ...driverBusSelect.options
      ]
        .some(
          (option) =>
            option.value ===
            profile.assignedBus
        );


    if (optionExists) {

      driverBusSelect.value =
        profile.assignedBus;
    }
  }


  showPage(
    "driverPage"
  );
}


// ======================================================
// LOAD DRIVER PROFILE
// ======================================================

async function loadDriverProfile(
  user
) {

  const driverRef =
    ref(
      db,
      `drivers/${user.uid}`
    );


  const snapshot =
    await get(
      driverRef
    );


  if (!snapshot.exists()) {

    await signOut(
      auth
    );


    throw new Error(
      "Driver profile was not found."
    );
  }


  currentDriver =
    user;


  setDriverDashboard(
    snapshot.val()
  );
}


// ======================================================
// LOGIN / REGISTER TABS
// ======================================================

const loginTab =
  $("loginTab");


const registerTab =
  $("registerTab");


const loginForm =
  $("loginForm");


const registerForm =
  $("registerForm");


// ======================================================
// LOGIN TAB
// ======================================================

if (loginTab) {

  loginTab.addEventListener(
    "click",
    () => {

      loginTab.classList.add(
        "active"
      );


      if (registerTab) {

        registerTab.classList.remove(
          "active"
        );
      }


      if (loginForm) {

        loginForm.classList.remove(
          "hidden"
        );
      }


      if (registerForm) {

        registerForm.classList.add(
          "hidden"
        );
      }


      setMessage(
        "authMessage",
        ""
      );

    }
  );
}


// ======================================================
// REGISTER TAB
// ======================================================

if (registerTab) {

  registerTab.addEventListener(
    "click",
    () => {

      registerTab.classList.add(
        "active"
      );


      if (loginTab) {

        loginTab.classList.remove(
          "active"
        );
      }


      if (registerForm) {

        registerForm.classList.remove(
          "hidden"
        );
      }


      if (loginForm) {

        loginForm.classList.add(
          "hidden"
        );
      }


      setMessage(
        "authMessage",
        ""
      );

    }
  );
}


// ======================================================
// DRIVER LOGIN
// ======================================================

if (loginForm) {

  loginForm.addEventListener(
    "submit",

    async (event) => {

      event.preventDefault();


      setMessage(
        "authMessage",
        "Logging in..."
      );


      const phone =
        $("loginPhone")?.value ||
        "";


      const password =
        $("loginPassword")?.value ||
        "";


      if (!phone || !password) {

        setMessage(
          "authMessage",

          "Please enter your phone number and password.",

          "error"
        );

        return;
      }


      try {

        const email =
          authEmailFromPhone(
            phone
          );


        await signInWithEmailAndPassword(

          auth,

          email,

          password

        );


        setMessage(
          "authMessage",

          "Login successful.",

          "success"
        );


      }

      catch (error) {

        console.error(
          "Login error:",
          error
        );


        setMessage(
          "authMessage",

          friendlyAuthError(
            error
          ),

          "error"
        );
      }

    }
  );
}


// ======================================================
// DRIVER REGISTRATION
// ======================================================

if (registerForm) {

  registerForm.addEventListener(

    "submit",

    async (event) => {

      event.preventDefault();


      const name =
        $("registerName")
          ?.value
          .trim() ||
        "";


      const phone =
        normalizePhone(
          $("registerPhone")
            ?.value ||
          ""
        );


      const password =
        $("registerPassword")
          ?.value ||
        "";


      const assignedBus =
        $("registerBus")
          ?.value ||
        "";


      // -----------------------------
      // NAME
      // -----------------------------

      if (!name) {

        setMessage(
          "authMessage",

          "Please enter the driver's name.",

          "error"
        );

        return;
      }


      // -----------------------------
      // PHONE
      // -----------------------------

      if (!phone) {

        setMessage(
          "authMessage",

          "Please enter a valid phone number.",

          "error"
        );

        return;
      }


      // -----------------------------
      // PASSWORD
      // -----------------------------

      if (password.length < 6) {

        setMessage(
          "authMessage",

          "Password must contain at least 6 characters.",

          "error"
        );

        return;
      }


      // -----------------------------
      // BUS
      // -----------------------------

      if (!assignedBus) {

        setMessage(
          "authMessage",

          "Please select a bus.",

          "error"
        );

        return;
      }


      setMessage(
        "authMessage",
        "Creating driver account..."
      );


      try {

        const email =
          authEmailFromPhone(
            phone
          );


        // Create Firebase Authentication account
        const userCredential =
          await createUserWithEmailAndPassword(

            auth,

            email,

            password

          );


        const user =
          userCredential.user;


        // Save driver profile
        await set(

          ref(
            db,
            `drivers/${user.uid}`
          ),

          {

            name:
              name,

            phone:
              phone,

            assignedBus:
              assignedBus,

            role:
              "driver",

            createdAt:
              Date.now()

          }

        );


        currentDriver =
          user;


        currentDriverProfile = {

          name:
            name,

          phone:
            phone,

          assignedBus:
            assignedBus,

          role:
            "driver",

          createdAt:
            Date.now()

        };


        setMessage(
          "authMessage",

          "Driver account created successfully.",

          "success"
        );


        setDriverDashboard(
          currentDriverProfile
        );


      }

      catch (error) {

        console.error(
          "Registration error:",
          error
        );


        setMessage(
          "authMessage",

          friendlyAuthError(
            error
          ),

          "error"
        );
      }

    }

  );
}


// ======================================================
// FIREBASE AUTH STATE
// ======================================================

onAuthStateChanged(

  auth,

  async (user) => {

    if (!user) {

      currentDriver =
        null;

      currentDriverProfile =
        null;

      return;
    }


    try {

      await loadDriverProfile(
        user
      );

    }

    catch (error) {

      console.error(
        "Authentication state error:",
        error
      );

    }

  }

);


// ======================================================
// FIREBASE AUTH ERROR MESSAGES
// ======================================================

function friendlyAuthError(
  error
) {

  switch (error.code) {

    case "auth/invalid-credential":

      return "Invalid phone number or password.";


    case "auth/invalid-login-credentials":

      return "Invalid phone number or password.";


    case "auth/email-already-in-use":

      return "An account already exists for this phone number.";


    case "auth/weak-password":

      return "Password is too weak. Use at least 6 characters.";


    case "auth/invalid-email":

      return "Invalid phone number.";


    case "auth/user-not-found":

      return "Driver account was not found.";


    case "auth/wrong-password":

      return "Incorrect password.";


    case "auth/too-many-requests":

      return "Too many attempts. Please try again later.";


    case "auth/network-request-failed":

      return "Network error. Check your internet connection.";


    default:

      return (
        error.message ||
        "Something went wrong. Please try again."
      );

  }

}


// ======================================================
// INITIALIZE BUS SELECTS
// ======================================================

fillBusSelects();


// ======================================================
// INITIALIZE MAP IF STUDENT PAGE IS ALREADY VISIBLE
// ======================================================

if (
  document.getElementById(
    "studentPage"
  )?.classList.contains(
    "active"
  )
) {

  initializeStudentMap();
}


// ======================================================
// FINAL MESSAGE
// ======================================================

console.log(
  "AMS Bus Finder Firebase initialized successfully."
);
