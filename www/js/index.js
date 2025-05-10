/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
// Wait for the deviceready event before using any of Cordova's device APIs.

document.addEventListener('deviceready', onDeviceReady, false);

let connectedDeviceId = null;

// Throttle function to limit log frequency
function throttle(func, limit) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

// Throttle function to limit Bluetooth message frequency
function throttleBluetooth(func, limit) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

// Throttled Bluetooth write function
const throttledBluetoothWrite = throttleBluetooth(function (data) {
    if (typeof bluetoothSerial !== 'undefined') {
        bluetoothSerial.write(data,
            function () {
                console.log("Data sent successfully:", data);
            },
            function (error) {
                console.error("Error sending data:", error);
            }
        );
    } else {
        console.warn("bluetoothSerial is not available. Data not sent:", data);
    }
}, 500); // 500ms throttle

// Override console.log to also display logs in the resultDiv
const originalConsoleLog = console.log;
console.log = function (...args) {
    originalConsoleLog.apply(console, args); // Call the original console.log
    const resultDiv = document.getElementById('resultDiv');
    if (resultDiv) {
        resultDiv.innerHTML += `Log: ${args.join(' ')}<br/>`;
        resultDiv.scrollTop = resultDiv.scrollHeight; // Auto-scroll to the bottom
    }
};

// Override console.error to also display errors in the resultDiv
const originalConsoleError = console.error;
console.error = function (...args) {
    originalConsoleError.apply(console, args); // Call the original console.error
    const resultDiv = document.getElementById('resultDiv');
    if (resultDiv) {
        resultDiv.innerHTML += `<span style="color: red;">Error: ${args.join(' ')}</span><br/>`;
        resultDiv.scrollTop = resultDiv.scrollHeight; // Auto-scroll to the bottom
    }
};

function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);

    // Request Bluetooth permissions
    if (cordova.platformId === 'android') {
        const permissions = cordova.plugins.permissions;
        const requiredPermissions = [
            permissions.BLUETOOTH_SCAN,
            permissions.BLUETOOTH_ADVERTISE,
            permissions.BLUETOOTH_CONNECT
        ];

        permissions.requestPermissions(requiredPermissions, (status) => {
            if (status.hasPermission) {
                console.log('Bluetooth permissions granted.');
                initializeApp();
            } else {
                console.warn('Bluetooth permissions denied.');
                alert('Bluetooth permissions are required for this app to function.');
            }
        }, (error) => {
            console.error('Error requesting Bluetooth permissions:', error);
        });
    } else {
        initializeApp(); // For platforms other than Android
    }
}

function initializeApp() {
    refreshDeviceList();
    bindBluetoothEvents();
    updateUI(false); // Initially, no device is connected
}

function bindBluetoothEvents() {
    document.getElementById('refreshButton').addEventListener('click', refreshDeviceList, false);
    document.getElementById('disconnectButton').addEventListener('click', disconnectDevice, false);
    document.getElementById('deviceList').addEventListener('click', connectToDevice, false);
}

function updateUI(isConnected) {
    const bluetoothControls = document.getElementById('bluetoothControls');
    const refreshButton = document.getElementById('refreshButton');
    const disconnectButton = document.getElementById('disconnectButton');
    const deviceList = document.getElementById('deviceList');
    const resultDiv = document.getElementById('resultDiv');
    const messageInputContainer = document.getElementById('messageInputContainer');

    if (isConnected) {
        bluetoothControls.style.display = 'none';
        disconnectButton.style.display = 'inline-block';
        resultDiv.style.display = 'block';
        messageInputContainer.style.display = 'block';
    } else {
        bluetoothControls.style.display = 'block';
        refreshButton.style.display = 'inline-block';
        disconnectButton.style.display = 'none';
        resultDiv.style.display = 'none';
        messageInputContainer.style.display = 'none';
    }

    // Ensure all buttons are visible until a device is connected
    refreshButton.style.display = isConnected ? 'none' : 'inline-block';
    deviceList.style.display = isConnected ? 'none' : 'block';
}

