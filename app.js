/*
  AMS BUS FINDER
  Real Firebase Realtime Database + browser GPS implementation.

  IMPORTANT:
  After creating your Firebase project, replace the values
  inside FIREBASE_CONFIG with your Firebase Web App configuration.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getDatabase,
  ref,
  get
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
const FIREBASE_CONFIG = {
 apiKey: "AIzaSyDfMoUFnEcvuAXP9TGTjeXLgKUCtqTlWJY",
 authDomain: "ams-busfind.firebaseapp.com",
 projectId: "ams-busfind",
 storageBucket: "ams-busfind.firebasestorage.app",
 messagingSenderId: "512389746015",
 appId: "1:512389746015:web:9b1728740816b0dad6baea",
 measurementId: "G-93S728E8YB"
};
const app = initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);
const busesRef = ref(db, "buses");
get(busesRef)
  .then((snapshot) => {
    if (snapshot.exists()) {
      console.log("BUS DATA:", snapshot.val());
    } else {
      console.log("No bus data found");
    }
  })
  .catch((error) => {
    console.error("Firebase Database Error:", error);
  });

const auth = firebase.auth();


// ======================================================
// DEMO BUS NUMBERS AND ROUTES
// Change these later to your actual AMS bus routes.
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
// SHORTCUT
// ======================================================

const $ = id => document.getElementById(id);


// ======================================================
// PAGE NAVIGATION
// ======================================================

function showPage(id) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  $(id).classList.add("active");

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

  const html = BUS_OPTIONS.map(bus => {

    return `
      <option value="${bus.number}">
        ${bus.number} — ${bus.route}
      </option>
    `;

  }).join("");

  $("registerBus").innerHTML = html;

  $("studentBus").innerHTML = html;

  $("driverBusSelect").innerHTML = html;
}


// ======================================================
// MESSAGE DISPLAY
// ======================================================

function setMessage(id, text, type = "") {

  const element = $(id);

  element.textContent = text;

  element.className =
    "message" + (type ? ` ${type}` : "");
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

  return phone.replace(/\D/g, "");
}


// Firebase requires an email.
// We convert the driver's phone number internally.

function authEmailFromPhone(phone) {

  return `${normalizePhone(phone)}@amsbusfinder.app`;
}


// ======================================================
// FIREBASE CONNECTION STATUS
// ======================================================

function setConnectionBadge(connected) {

  const element = $("connectionBadge");

  if (connected) {

    element.textContent = "Firebase connected";

    element.className =
      "status-badge connected";

  } else {

    element.textContent =
      "Connection lost. Reconnecting…";

    element.className =
      "status-badge disconnected";
  }
}


db.ref(".info/connected").on(
  "value",
  snapshot => {

    setConnectionBadge(
      snapshot.val() === true
    );

  }
);


// ======================================================
// DRIVER DASHBOARD
// ======================================================

function setDriverDashboard(profile) {

  currentDriverProfile = profile;

  $("driverName").textContent =
    profile.name || "Driver";

  $("driverBus").textContent =
    profile.assignedBus || "—";

  $("driverWelcome").textContent =
    `Logged in as ${profile.name || "Driver"}`;


  const optionExists =
    [...$("driverBusSelect").options]
      .some(option =>
        option.value === profile.assignedBus
      );


  if (optionExists) {

    $("driverBusSelect").value =
      profile.assignedBus;

  }


  showPage("driverPage");
}


// ======================================================
// LOAD DRIVER PROFILE
// ======================================================

async function loadDriverProfile(user) {

  const snapshot =
    await db.ref(
      `drivers/${user.uid}`
    ).once("value");


  if (!snapshot.exists()) {

    await auth.signOut();

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

$("loginTab").addEventListener(
  "click",
  () => {

    $("loginTab").classList.add("active");

    $("registerTab")
      .classList.remove("active");


    $("loginForm")
      .classList.remove("hidden");

    $("registerForm")
      .classList.add("hidden");


    setMessage(
      "authMessage",
      ""
    );

  }
);


$("registerTab").addEventListener(
  "click",
  () => {

    $("registerTab")
      .classList.add("active");

    $("loginTab")
      .classList.remove("active");


    $("registerForm")
      .classList.remove("hidden");

    $("loginForm")
      .classList.add("hidden");


    setMessage(
      "authMessage",
      ""
    );

  }
);


// ======================================================
// DRIVER LOGIN
// ======================================================

$("loginForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    setMessage(
      "authMessage",
      "Logging in…"
    );


    try {

      await auth.signInWithEmailAndPassword(

        authEmailFromPhone(
          $("loginPhone").value
        ),

        $("loginPassword").value

      );

      setMessage(
        "authMessage",
        "Login successful.",
        "success"
      );


    } catch (error) {

      setMessage(
        "authMessage",
        friendlyAuthError(error),
        "error"
      );

    }

  }
);


// ======================================================
// DRIVER REGISTRATION
// ======================================================

$("registerForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const name =
      $("registerName").value.trim();


    const phone =
      normalizePhone(
        $("registerPhone").value)
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const db = getFirestore(app);

console.log("Firestore connected!");
