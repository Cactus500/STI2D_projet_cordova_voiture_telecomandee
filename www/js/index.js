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

function onDeviceReady() {
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    permissions.requestPermission(permissions.BLUETOOTH_SCAN, success, error);
    permissions.requestPermission(permissions.BLUETOOTH_ADVERTISE, success, error);
    permissions.requestPermission(permissions.BLUETOOTH_CONNECT, success, error);
    
    function error() {
        console.warn('permissions is not turned on');
    }

    function success( status ) {
        if( !status.hasPermission ) error();
    }
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
    bluetoothSerial.list(onDeviceList, onError);
}

function onDeviceList(devices) {
    const deviceList = document.getElementById('deviceList');
    deviceList.innerHTML = ""; // Clear the list

    if (devices.length === 0) {
        deviceList.innerHTML = "<li>No Bluetooth Devices Found</li>";
        console.log("No Bluetooth Devices Found");
        return;
    }

    devices.forEach(device => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<b>${device.name}</b><br/>${device.id}`;
        listItem.dataset.deviceId = device.id;
        deviceList.appendChild(listItem);
    });

    console.log(`Found ${devices.length} device(s).`);
}

function connectToDevice(event) {
    const deviceId = event.target.dataset.deviceId || event.target.parentNode.dataset.deviceId;
    if (!deviceId) {
        console.error("Device ID not found.");
        return;
    }

    bluetoothSerial.connect(deviceId, () => {
        connectedDeviceId = deviceId;
        bluetoothSerial.subscribe('\n', onDataReceived, onError);
        console.log(`Connected to device: ${deviceId}`);
        alert("Connected successfully!");
        updateUI(true); // Update UI to reflect connection
    }, onError);
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
        console.log("Data sent:", data);
        document.getElementById('resultDiv').innerHTML += `Sent: ${data}<br/>`;
    }, onError);
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

    // RightLeft turn movement
    servo = (((stick.offsetLeft / cwidth) * 97.5) + 40).toFixed();

    if (90 < servo && servo < 100) {
      servo = 90;
    } else {
      servo = servo;
    }

    // Determine motor state
    let newMotorState;
    if (stick.offsetTop < (cmiddle + 6.5)) {
        newMotorState = 1; // Forward
    } else if (stick.offsetTop > (cmiddle + 6.5)) {
        newMotorState = -1; // Backward
    } else {
        newMotorState = 0; // Stop
    }

    // Play motor sound only if motor state has changed
    if (newMotorState !== lastMotorState) {
        if (newMotorState === 1) {
            playMotorSound(800, 300); // Forward movement
        } else if (newMotorState === -1) {
            playMotorSound(1000, 300); // Backward movement
        } else {
            playMotorSound(1200, 300); // Stop
        }
        lastMotorState = newMotorState; // Update the last motor state
    }

    motor = newMotorState;

    console.log(`Servo : ${servo}, Motors : ${motor}`);

    // Play note based on servo position
    playNote(servo * 5, 1000); // Adjust frequency based on servo position

    // Send data over Bluetooth
    const dataToSend = JSON.stringify({ S: servo, M: motor} + "\n");
    if (typeof bluetoothSerial !== 'undefined') {
        bluetoothSerial.write(dataToSend,
            function() {
                console.log("Data sent successfully:", dataToSend);
            },
            function(error) {
                console.error("Error sending data:", error);
            }
        );
    } else {
        console.warn("bluetoothSerial is not available. Data not sent:", dataToSend);
    }
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

    console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);
    servo = 90;
    motor = 0;

    console.log(`Servo : ${servo}, Motors : ${motor}`);

    // Play reset sound
    playNote(1000, 100);

    // Send reset data over Bluetooth
    const resetData = JSON.stringify({ S: 90, M: 0} + "\n");
    if (typeof bluetoothSerial !== 'undefined') {
        bluetoothSerial.write(resetData,
            function() {
                console.log("Reset data sent successfully:", resetData);
            },
            function(error) {
                console.error("Error sending reset data:", error);
            }
        );
    } else {
        console.warn("bluetoothSerial is not available. Reset data not sent:", resetData);
    }
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

    // Determine LED state
    const ledState = isLedOn ? 1 : 0;

    // Send LED state over Bluetooth
    const ledData = JSON.stringify({ L: ledState} + "\n");
    if (typeof bluetoothSerial !== 'undefined') {
        bluetoothSerial.write(ledData,
            function() {
                console.log("LED state sent successfully:", ledData);
            },
            function(error) {
                console.error("Error sending LED state:", error);
            }
        );
    } else {
        console.warn("bluetoothSerial is not available. LED state not sent:", ledData);
    }
});
