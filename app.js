/*
  AMS BUS FINDER
  Firebase Realtime Database + Firebase Authentication + Browser GPS

  Firebase SDK v12 - Modular Syntax
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

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
  authDomain: "ams-busfind.firebaseapp.com",
  projectId: "ams-busfind",
  storageBucket: "ams-busfind.firebasestorage.app",
  messagingSenderId: "512389746015",
  appId: "1:512389746015:web:9b1728740816b0dad6baea",
  measurementId: "G-93S728E8YB"
};


// ======================================================
// INITIALIZE FIREBASE
// ======================================================

const app = initializeApp(FIREBASE_CONFIG);

const db = getDatabase(app);

const auth = getAuth(app);


// ======================================================
// TEST FIREBASE DATABASE
// ======================================================

const busesRef = ref(db, "buses");

get(busesRef)
  .then((snapshot) => {

    if (snapshot.exists()) {

      console.log("BUS DATA:", snapshot.val());

    } else {

      console.log("No bus data found.");

    }

  })
  .catch((error) => {

    console.error(
      "Firebase Database Error:",
      error
    );

  });


// ======================================================
// DEMO BUS NUMBERS AND ROUTES
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
// DRIVER GPS TRACKING
// ======================================================

function startDriverTracking() {

  // Make sure a driver is logged in
  if (!currentDriver) {

    setMessage(
      "driverMessage",
      "Please login as a driver first.",
      "error"
    );

    return;

  }


  // Get assigned bus
  const busNumber =
    currentDriverProfile?.assignedBus;


  if (!busNumber) {

    setMessage(
      "driverMessage",
      "No bus is assigned to this driver.",
      "error"
    );

    return;

  }


  // Check browser GPS support
  if (!navigator.geolocation) {

    setMessage(
      "driverMessage",
      "GPS is not supported by this browser.",
      "error"
    );

    return;

  }


  // Stop an existing GPS watcher
  if (watchId !== null) {

    navigator.geolocation.clearWatch(
      watchId
    );

  }


  currentTrackingBus =
    busNumber;


  setMessage(
    "driverMessage",
    `Starting GPS tracking for ${busNumber}…`
  );


  // Start watching driver's location
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

          // Store GPS data inside the bus
          const locationRef =
            ref(
              db,
              `buses/${busNumber}/location`
            );


          await set(

            locationRef,

            {
              latitude: latitude,
              longitude: longitude,
              accuracy: accuracy,
              updatedAt: Date.now(),
              driverUid: currentDriver.uid
            }

          );


          console.log(
            `Location uploaded for ${busNumber}`
          );


          setMessage(
            "driverMessage",
            `GPS tracking active — ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            "success"
          );


        } catch (error) {

          console.error(
            "GPS Firebase error:",
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
              "GPS request timed out. Trying again…";

            break;

        }


        setMessage(
          "driverMessage",
          message,
          "error"
        );

      },

      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }

    );

}


// ======================================================
// STOP DRIVER GPS TRACKING
// ======================================================

function stopDriverTracking() {

  if (watchId !== null) {

    navigator.geolocation.clearWatch(
      watchId
    );

    watchId = null;

  }


  currentTrackingBus = null;


  setMessage(
    "driverMessage",
    "GPS tracking stopped."
  );


  console.log(
    "Driver GPS tracking stopped."
  );

}


// ======================================================
// SHORTCUT
// ======================================================

const $ = (id) => document.getElementById(id);


// ======================================================
// PAGE NAVIGATION
// ======================================================

function showPage(id) {

  document.querySelectorAll(".page").forEach((page) => {

    page.classList.remove("active");

  });


  const page = $(id);

  if (!page) {
    console.error(`Page not found: ${id}`);
    return;
  }


  page.classList.add("active");


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });


  if (id === "studentPage" && map) {

    setTimeout(() => {

      map.invalidateSize();

    }, 100);

  }

}


// ======================================================
// LOAD BUS OPTIONS
// ======================================================

function fillBusSelects() {

  const html = BUS_OPTIONS.map((bus) => {

    return `
      <option value="${bus.number}">
        ${bus.number} — ${bus.route}
      </option>
    `;

  }).join("");


  const registerBus = $("registerBus");

  const studentBus = $("studentBus");

  const driverBusSelect = $("driverBusSelect");


  if (registerBus) {

    registerBus.innerHTML = html;

  }


  if (studentBus) {

    studentBus.innerHTML = html;

  }


  if (driverBusSelect) {

    driverBusSelect.innerHTML = html;

  }

}


// ======================================================
// MESSAGE DISPLAY
// ======================================================

function setMessage(id, text, type = "") {

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
// TIME FORMAT
// ======================================================

function formatTime(timestamp) {

  if (!timestamp) {

    return "—";

  }


  return new Date(timestamp).toLocaleString(

    "en-IN",

    {

      dateStyle: "medium",

      timeStyle: "medium"

    }

  );

}


// ======================================================
// PHONE NUMBER
// ======================================================

function normalizePhone(phone) {

  return String(phone || "")
    .replace(/\D/g, "");

}


// ======================================================
// CONVERT PHONE TO INTERNAL FIREBASE EMAIL
// ======================================================

function authEmailFromPhone(phone) {

  return `${normalizePhone(phone)}@amsbusfinder.app`;

}


// ======================================================
// FIREBASE CONNECTION STATUS
// ======================================================

function setConnectionBadge(connected) {

  const element = $("connectionBadge");

  if (!element) {
    return;
  }


  if (connected) {

    element.textContent =
      "Firebase connected";

    element.className =
      "status-badge connected";

  } else {

    element.textContent =
      "Connection lost. Reconnecting…";

    element.className =
      "status-badge disconnected";

  }

}


// ======================================================
// REALTIME DATABASE CONNECTION LISTENER
// ======================================================

const connectionRef =
  ref(db, ".info/connected");


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

    setConnectionBadge(false);

  }

);


// ======================================================
// DRIVER DASHBOARD
// ======================================================

function setDriverDashboard(profile) {

  currentDriverProfile = profile;


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
      profile.name || "Driver";

  }


  if (driverBus) {

    driverBus.textContent =
      profile.assignedBus || "—";

  }


  if (driverWelcome) {

    driverWelcome.textContent =
      `Logged in as ${profile.name || "Driver"}`;

  }


  if (driverBusSelect) {

    const optionExists =
      [...driverBusSelect.options]
        .some(
          (option) =>
            option.value === profile.assignedBus
        );


    if (optionExists) {

      driverBusSelect.value =
        profile.assignedBus;

    }

  }


  showPage("driverPage");

}


// ======================================================
// LOAD DRIVER PROFILE
// ======================================================

async function loadDriverProfile(user) {

  const driverRef =
    ref(db, `drivers/${user.uid}`);


  const snapshot =
    await get(driverRef);


  if (!snapshot.exists()) {

    await signOut(auth);

    throw new Error(
      "Driver profile was not found."
    );

  }


  currentDriver = user;


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


if (loginTab) {

  loginTab.addEventListener(
    "click",
    () => {

      loginTab.classList.add("active");

      if (registerTab) {

        registerTab.classList.remove("active");

      }


      if (loginForm) {

        loginForm.classList.remove("hidden");

      }


      if (registerForm) {

        registerForm.classList.add("hidden");

      }


      setMessage(
        "authMessage",
        ""
      );

    }
  );

}


if (registerTab) {

  registerTab.addEventListener(
    "click",
    () => {

      registerTab.classList.add("active");

      if (loginTab) {

        loginTab.classList.remove("active");

      }


      if (registerForm) {

        registerForm.classList.remove("hidden");

      }


      if (loginForm) {

        loginForm.classList.add("hidden");

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
        "Logging in…"
      );


      const phone =
        $("loginPhone")?.value || "";


      const password =
        $("loginPassword")?.value || "";


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
          authEmailFromPhone(phone);


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


      } catch (error) {

        console.error(
          "Login error:",
          error
        );


        setMessage(
          "authMessage",
          friendlyAuthError(error),
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
        $("registerName")?.value.trim() || "";


      const phone =
        normalizePhone(
          $("registerPhone")?.value || ""
        );


      const password =
        $("registerPassword")?.value || "";


      const assignedBus =
        $("registerBus")?.value || "";


      if (!name) {

        setMessage(
          "authMessage",
          "Please enter the driver's name.",
          "error"
        );

        return;

      }


      if (!phone) {

        setMessage(
          "authMessage",
          "Please enter a valid phone number.",
          "error"
        );

        return;

      }


      if (password.length < 6) {

        setMessage(
          "authMessage",
          "Password must contain at least 6 characters.",
          "error"
        );

        return;

      }


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
        "Creating driver account…"
      );


      try {

        const email =
          authEmailFromPhone(phone);


        // Create Firebase Authentication account

        const userCredential =
          await createUserWithEmailAndPassword(

            auth,

            email,

            password

          );


        const user =
          userCredential.user;


        // Save driver profile in Realtime Database

        await set(

          ref(db, `drivers/${user.uid}`),

          {

            name: name,

            phone: phone,

            assignedBus: assignedBus,

            role: "driver",

            createdAt: Date.now()

          }

        );


        currentDriver =
          user;


        currentDriverProfile = {

          name: name,

          phone: phone,

          assignedBus: assignedBus,

          role: "driver",

          createdAt: Date.now()

        };


        setMessage(
          "authMessage",
          "Driver account created successfully.",
          "success"
        );


        setDriverDashboard(
          currentDriverProfile
        );


      } catch (error) {

        console.error(
          "Registration error:",
          error
        );


        setMessage(
          "authMessage",
          friendlyAuthError(error),
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

      currentDriver = null;

      currentDriverProfile = null;

      return;

    }


    try {

      await loadDriverProfile(user);

    } catch (error) {

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

function friendlyAuthError(error) {

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

      return error.message ||
        "Something went wrong. Please try again.";

  }

}


// ======================================================
// INITIALIZE BUS SELECTS
// ======================================================

fillBusSelects();


console.log(
  "AMS Bus Finder Firebase initialized successfully."
);