function refreshDeviceList() {
    // Clear the device list
    const deviceList = document.getElementById('deviceList');
    deviceList.innerHTML = ""; 

    // Discover paired devices
    bluetoothSerial.list((pairedDevices) => {
        if (pairedDevices.length > 0) {
            const pairedHeader = document.createElement('li');
            pairedHeader.innerHTML = "<b>Paired Devices:</b>";
            deviceList.appendChild(pairedHeader);

            pairedDevices.forEach(device => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<b>${device.name}</b><br/>${device.id}`;
                listItem.dataset.deviceId = device.id;
                deviceList.appendChild(listItem);
            });
        }

        // Discover unpaired devices
        bluetoothSerial.discoverUnpaired((unpairedDevices) => {
            if (unpairedDevices.length > 0) {
                const unpairedHeader = document.createElement('li');
                unpairedHeader.innerHTML = "<b>Unpaired Devices:</b>";
                deviceList.appendChild(unpairedHeader);

                unpairedDevices.forEach(device => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `<b>${device.name || "Unknown Device"}</b><br/>${device.id}`;
                    listItem.dataset.deviceId = device.id;
                    deviceList.appendChild(listItem);
                });
            }

            if (pairedDevices.length === 0 && unpairedDevices.length === 0) {
                deviceList.innerHTML = "<li>No Bluetooth Devices Found</li>";
            }

            console.log(`Found ${pairedDevices.length} paired device(s) and ${unpairedDevices.length} unpaired device(s).`);
        }, onError);
    }, onError);
}

function connectToDevice(event) {
    const deviceId = event.target.dataset.deviceId || event.target.parentNode.dataset.deviceId;
    if (!deviceId) {
        console.error("Device ID not found.");
        alert("Device ID not found. Please select a valid device.");
        return;
    }

    console.log(`Attempting to connect to device: ${deviceId}`);

    bluetoothSerial.connect(deviceId, () => {
        connectedDeviceId = deviceId;
        bluetoothSerial.subscribe('\n', onDataReceived, onError);
        console.log(`Connected to device: ${deviceId}`);
        alert("Connected successfully!");
        updateUI(true); // Update UI to reflect connection
    }, (error) => {
        console.error("Bluetooth Error: Unable to connect to device", error);
        alert("Bluetooth Error: Unable to connect to device. Please ensure the device is in pairing mode and try again.");
    });
}

function onDataReceived(data) {
    console.log("Data received:", data);
    document.getElementById('resultDiv').innerHTML += `Received: ${data}<br/>`;
}

function sendData(data) {
    if (!connectedDeviceId) {
        alert("No device connected.");
        return;
    }

    bluetoothSerial.write(data, () => {
        console.log(`Sent: ${data}`);
    }, (error) => {
        console.error("Error sending data:", error);
    });
}

function disconnectDevice() {
    if (!connectedDeviceId) {
        alert("No device connected.");
        return;
    }

    bluetoothSerial.disconnect(() => {
        console.log("Disconnected from device:", connectedDeviceId);
        connectedDeviceId = null;
        alert("Disconnected successfully!");
        updateUI(false); // Update UI to reflect disconnection
    }, onError);
}

function onError(error) {
    console.error("Bluetooth Error:", error);
    alert("Bluetooth Error: " + error);
}

// Example usage: Sending data
document.getElementById('sendButton').addEventListener('click', () => {
    const message = document.getElementById('messageInput').value;
    sendData(message);
});

// Initialize AudioContext
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Resume AudioContext on user interaction
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed');
        });
    }
});

let currentOscillator = null; // Track the currently playing oscillator
let motorOscillator = null; // Track the motor sound oscillator

function playNote(frequency, duration) {
    // Stop the current oscillator if it exists
    if (currentOscillator) {
        currentOscillator.stop();
        currentOscillator.disconnect();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain(); // Create a GainNode for volume control

    oscillator.type = 'sine'; // Type of wave (sine, square, sawtooth, triangle)
    oscillator.frequency.value = frequency; // Frequency in hertz

    gainNode.gain.value = 0.5; // Set volume (adjust as needed)

    // Connect oscillator to gain node, then to destination
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();

    // Set the current oscillator
    currentOscillator = oscillator;

    setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        if (currentOscillator === oscillator) {
            currentOscillator = null; // Clear the current oscillator if it matches
        }
    }, duration);
}

function playMotorSound(frequency, duration) {
    // Stop the current motor oscillator if it exists
    if (motorOscillator) {
        motorOscillator.stop();
        motorOscillator.disconnect();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain(); // Create a GainNode for volume control

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency; // Frequency in hertz

    gainNode.gain.value = 0.5; // Set volume (adjust as needed)

    // Connect oscillator to gain node, then to destination
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();

    // Set the motor oscillator
    motorOscillator = oscillator;

    setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        if (motorOscillator === oscillator) {
            motorOscillator = null; // Clear the motor oscillator if it matches
        }
    }, duration);
}

// Add a test button handler to play a test sound
document.getElementById('testSound').addEventListener('click', () => {
    playNote(440, 1000); // Play a 440 Hz sound for 1 second
});

const stick = document.querySelector('.stick');
const container = document.querySelector('.joystick');
// Get the dimensions of the container
const cwidth = container.offsetWidth; // Since it's a square, height = width
const cmiddle = cwidth / 2;

servo = 0; // Position des servomoteurs
var motor = 1;
let lastMotorState = null; // Track the last motor state
dragElement(stick);

// Variables to track the latest states and changes
let latestServo = 90; // Default servo position
let latestMotor = 0;  // Default motor state (stopped)
let latestLedState = 0; // Default LED state (off)
let lastSentData = ""; // Track the last sent Bluetooth data
let isSending = false; // Prevent sending too frequently

// Function to send Bluetooth data if there are changes
function sendBluetoothData() {
    // Format the data as a compact string with no spaces, separated by commas, and ending with a newline
    const dataToSend = `${latestServo},${latestMotor},${latestLedState}\n`;

    // Only send if the data has changed
    if (dataToSend !== lastSentData && !isSending) {
        isSending = true; // Mark as sending
        lastSentData = dataToSend; // Update the last sent data

        bluetoothSerial.write(dataToSend,
            function () {
                console.log("Data sent successfully:", dataToSend);
                isSending = false; // Allow sending the next message
            },
            function (error) {
                console.error("Error sending data:", error);
                isSending = false; // Allow sending the next message
            }
        );
    }
}

function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = touchStart;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at the start
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function touchStart(e) {
        e.preventDefault();
        // Get the touch position at the start
        pos3 = e.touches[0].clientX;
        pos4 = e.touches[0].clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        elmnt.style.transition = "none";
        e = e || window.event;
        e.preventDefault();
        // For touch events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Calculate the new cursor/touch position
        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;

        // Calculate new position of the `stick`
        let newTop = elmnt.offsetTop - pos2;
        let newLeft = elmnt.offsetLeft - pos1;

        // Constrain the `stick` within the `joystick` container boundaries
        const minLeft = 34;
        const maxLeft = container.offsetWidth + 36 - elmnt.offsetWidth;
        const minTop = 34;
        const maxTop = container.offsetHeight + 36 - elmnt.offsetHeight;

        newTop = Math.min(Math.max(newTop, minTop), maxTop);
        newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);

        // Set the new position
        elmnt.style.top = newTop + "px";
        elmnt.style.left = newLeft + "px";

        console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);

        // Update servo and motor values based on joystick position
        latestServo = (((stick.offsetLeft / cwidth) * 40) + 70).toFixed();
        latestMotor = stick.offsetTop < cmiddle ? 1 : (stick.offsetTop > cmiddle ? -1 : 0);

        // Send Bluetooth data
        sendBluetoothData();
    }

    function closeDragElement() {
        // Stop moving when mouse/touch is released
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        elmnt.style.transition = "cubic-bezier(.6,1.55,.65,1) 300ms 0ms";
        elmnt.style.left = cmiddle + 6.5 + "px";
        elmnt.style.top = cmiddle + 6.5 + "px";

        console.log(`Stick position reset. X: ${stick.offsetLeft}, Y: ${stick.offsetTop}`);
        latestServo = 90;
        latestMotor = 0;

        // Send Bluetooth data
        sendBluetoothData();
    }
}

const IO = document.querySelector('.IO');
const tip = document.querySelector('.tip');
let isLedOn = false;

IO.addEventListener('click', function () {
    isLedOn = !isLedOn;
    tip.style.left = isLedOn ? '30pt' : '0pt';
    document.getElementById("LED").style.backgroundColor = isLedOn ? '#FFCC00' : '#C3C3C3';
    tip.style.backgroundColor = isLedOn ? '#FFCC00' : '#C3C3C3';

    // Play note for LED on/off
    playNote(isLedOn ? 1300 : 700, 100);

    // Update the latest LED state
    latestLedState = isLedOn ? 1 : 0;

    // Send Bluetooth data
    sendBluetoothData();
});
